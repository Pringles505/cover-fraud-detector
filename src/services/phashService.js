let wasmModule = null;

/**
 * Initialize the WASM module
 */
export async function initPhash() {
  if (wasmModule) return wasmModule;

  try {
    const wasmImport = await import('../wasm/rust_phash.js');
    await wasmImport.default();
    wasmModule = wasmImport;
    console.log('WASM phash module initialized');
    return wasmModule;
  } catch (error) {
    console.error('Failed to initialize WASM module:', error);
    throw error;
  }
}

/**
 * Fetch image as bytes
 */
async function fetchImageBytes(imageUrl) {
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.statusText}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return new Uint8Array(arrayBuffer);
}

/**
 * Calculate perceptual hash for an image
 * @param {string} imageUrl - URL or path to the image
 * @returns {Promise<Object>} Hash object with methods
 */
export async function calculateHash(imageUrl) {
  const wasm = await initPhash();
  const imageBytes = await fetchImageBytes(imageUrl);
  const hash = new wasm.ImageHash(imageBytes);
  return hash;
}

/**
 * Compare two images and return similarity percentage
 * @param {string} imageUrl1 - First image URL
 * @param {string} imageUrl2 - Second image URL
 * @returns {Promise<number>} Similarity percentage (0-100)
 */
export async function compareImages(imageUrl1, imageUrl2) {
  const wasm = await initPhash();

  const imageBytes1 = await fetchImageBytes(imageUrl1);
  const imageBytes2 = await fetchImageBytes(imageUrl2);

  const hammingDistance = wasm.compareImages(imageBytes1, imageBytes2);
  const similarity = wasm.calculateSimilarity(hammingDistance, 8);

  return similarity;
}

/**
 * Calculate hash and return as hex string
 * @param {string} imageUrl - Image URL
 * @returns {Promise<string>} Hex string representation of hash
 */
export async function getImageHashHex(imageUrl) {
  const hash = await calculateHash(imageUrl);
  return hash.toHex();
}
