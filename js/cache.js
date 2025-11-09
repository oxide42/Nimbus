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

  #parse() {
    return Object.fromEntries(
      document.cookie
        .split("; ")
        .filter(Boolean)
        .map((c) => {
          const [key, ...val] = c.split("=");
          return [decodeURIComponent(key), decodeURIComponent(val.join("="))];
        }),
    );
  }

  /**
   * Get a single value from cache
   * @param {string} name - The key name
   * @param {boolean} parseJSON - Whether to try parsing value as JSON (default: true)
   * @returns {any|null} The value or null if not found
   */
  get(name, parseJSON = true) {
    const cookies = this.#parse();
    if (cookies[name] === undefined) return null;

    if (parseJSON) {
      try {
        return JSON.parse(cookies[name]);
      } catch {
        // If JSON parsing fails, return as string
        return cookies[name];
      }
    }
    return cookies[name];
  }

  /**
   * Get multiple values from cache
   * @param {string[]} names - Array of key names
   * @param {boolean} parseJSON - Whether to try parsing values as JSON (default: true)
   * @returns {Object} Object with key-value pairs
   */
  getMultiple(names, parseJSON = true) {
    const cookies = this.#parse();
    const result = {};
    for (const name of names) {
      if (cookies[name] !== undefined) {
        if (parseJSON) {
          try {
            result[name] = JSON.parse(cookies[name]);
          } catch {
            result[name] = cookies[name];
          }
        } else {
          result[name] = cookies[name];
        }
      } else {
        result[name] = null;
      }
    }
    return result;
  }

  /**
   * Get all cached values
   * @returns {Object} All key-value pairs
   */
  getAll() {
    return this.#parse();
  }

  /**
   * Set a single value in cache
   * @param {string} name - The key name
   * @param {any} val - The value to store (will be JSON stringified if object/array)
   * @param {number} minutes - Expiration time in minutes (default: 30)
   * @param {Object} options - Additional options
   * @param {boolean} options.secure - Whether to use Secure flag
   * @param {string} options.sameSite - SameSite policy (default: "Lax")
   * @param {string} options.domain - Cookie domain
   */
  set(
    name,
    val,
    minutes = 30,
    { secure = false, sameSite = "Lax", domain = null } = {},
  ) {
    // Convert value to string - JSON stringify if object/array
    let stringVal;
    if (val === null || val === undefined) {
      stringVal = "";
    } else if (typeof val === "object") {
      stringVal = JSON.stringify(val);
    } else {
      stringVal = String(val);
    }

    const exp = new Date(Date.now() + minutes * 60000).toUTCString();
    let cookieStr = `${encodeURIComponent(name)}=${encodeURIComponent(stringVal)}; expires=${exp}; path=/`;

    if (sameSite) {
      cookieStr += `; SameSite=${sameSite}`;
    }
    if (secure) {
      cookieStr += "; Secure";
    }
    if (domain) {
      cookieStr += `; Domain=${domain}`;
    }

    document.cookie = cookieStr;
  }

  /**
   * Set multiple values in cache
   * @param {Array} items - Array of objects with {name, value, minutes?, options?}
   */
  setMultiple(items) {
    for (const item of items) {
      const { name, value, minutes = 30, options = {} } = item;
      this.set(name, value, minutes, options);
    }
  }

  /**
   * Set multiple values with same expiration
   * @param {Object} kvPairs - Object with key-value pairs
   * @param {number} minutes - Expiration time in minutes for all items
   * @param {Object} options - Additional options for all items
   */
  setBulk(kvPairs, minutes = 30, options = {}) {
    for (const [name, value] of Object.entries(kvPairs)) {
      this.set(name, value, minutes, options);
    }
  }

  /**
   * Update value if exists, otherwise create it
   * @param {string} name - The key name
   * @param {Function} updateFn - Function that receives current value and returns new value
   * @param {number} minutes - Expiration time if creating new
   * @returns {string|null} The new value or null if not found and no default provided
   */
  update(name, updateFn, minutes = 30, defaultValue = null) {
    const current = this.get(name);
    if (current !== null) {
      const newValue = updateFn(current);
      this.set(name, newValue, minutes);
      return newValue;
    } else if (defaultValue !== null) {
      const newValue = updateFn(defaultValue);
      this.set(name, newValue, minutes);
      return newValue;
    }
    return null;
  }

  /**
   * Delete a single value from cache
   * @param {string} name - The key name
   */
  delete(name) {
    document.cookie = `${encodeURIComponent(name)}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/`;
  }

  /**
   * Delete multiple values from cache
   * @param {string[]} names - Array of key names
   */
  deleteMultiple(names) {
    for (const name of names) {
      this.delete(name);
    }
  }

  /**
   * Clear all values from cache
   * WARNING: This will delete ALL cookies accessible from the current path
   */
  clear() {
    const cookies = this.#parse();
    for (const name of Object.keys(cookies)) {
      this.delete(name);
    }
  }

  /**
   * Check if a key exists in cache
   * @param {string} name - The key name
   * @returns {boolean} True if exists
   */
  has(name) {
    return this.get(name) !== null;
  }

  /**
   * Get the number of cached items
   * @returns {number} Count of items
   */
  size() {
    return Object.keys(this.#parse()).length;
  }

  /**
   * Set value with expiration at specific date/time
   * @param {string} name - The key name
   * @param {string} val - The value to store
   * @param {Date} expirationDate - When to expire
   * @param {Object} options - Additional options
   */
  setUntil(name, val, expirationDate, options = {}) {
    const minutes = Math.max(0, (expirationDate - Date.now()) / 60000);
    this.set(name, val, minutes, options);
  }

  /**
   * Set multiple values with individual expiration dates
   * @param {Array} items - Array of {name, value, expirationDate, options?}
   */
  setMultipleUntil(items) {
    for (const item of items) {
      const { name, value, expirationDate, options = {} } = item;
      this.setUntil(name, value, expirationDate, options);
    }
  }
}

