// @ts-nocheck - Module path compatibility
/**
 * ChartCacheManager - Manages caching strategies for chart data
 * Extracted from the monolithic chartDataFeed.ts
 */

import type { CandleData } from '../../types/coinbase';
import { IndexedDBCache } from '../cache/indexedDBCache';

export class ChartCacheManager {
  private cache: IndexedDBCache;
  private memoryCache: Map<string, { data: CandleData[], timestamp: number }> = new Map();
  private readonly MEMORY_CACHE_TTL = 60000; // 1 minute TTL for memory cache
  private readonly MAX_MEMORY_CACHE_SIZE = 50; // Maximum number of cache entries
  
  constructor() {
    this.cache = new IndexedDBCache();
  }

  /**
   * Get candles from cache with memory caching layer
   */
  async getCachedCandles(
    symbol: string,
    granularity: string,
    startTime: number,
    endTime: number
  ): Promise<{ candles: CandleData[], gaps: Array<{ start: number, end: number }> }> {
    const cacheKey = `${symbol}-${granularity}-${startTime}-${endTime}`;
    
    // Check memory cache first
    const memoryCached = this.memoryCache.get(cacheKey);
    if (memoryCached && Date.now() - memoryCached.timestamp < this.MEMORY_CACHE_TTL) {
      return { candles: memoryCached.data, gaps: [] };
    }
    
    // Get from IndexedDB
    const result = await this.cache.getCachedCandles(symbol, granularity, startTime, endTime);
    
    // Store in memory cache if no gaps
    if (result.gaps.length === 0) {
      this.addToMemoryCache(cacheKey, result.candles);
    }
    
    return result;
  }

  /**
   * Store candles in both IndexedDB and memory cache
   */
  async storeCandles(
    symbol: string,
    granularity: string,
    candles: CandleData[]
  ): Promise<void> {
    await this.cache.storeCandles(symbol, granularity, candles);
    
    // Invalidate related memory cache entries
    this.invalidateMemoryCache(symbol, granularity);
  }

  /**
   * Store a single candle
   */
  async storeCandle(
    symbol: string,
    granularity: string,
    candle: CandleData
  ): Promise<void> {
    await this.cache.storeCandles(symbol, granularity, [candle]);
    this.invalidateMemoryCache(symbol, granularity);
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<{
    totalCandles: number,
    symbols: string[],
    granularities: string[],
    memoryCacheSize: number
  }> {
    const stats = await this.cache.getCacheStats();
    
    return {
      totalCandles: stats.totalCandles,
      symbols: stats.symbols,
      granularities: stats.granularities,
      memoryCacheSize: this.memoryCache.size
    };
  }

  /**
   * Clear cache for a specific symbol and granularity
   */
  async clearCache(symbol?: string, granularity?: string): Promise<void> {
    if (symbol && granularity) {
      await this.cache.clearCache(symbol, granularity);
      this.invalidateMemoryCache(symbol, granularity);
    } else {
      await this.cache.clearAllCache();
      this.memoryCache.clear();
    }
  }

  /**
   * Prune old cache entries
   */
  async pruneCache(maxAgeMs: number = 7 * 24 * 60 * 60 * 1000): Promise<number> {
    const cutoffTime = Date.now() - maxAgeMs;
    
    // Prune memory cache
    for (const [key, value] of this.memoryCache.entries()) {
      if (value.timestamp < cutoffTime) {
        this.memoryCache.delete(key);
      }
    }
    
    // For IndexedDB, we rely on the automatic pruning in storeCandles
    return this.memoryCache.size;
  }

  /**
   * Add to memory cache with size limit
   */
  private addToMemoryCache(key: string, data: CandleData[]): void {
    // Limit memory cache size
    if (this.memoryCache.size >= this.MAX_MEMORY_CACHE_SIZE) {
      // Remove oldest entry
      const oldestKey = this.memoryCache.keys().next().value;
      if (oldestKey) {
        this.memoryCache.delete(oldestKey);
      }
    }
    
    this.memoryCache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  /**
   * Invalidate memory cache for a symbol/granularity
   */
  private invalidateMemoryCache(symbol: string, granularity: string): void {
    const prefix = `${symbol}-${granularity}`;
    
    for (const key of this.memoryCache.keys()) {
      if (key.startsWith(prefix)) {
        this.memoryCache.delete(key);
      }
    }
  }

  /**
   * Check if data exists in cache
   */
  async hasDataInRange(
    symbol: string,
    granularity: string,
    startTime: number,
    endTime: number
  ): Promise<boolean> {
    const result = await this.cache.getCachedCandles(symbol, granularity, startTime, endTime);
    return result.gaps.length === 0 && result.candles.length > 0;
  }

  /**
   * Get gaps in cached data
   */
  async getDataGaps(
    symbol: string,
    granularity: string,
    startTime: number,
    endTime: number
  ): Promise<Array<{ start: number, end: number }>> {
    const result = await this.cache.getCachedCandles(symbol, granularity, startTime, endTime);
    return result.gaps;
  }

  /**
   * Merge cached data with new data
   */
  mergeData(existingData: CandleData[], newData: CandleData[]): CandleData[] {
    const dataMap = new Map<number, CandleData>();
    
    // Add existing data
    existingData.forEach(candle => {
      dataMap.set(candle.time, candle);
    });
    
    // Merge new data (overwrites if duplicate)
    newData.forEach(candle => {
      dataMap.set(candle.time, candle);
    });
    
    // Convert back to array and sort
    return Array.from(dataMap.values()).sort((a, b) => a.time - b.time);
  }
}