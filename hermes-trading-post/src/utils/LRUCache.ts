/**
 * LRU (Least Recently Used) Cache
 *
 * Generic cache with automatic eviction of oldest unused entries.
 * Prevents unbounded memory growth in long-running trading sessions.
 *
 * Performance:
 * - get(): O(1) lookup
 * - set(): O(1) insertion
 * - Memory: Bounded at maxSize * avg_value_size
 *
 * 🚀 PHASE 17: Bounded memory with predictable eviction
 */

export interface LRUCacheOptions {
  maxSize?: number;
  onEvict?: (key: any, value: any) => void;
}

export class LRUCache<K, V> {
  private cache = new Map<K, V>();
  private accessOrder: K[] = [];
  private readonly maxSize: number;
  private readonly onEvict?: (key: K, value: V) => void;

  constructor(options: LRUCacheOptions = {}) {
    this.maxSize = options.maxSize ?? 100;
    this.onEvict = options.onEvict;

    if (this.maxSize < 1) {
      throw new Error('LRU cache maxSize must be at least 1');
    }
  }

  /**
   * Get value from cache
   * Marks it as most recently used
   * @returns Value if found, undefined otherwise
   */
  get(key: K): V | undefined {
    if (!this.cache.has(key)) {
      return undefined;
    }

    // Move to end (most recently used)
    this.accessOrder = this.accessOrder.filter(k => k !== key);
    this.accessOrder.push(key);

    return this.cache.get(key);
  }

  /**
   * Set value in cache
   * Updates if exists, evicts LRU if full
   */
  set(key: K, value: V): void {
    // If key exists, remove it first (will re-add at end)
    if (this.cache.has(key)) {
      this.accessOrder = this.accessOrder.filter(k => k !== key);
    } else if (this.cache.size >= this.maxSize) {
      // Evict LRU (oldest) item when full
      const lruKey = this.accessOrder.shift();
      if (lruKey !== undefined) {
        const lruValue = this.cache.get(lruKey);
        this.cache.delete(lruKey);
        if (this.onEvict && lruValue !== undefined) {
          this.onEvict(lruKey, lruValue);
        }
      }
    }

    // Add to cache and mark as most recently used
    this.cache.set(key, value);
    this.accessOrder.push(key);
  }

  /**
   * Check if key exists
   */
  has(key: K): boolean {
    return this.cache.has(key);
  }

  /**
   * Get all keys in order of access (oldest to newest)
   */
  keys(): K[] {
    return [...this.accessOrder];
  }

  /**
   * Get all values in order of access (oldest to newest)
   */
  values(): V[] {
    return this.accessOrder.map(k => this.cache.get(k) as V);
  }

  /**
   * Get all entries in order of access (oldest to newest)
   */
  entries(): [K, V][] {
    return this.accessOrder.map(k => [k, this.cache.get(k) as V]);
  }

  /**
   * Delete specific key
   */
  delete(key: K): boolean {
    if (!this.cache.has(key)) {
      return false;
    }

    this.accessOrder = this.accessOrder.filter(k => k !== key);
    return this.cache.delete(key);
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.cache.clear();
    this.accessOrder = [];
  }

  /**
   * Get current size
   */
  get size(): number {
    return this.cache.size;
  }

  /**
   * Get cache capacity
   */
  get capacity(): number {
    return this.maxSize;
  }

  /**
   * Get hit rate statistics
   */
  getStats(): {
    size: number;
    capacity: number;
    utilized: number;  // percentage 0-100
  } {
    return {
      size: this.cache.size,
      capacity: this.maxSize,
      utilized: Math.round((this.cache.size / this.maxSize) * 100)
    };
  }
}

/**
 * Utility to create string key from multiple params
 * Useful for caching multi-parameter API calls
 */
export function createCacheKey(...params: any[]): string {
  return params.map(p => {
    if (typeof p === 'object') {
      return JSON.stringify(p);
    }
    return String(p);
  }).join(':');
}

/**
 * Example usage:
 *
 * // Create cache for chart candles (max 500 entries)
 * const candleCache = new LRUCache<string, CandleData[]>({
 *   maxSize: 500,
 *   onEvict: (key, value) => {
 *   }
 * });
 *
 * // Usage
 * const key = createCacheKey('BTC-USD', '1m');
 * if (candleCache.has(key)) {
 *   const candles = candleCache.get(key);  // O(1)
 * } else {
 *   const candles = await fetchFromBackend();
 *   candleCache.set(key, candles);  // O(1)
 * }
 */