/*

// Usage examples:
// Get the singleton instance (recommended)
const cache = Cache.getInstance();

// OR use constructor (also returns the same singleton instance)
const cache2 = new Cache();
// cache === cache2 (both reference the same instance)

// Single operations
cache.set("user", "john_doe", 60); // String value
cache.get("user"); // Returns "john_doe"

// Storing objects - automatically JSON stringified
cache.set("userProfile", {
  name: "John",
  age: 30,
  preferences: ["dark", "compact"]
}, 60);
cache.get("userProfile"); // Returns the object (automatically parsed)

// Storing arrays
cache.set("tags", ["javascript", "web", "cookies"], 120);
cache.get("tags"); // Returns the array

// Multiple operations with same expiration
cache.setBulk({
  theme: "dark",
  language: "en",
  settings: { notifications: true, sound: false } // Object automatically handled
}, 120);

// Get raw string without JSON parsing
cache.get("settings", false); // Returns '{"notifications":true,"sound":false}'

// Multiple operations with different expirations
cache.setMultiple([
  { name: "session", value: "abc123", minutes: 30 },
  { name: "preference", value: { layout: "grid" }, minutes: 1440 }, // Object value
  { name: "tempData", value: [1, 2, 3], minutes: 5 } // Array value
]);

// Get multiple values (auto-parsed)
const values = cache.getMultiple(["session", "preference", "tempData"]);
// Returns: { session: "abc123", preference: { layout: "grid" }, tempData: [1, 2, 3] }

// Set with specific expiration date
const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
cache.setUntil("dailyToken", "token123", tomorrow);

// Update existing value
cache.update("counter", (val) => String(parseInt(val) + 1), 60, "0");

// Batch delete
cache.deleteMultiple(["tempData", "session"]);

// Check existence
if (cache.has("user")) {
  console.log("User is cached");
}

// Get cache size
console.log(`Cache has ${cache.size()} items`);

*/
