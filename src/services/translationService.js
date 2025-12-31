/**
 * Simple translation service
 * For production, you might want to use Google Translate API, DeepL, or similar
 */

// Common book title translations (you can expand this)
const COMMON_TRANSLATIONS = {
  // Example: if your image is named after a famous book
  'harry potter': ['harry potter', 'гарри поттер', 'ハリー・ポッター', '哈利·波特'],
  'lord of the rings': ['lord of the rings', 'señor de los anillos', 'властелин колец'],
  // Add more as needed
};

/**
 * Get common language codes for broader searches
 */
const TARGET_LANGUAGES = [
  'en', // English
  'es', // Spanish
  'fr', // French
  'de', // German
  'it', // Italian
  'pt', // Portuguese
  'ru', // Russian
  'ja', // Japanese
  'zh', // Chinese
  'ko', // Korean
  'ar', // Arabic
  'hi', // Hindi
];

/**
 * Clean and normalize title
 */
function normalizeTitle(title) {
  return title
    .toLowerCase()
    .replace(/[_-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Get search variations for a title
 * @param {string} title - The title to translate/vary
 * @returns {Array<string>} Array of title variations
 */
export function getTitleVariations(title) {
  const normalized = normalizeTitle(title);
  const variations = new Set([normalized, title]);

  // Check if we have pre-defined translations
  const lowerTitle = normalized.toLowerCase();
  if (COMMON_TRANSLATIONS[lowerTitle]) {
    COMMON_TRANSLATIONS[lowerTitle].forEach(trans => variations.add(trans));
  }

  // Add variations with common words removed
  const withoutCommon = normalized
    .replace(/\b(the|a|an|copy|book|novel)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (withoutCommon && withoutCommon !== normalized) {
    variations.add(withoutCommon);
  }

  // Add variation with numbers spelled out/vice versa
  const withNumbers = normalized.replace(/\bone\b/g, '1')
    .replace(/\btwo\b/g, '2')
    .replace(/\bthree\b/g, '3');
  if (withNumbers !== normalized) {
    variations.add(withNumbers);
  }

  return Array.from(variations).filter(v => v.length > 0);
}

/**
 * Use a free translation API (LibreTranslate or similar)
 * Note: For production, you'd want to use a proper API key and service
 * @param {string} text - Text to translate
 * @param {string} targetLang - Target language code
 * @returns {Promise<string>} Translated text
 */
export async function translateText(text, targetLang) {
  try {
    // Using LibreTranslate free API (you can replace with Google Translate API if you have a key)
    const response = await fetch('https://libretranslate.com/translate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        q: text,
        source: 'en',
        target: targetLang,
        format: 'text'
      })
    });

    if (!response.ok) {
      throw new Error(`Translation failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data.translatedText;
  } catch (error) {
    console.warn(`Translation to ${targetLang} failed:`, error);
    return null;
  }
}

/**
 * Get translations for multiple languages
 * @param {string} title - Title to translate
 * @param {number} maxLanguages - Maximum number of languages to translate to (default: 5)
 * @returns {Promise<Array<string>>} Array of translated titles
 */
export async function getMultilingualTitles(title, maxLanguages = 5) {
  const normalized = normalizeTitle(title);
  const translations = new Set([normalized]);

  // Add pre-defined variations first
  const variations = getTitleVariations(title);
  variations.forEach(v => translations.add(v));

  // Try to translate to common languages (limit to avoid rate limiting)
  const languagesToTry = TARGET_LANGUAGES.slice(0, maxLanguages);

  const translationPromises = languagesToTry.map(async (lang) => {
    try {
      const translated = await translateText(normalized, lang);
      if (translated && translated !== normalized) {
        return translated;
      }
    } catch (error) {
      console.warn(`Failed to translate to ${lang}:`, error);
    }
    return null;
  });

  const results = await Promise.all(translationPromises);
  results.forEach(result => {
    if (result) translations.add(result);
  });

  return Array.from(translations).filter(t => t.length > 0);
}

/**
 * Extract potential book title from filename
 * Removes common patterns like "copy", numbers, etc.
 */
export function extractBookTitle(filename) {
  return filename
    .replace(/\.(jpg|jpeg|png|svg|webp|gif)$/i, '')
    .replace(/[-_]/g, ' ')
    .replace(/\s*-?\s*copy\s*(\(\d+\)|\d+)?/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}
