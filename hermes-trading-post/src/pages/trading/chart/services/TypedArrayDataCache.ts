/**
 * @file TypedArrayDataCache.ts
 * @description Optional hybrid caching layer using TypedArrays for memory efficiency
 * Part of Phase 2: Memory Optimization
 *
 * This service provides a transparent caching layer that can be optionally enabled
 * to reduce memory usage while maintaining full compatibility with existing code.
 *
 * Usage:
 * - Enable with: typedArrayCache.enable()
 * - Cache candles: typedArrayCache.store(pair, granularity, candles)
 * - Retrieve: typedArrayCache.retrieve(pair, granularity)
 * - Check memory: typedArrayCache.getMemoryStats()
 *
 * Memory Savings:
 * - Stores 10,000 candles: ~850KB (TypedArray) vs ~2.5MB (Object-based) = 66% reduction
 */

import { CandleDataBuffer } from './CandleDataBuffer';
import type { CandlestickDataWithVolume } from '../stores/services/DataTransformations';

interface CacheEntry {
  buffer: CandleDataBuffer;
  timestamp: number;
  hits: number;
}

export class TypedArrayDataCache {
  private cache: Map<string, CacheEntry> = new Map();
  private enabled = false;
  private readonly MAX_CACHE_SIZE = 100 * 1024 * 1024; // 100MB max
  private currentSize = 0;

  /**
   * Enable the TypedArray caching layer
   */
  enable(): void {
    this.enabled = true;
  }

  /**
   * Disable the caching layer
   */
  disable(): void {
    this.enabled = false;
    this.clear();
  }

  /**
   * Check if caching is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Create cache key from pair and granularity
   */
  private getKey(pair: string, granularity: string): string {
    return `${pair}:${granularity}`;
  }

  /**
   * Store candles in the cache
   */
  store(pair: string, granularity: string, candles: CandlestickDataWithVolume[]): void {
    if (!this.enabled) return;

    const key = this.getKey(pair, granularity);

    // Remove old entry if exists
    const oldEntry = this.cache.get(key);
    if (oldEntry) {
      this.currentSize -= oldEntry.buffer.getMemoryUsage();
    }

    // Create new buffer and add data
    const buffer = new CandleDataBuffer(candles.length + 256);
    buffer.pushBatch(candles);

    // Store with metadata
    this.cache.set(key, {
      buffer,
      timestamp: Date.now(),
      hits: 0
    });

    this.currentSize += buffer.getMemoryUsage();

    // Evict old entries if we exceed max cache size
    if (this.currentSize > this.MAX_CACHE_SIZE) {
      this.evictLRU();
    }

  }

  /**
   * Retrieve candles from cache as array
   */
  retrieve(pair: string, granularity: string): CandlestickDataWithVolume[] | null {
    if (!this.enabled) return null;

    const key = this.getKey(pair, granularity);
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Update hit count and timestamp for LRU eviction
    entry.hits++;
    entry.timestamp = Date.now();

    return entry.buffer.toArray();
  }

  /**
   * Get a specific candle
   */
  getCandle(pair: string, granularity: string, index: number): CandlestickDataWithVolume | null {
    if (!this.enabled) return null;

    const key = this.getKey(pair, granularity);
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    return entry.buffer.get(index);
  }

  /**
   * Get raw TypedArray buffers for indicator calculations (zero-copy)
   */
  getBuffers(pair: string, granularity: string) {
    if (!this.enabled) return null;

    const key = this.getKey(pair, granularity);
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    return {
      closes: entry.buffer.getClosesPrices(),
      opens: entry.buffer.getOpenPrices(),
      highs: entry.buffer.getHighPrices(),
      lows: entry.buffer.getLowPrices(),
      volumes: entry.buffer.getVolumes(),
      times: entry.buffer.getTimestamps(),
      length: entry.buffer.getLength()
    };
  }

