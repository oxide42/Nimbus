class Cache {
  static _instance = null;

  constructor() {
    // Return existing instance if it exists
    if (Cache._instance) {
      return Cache._instance;
    }
    // Store the instance
    Cache._instance = this;
  }

  /**
   * Get the singleton instance
   * @returns {Cache} The Cache instance
   */
  static getInstance() {
    if (!Cache._instance) {
      Cache._instance = new Cache();
    }
    return Cache._instance;
  }

  /**
   * Get item from localStorage with automatic version and expiry checking
   * @param {string} key - The storage key
   * @param {string|number} version - Expected version (default: 1)
   * @returns {any|null} The data value or null if not found/expired/version mismatch
   */
  getItem(key, version = 1) {
    const item = localStorage.getItem(key);
    if (!item) {
      return null;
    }

    try {
      const cached = JSON.parse(item);
      const { data, expiry, version: storedVersion } = cached;

      // Check version and expiry - remove if invalid
      if (storedVersion !== version || expiry <= Date.now()) {
        localStorage.removeItem(key);
        return null;
      }

      return data;
    } catch (e) {
      console.error("Failed to parse cached data:", e);
      localStorage.removeItem(key);
      return null;
    }
  }

  /**
   * Set item in localStorage with version and expiry metadata
   * @param {string} key - The storage key
   * @param {any} data - The data to store
   * @param {number} expiryTime - Expiry timestamp in milliseconds
   * @param {string|number} version - Version identifier (default: 1)
   */
  setItem(key, data, expiryTime, version = 1) {
    const cacheData = {
      version,
      data,
      expiry: expiryTime,
    };

    try {
      localStorage.setItem(key, JSON.stringify(cacheData));
    } catch (e) {
      console.error("Failed to cache data:", e);
    }
  }

  /**
   * Remove item from localStorage
   * @param {string} key - The storage key
   */
  removeItem(key) {
    localStorage.removeItem(key);
  }

  /**
   * Check if a key exists and is valid (not expired, correct version)
   * @param {string} key - The storage key
   * @param {string|number} version - Expected version (default: 1)
   * @returns {boolean} True if exists and is valid
   */
  has(key, version = 1) {
    return this.getItem(key, version) !== null;
  }

  /**
   * Clear all items from localStorage
   * WARNING: This will delete ALL items in localStorage
   */
  clear() {
    localStorage.clear();
  }

  /**
   * Get the number of items in localStorage
   * @returns {number} Count of items
   */
  size() {
    return localStorage.length;
  }
}

/*

// Usage examples:
// Get the singleton instance (recommended)
const cache = Cache.getInstance();

// OR use constructor (also returns the same singleton instance)
const cache2 = new Cache();
// cache === cache2 (both reference the same instance)

// Get item with automatic version and expiry checking
const data = cache.getItem("myKey", "v4"); // Returns null if expired or version mismatch

// Set item with version and expiry
const expiryTime = Date.now() + 60 * 60 * 1000; // 1 hour from now
cache.setItem("myKey", {data: [...], alerts: [...]}, expiryTime, "v4");

// Remove item from localStorage
cache.removeItem("myKey");

// Check if item exists and is valid
if (cache.has("myKey", "v4")) {
  console.log("Valid cache exists");
}

// Get localStorage size
console.log(`Cache has ${cache.size()} items`);

// Clear all localStorage
cache.clear();

*/
