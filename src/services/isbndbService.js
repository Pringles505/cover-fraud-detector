import { compareImages, calculateHash, getImageHashHex } from './phashService';
import { getTitleVariations, extractBookTitle } from './translationService';

// ISBNDB API configuration
const ISBNDB_API_KEY = import.meta.env.VITE_ISBNDB_API_KEY || '';
const ISBNDB_BASE_URL = 'https://api2.isbndb.com';

/**
 * Search for books on ISBNDB
 * @param {string} query - Search query
 * @param {number} page - Page number (default 1)
 * @param {number} pageSize - Results per page (default 20)
 * @returns {Promise<Array>} Array of book results
 */
export async function searchBooks(query = '', page = 1, pageSize = 20) {
  if (!ISBNDB_API_KEY) {
    throw new Error('ISBNDB API key not configured. Please set VITE_ISBNDB_API_KEY in .env file');
  }

  try {
    const url = new URL(`${ISBNDB_BASE_URL}/books/${encodeURIComponent(query)}`);
    url.searchParams.set('page', page);
    url.searchParams.set('pageSize', pageSize);

    const response = await fetch(url, {
      headers: {
        'Authorization': ISBNDB_API_KEY,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`ISBNDB API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.books || [];
  } catch (error) {
    console.error('ISBNDB search error:', error);
    throw error;
  }
}

/**
 * Get books with cover images
 * @param {string} query - Search query
 * @param {number} maxResults - Maximum number of results to return
 * @returns {Promise<Array>} Books with cover images
 */
export async function getBooksWithCovers(query = 'fiction', maxResults = 50) {
  const books = await searchBooks(query, 1, maxResults);

  // Filter to only books with cover images
  return books.filter(book => book.image && book.image.trim() !== '');
}

/**
 * Search for books by title in multiple languages
 * @param {string} title - Book title to search for
 * @param {number} maxResultsPerQuery - Max results per search query
 * @returns {Promise<Array>} Books matching the title (with covers)
 */
export async function searchBooksByTitle(title, maxResultsPerQuery = 20) {
  // Get title variations (including potential translations)
  const titleVariations = getTitleVariations(title);

  console.log(`Searching for title variations: ${titleVariations.join(', ')}`);

  const allBooks = [];
  const seenIsbns = new Set();

  // Search for each title variation
  for (const variation of titleVariations) {
    try {
      const books = await searchBooks(variation, 1, maxResultsPerQuery);

      // Filter to books with covers and avoid duplicates
      books.forEach(book => {
        const isbn = book.isbn13 || book.isbn;
        if (book.image && book.image.trim() !== '' && !seenIsbns.has(isbn)) {
          seenIsbns.add(isbn);
          allBooks.push(book);
        }
      });
    } catch (error) {
      console.warn(`Failed to search for "${variation}":`, error);
      // Continue with other variations
    }
  }

  return allBooks;
}

/**
 * Find similar book covers using perceptual hashing
 * Now with enhanced title-based search first
 * @param {string} targetImageUrl - URL of the image to compare against
 * @param {Object} options - Search options
 * @param {string} options.imageName - Name of the image file (used to extract title)
 * @param {string} options.query - Fallback ISBNDB search query (default: 'fiction')
 * @param {number} options.maxResults - Max books to fetch from ISBNDB (default: 50)
 * @param {number} options.similarityThreshold - Minimum similarity % to include (default: 70)
 * @param {number} options.topN - Max number of similar results to return (default: 10)
 * @param {Function} options.onProgress - Progress callback (current, total, bookTitle)
 * @returns {Promise<Object>} Object containing results and target hash info
 */
export async function findSimilarCovers(targetImageUrl, options = {}) {
  const {
    imageName = '',
    query = 'fiction',
    maxResults = 50,
    similarityThreshold = 70,
    topN = 10,
    onProgress = null
  } = options;

  // Calculate target image hash first
  const targetHash = await calculateHash(targetImageUrl);
  const targetHashHex = targetHash.toHex();

  let books = [];
  let searchMethod = 'generic';

  // Step 1: Try to search by title if we have an image name
  if (imageName) {
    const extractedTitle = extractBookTitle(imageName);
    console.log(`Extracted title from image name: "${extractedTitle}"`);

    if (extractedTitle && extractedTitle.length > 2) {
      searchMethod = 'title-based';
      console.log('Searching by title in multiple languages...');

      try {
        books = await searchBooksByTitle(extractedTitle, 20);
        console.log(`Found ${books.length} books matching title variations`);
      } catch (error) {
        console.warn('Title-based search failed, falling back to generic search:', error);
        searchMethod = 'generic-fallback';
      }
    }
  }

  // Step 2: Fallback to generic search if title search didn't work or wasn't possible
  if (books.length === 0) {
    console.log(`Falling back to generic search with query: "${query}"`);
    books = await getBooksWithCovers(query, maxResults);
    searchMethod = books.length > 0 ? 'generic' : 'none';
  }

  if (books.length === 0) {
    return {
      targetHash: targetHashHex,
      results: [],
      totalCompared: 0,
      searchMethod: 'none',
      searchQuery: imageName || query
    };
  }

  // Step 3: Compare target image with each book cover using phash
  const comparisons = [];

  for (let i = 0; i < books.length; i++) {
    const book = books[i];

    // Report progress
    if (onProgress) {
      onProgress(i + 1, books.length, book.title);
    }

    try {
      // Calculate hash for the book cover
      const bookHash = await calculateHash(book.image);
      const bookHashHex = bookHash.toHex();

      // Calculate Hamming distance
      const hammingDistance = targetHash.hammingDistance(bookHash);

      // Calculate similarity percentage
      const maxDistance = 8 * 8; // 8x8 hash
      const similarity = (1.0 - (hammingDistance / maxDistance)) * 100.0;

      if (similarity >= similarityThreshold) {
        comparisons.push({
          book: {
            title: book.title,
            authors: book.authors || [],
            isbn: book.isbn13 || book.isbn,
            publisher: book.publisher,
            image: book.image,
            publishDate: book.date_published
          },
          similarity: Math.round(similarity * 100) / 100,
          hashHex: bookHashHex,
          hammingDistance: hammingDistance,
          matchedByTitle: searchMethod === 'title-based'
        });
      }
    } catch (error) {
      console.warn(`Failed to compare with book: ${book.title}`, error);
      // Continue with other books
    }
  }

  // Sort by similarity (highest first) and return top N
  const sortedResults = comparisons
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topN);

  return {
    targetHash: targetHashHex,
    results: sortedResults,
    totalCompared: books.length,
    searchMethod: searchMethod,
    searchQuery: imageName || query
  };
}