  /**
   * Get cache size for a specific pair/granularity
   */
  getCacheSize(pair: string, granularity: string): number {
    if (!this.enabled) return 0;

    const key = this.getKey(pair, granularity);
    const entry = this.cache.get(key);

    return entry ? entry.buffer.getLength() : 0;
  }

  /**
   * Check if data is cached
   */
  has(pair: string, granularity: string): boolean {
    if (!this.enabled) return false;

    const key = this.getKey(pair, granularity);
    return this.cache.has(key);
  }

  /**
   * Invalidate cache for a specific pair/granularity
   */
  invalidate(pair: string, granularity: string): void {
    const key = this.getKey(pair, granularity);
    const entry = this.cache.get(key);

    if (entry) {
      this.currentSize -= entry.buffer.getMemoryUsage();
      this.cache.delete(key);
    }
  }

  /**
   * Clear all cached data
   */
  clear(): void {
    this.cache.clear();
    this.currentSize = 0;
  }

  /**
   * Evict least recently used entries
   */
  private evictLRU(): void {
    // Sort by access recency (timestamp) and hit count
    const entries = Array.from(this.cache.entries())
      .sort(([, a], [, b]) => {
        const priorityA = a.hits > 0 ? a.timestamp : 0;
        const priorityB = b.hits > 0 ? b.timestamp : 0;
        return priorityA - priorityB;
      });

    // Evict oldest 25% of entries
    const evictCount = Math.ceil(entries.length * 0.25);
    for (let i = 0; i < evictCount; i++) {
      const [key, entry] = entries[i];
      this.currentSize -= entry.buffer.getMemoryUsage();
      this.cache.delete(key);
    }
  }

  /**
   * Get detailed memory statistics
   */
  getMemoryStats() {
    const entries = Array.from(this.cache.entries()).map(([key, entry]) => ({
      key,
      candles: entry.buffer.getLength(),
      memoryUsage: entry.buffer.getMemoryUsage(),
      hits: entry.hits,
      lastAccessed: new Date(entry.timestamp).toISOString()
    }));

    const totalMemory = Array.from(this.cache.values()).reduce(
      (sum, entry) => sum + entry.buffer.getMemoryUsage(),
      0
    );

    return {
      enabled: this.enabled,
      totalEntries: this.cache.size,
      totalMemoryUsage: totalMemory,
      maxCacheSize: this.MAX_CACHE_SIZE,
      utilizationPercent: ((totalMemory / this.MAX_CACHE_SIZE) * 100).toFixed(2),
      entries
    };
  }

  /**
   * Get compression ratio (object-based vs TypedArray)
   */
  getCompressionRatio(): string {
    const stats = this.getMemoryStats();
    const totalCandles = stats.entries.reduce((sum, e) => sum + e.candles, 0);

    if (totalCandles === 0) {
      return 'N/A (no data)';
    }

    // Estimate original memory (object-based: ~250 bytes per candle)
    const estimatedOriginal = totalCandles * 250;
    const savings = estimatedOriginal - stats.totalMemoryUsage;
    const savingsPercent = ((savings / estimatedOriginal) * 100).toFixed(1);

    return `${savingsPercent}% saved (${stats.totalMemoryUsage}B vs estimated ${estimatedOriginal}B)`;
  }

  /**
   * Get performance stats
   */
  getStats() {
    const stats = this.getMemoryStats();
    const totalHits = stats.entries.reduce((sum, e) => sum + e.hits, 0);

    return {
      ...stats,
      totalHits,
      hitRate: totalHits > 0 ? (totalHits / (totalHits + stats.totalEntries)).toFixed(2) : 'N/A',
      compressionRatio: this.getCompressionRatio()
    };
  }

  /**
   * Print detailed report
   */
  printReport(): void {
    const stats = this.getStats();


    if (stats.entries.length > 0) {
      stats.entries.forEach(entry => {
      });
    }
  }
}

export const typedArrayCache = new TypedArrayDataCache();
