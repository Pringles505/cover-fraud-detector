import { useEffect, useState } from 'react';
import { findSimilarCovers } from '../../services/isbndbService';
import styles from './Modal.module.css';

export function Modal({ isOpen, image, onClose }) {
  const [isScanning, setIsScanning] = useState(false);
  const [scanResults, setScanResults] = useState(null);
  const [scanError, setScanError] = useState(null);
  const [scanProgress, setScanProgress] = useState({ current: 0, total: 0, book: '' });

  // Close modal on ESC key press
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  // Reset scan results when modal closes or image changes
  useEffect(() => {
    if (!isOpen) {
      setScanResults(null);
      setScanError(null);
      setScanProgress({ current: 0, total: 0, book: '' });
    }
  }, [isOpen, image]);

  const handleScan = async () => {
    if (!image) return;

    setIsScanning(true);
    setScanError(null);
    setScanResults(null);
    setScanProgress({ current: 0, total: 0, book: '' });

    try {
      // Scan for similar covers using phash algorithm
      // First searches by title (in multiple languages), then compares covers
      const data = await findSimilarCovers(image.src, {
        imageName: image.name, // Pass the image name to extract title
        query: 'fiction', // Fallback query if title search doesn't work
        maxResults: 50,
        similarityThreshold: 60,
        topN: 10,
        onProgress: (current, total, bookTitle) => {
          setScanProgress({ current, total, book: bookTitle });
        }
      });

      setScanResults(data);

      if (data.results.length === 0) {
        const methodInfo = data.searchMethod === 'title-based'
          ? `Searched by title "${data.searchQuery}" (including translations).`
          : `Used generic search "${data.searchQuery}".`;
        setScanError(`No similar covers found. Compared against ${data.totalCompared} books. ${methodInfo}`);
      }
    } catch (error) {
      console.error('Scan error:', error);
      setScanError(error.message || 'Failed to scan for similar covers');
    } finally {
      setIsScanning(false);
    }
  };

  if (!isOpen || !image) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <button
          className={styles.closeBtn}
          onClick={onClose}
          aria-label="Close modal"
        >
          ×
        </button>

        <h2 className={styles.title}>{image.name}</h2>

        <div className={styles.imageContainer}>
          <img
            src={image.src}
            alt={image.name}
            className={styles.image}
          />
        </div>

        <div className={styles.actions}>
          <button
            className={styles.scanBtn}
            onClick={handleScan}
            disabled={isScanning}
          >
            {isScanning ? 'Scanning...' : 'Scan for Similar Covers'}
          </button>
        </div>

        {isScanning && scanProgress.total > 0 && (
          <div className={styles.progress}>
            <div className={styles.progressBar}>
              <div
                className={styles.progressFill}
                style={{ width: `${(scanProgress.current / scanProgress.total) * 100}%` }}
              />
            </div>
            <p className={styles.progressText}>
              Comparing {scanProgress.current} of {scanProgress.total} books
              {scanProgress.book && `: ${scanProgress.book.substring(0, 40)}...`}
            </p>
          </div>
        )}

        {scanError && (
          <div className={styles.error}>
            <p>{scanError}</p>
          </div>
        )}

        {scanResults && scanResults.targetHash && (
          <div className={styles.hashInfo}>
            <h3 className={styles.hashTitle}>Your Cover's Perceptual Hash (phash)</h3>
            <code className={styles.hashCode}>{scanResults.targetHash}</code>
            <p className={styles.hashDescription}>
              {scanResults.searchMethod === 'title-based' && (
                <>
                  <strong>✓ Title-based search:</strong> Found books matching "{scanResults.searchQuery}" (including translations).
                  {' '}
                </>
              )}
              {scanResults.searchMethod === 'generic' && (
                <>
                  <strong>Generic search:</strong> Searched "{scanResults.searchQuery}".
                  {' '}
                </>
              )}
              Compared {scanResults.totalCompared} book covers using phash + Hamming distance algorithm.
            </p>
          </div>
        )}

        {scanResults && scanResults.results && scanResults.results.length > 0 && (
          <div className={styles.results}>
            <h3 className={styles.resultsTitle}>
              Similar Covers Found ({scanResults.results.length})
            </h3>
            <div className={styles.resultsList}>
              {scanResults.results.map((result, index) => (
                <div key={index} className={styles.resultItem}>
                  <img
                    src={result.book.image}
                    alt={result.book.title}
                    className={styles.resultImage}
                  />
                  <div className={styles.resultInfo}>
                    <h4 className={styles.resultTitle}>
                      {result.book.title}
                      {result.matchedByTitle && (
                        <span className={styles.titleMatchBadge} title="Matched by title search">
                          📖 Title Match
                        </span>
                      )}
                    </h4>
                    <p className={styles.resultAuthors}>
                      {result.book.authors.join(', ')}
                    </p>
                    <p className={styles.resultSimilarity}>
                      Similarity: {result.similarity}%
                    </p>
                    <p className={styles.resultDistance}>
                      Hamming Distance: {result.hammingDistance} / 64
                    </p>
                    <details className={styles.hashDetails}>
                      <summary className={styles.hashSummary}>View Hash</summary>
                      <code className={styles.hashCode}>{result.hashHex}</code>
                    </details>
                    {result.book.isbn && (
                      <p className={styles.resultIsbn}>ISBN: {result.book.isbn}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
