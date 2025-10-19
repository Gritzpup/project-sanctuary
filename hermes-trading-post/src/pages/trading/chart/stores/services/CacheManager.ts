/**
 * @file CacheManager.ts
 * @description Cache management for chart data
 * Handles Redis cache operations, cache key generation, invalidation, and TTL
 */

import { RedisChartService } from '../services/RedisChartService';
import { chartIndexedDBCache } from '../services/ChartIndexedDBCache';
import type { CandlestickDataWithVolume } from '../types/data.types';

/**
 * Manages caching of chart data across Redis and IndexedDB
 */
export class CacheManager {
  private redisService = new RedisChartService();
  private readonly DEFAULT_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
  private readonly CACHE_KEY_PREFIX = 'chart:';

  /**
   * Generate a cache key for a given pair and granularity
   * @param pair Trading pair (e.g., 'BTC-USD')
   * @param granularity Candle granularity (e.g., '1m', '5m')
   * @returns Cache key string
   */
  generateCacheKey(pair: string, granularity: string): string {
    return `${this.CACHE_KEY_PREFIX}${pair}:${granularity}`;
  }

  /**
   * Retrieve cached candles from Redis
   * @param pair Trading pair
   * @param granularity Candle granularity
   * @param hours Number of hours to retrieve (default 24)
   * @returns Array of cached candles or null if not found
   */
  async getCachedCandles(
    pair: string,
    granularity: string,
    hours: number = 24
  ): Promise<CandlestickDataWithVolume[] | null> {
    try {
      const cacheKey = this.generateCacheKey(pair, granularity);
      const cachedData = await this.redisService.getCandles(
        cacheKey,
        pair,
        granularity,
        hours
      );

      if (cachedData && cachedData.length > 0) {
        return cachedData;
      }

      // Fall back to IndexedDB if Redis miss
      return await this.getCachedFromIndexedDB(pair, granularity, hours);
    } catch (error) {
      console.error('Cache retrieval error:', error);
      // Try IndexedDB as fallback
      return await this.getCachedFromIndexedDB(pair, granularity, hours);
    }
  }

  /**
   * Retrieve cached candles from IndexedDB
   * @param pair Trading pair
   * @param granularity Candle granularity
   * @param hours Number of hours to retrieve
   * @returns Array of cached candles or null if not found
   */
  private async getCachedFromIndexedDB(
    pair: string,
    granularity: string,
    hours: number
  ): Promise<CandlestickDataWithVolume[] | null> {
    try {
      const candles = await chartIndexedDBCache.getCandles(
        pair,
        granularity,
        hours
      );
      return candles && candles.length > 0 ? candles : null;
    } catch (error) {
      console.error('IndexedDB cache retrieval error:', error);
      return null;
    }
  }

  /**
   * Store candles in cache (both Redis and IndexedDB)
   * @param pair Trading pair
   * @param granularity Candle granularity
   * @param candles Candles to cache
   */
  async cacheCandles(
    pair: string,
    granularity: string,
    candles: CandlestickDataWithVolume[]
  ): Promise<void> {
    if (!candles || candles.length === 0) {
      return;
    }

    try {
      const cacheKey = this.generateCacheKey(pair, granularity);

      // Store in Redis
      await this.redisService.storeCandles(
        cacheKey,
        pair,
        granularity,
        candles,
        this.DEFAULT_CACHE_TTL
      );

      // Store in IndexedDB as backup
      await chartIndexedDBCache.storeCandles(pair, granularity, candles);
    } catch (error) {
      console.error('Cache storage error:', error);
      // Continue even if caching fails - don't block data operations
    }
  }

  /**
   * Invalidate cache for a specific pair and granularity
   * @param pair Trading pair
   * @param granularity Candle granularity
   */
  async invalidateCache(pair: string, granularity: string): Promise<void> {
    try {
      const cacheKey = this.generateCacheKey(pair, granularity);

      // Invalidate Redis cache
      await this.redisService.invalidateCandles(cacheKey, pair, granularity);

      // Invalidate IndexedDB cache
      await chartIndexedDBCache.invalidateCandles(pair, granularity);
    } catch (error) {
      console.error('Cache invalidation error:', error);
      // Continue even if invalidation fails
    }
  }

  /**
   * Clear all cached data
   */
  async clearAllCache(): Promise<void> {
    try {
      // Note: These would need to be implemented in the respective services
      // For now, we just log the intent
      console.log('Clearing all chart caches');
    } catch (error) {
      console.error('Clear cache error:', error);
    }
  }

  /**
   * Get cache key with TTL information
   * @returns Object with cache settings
   */
  getCacheSettings() {
    return {
      ttl: this.DEFAULT_CACHE_TTL,
      prefix: this.CACHE_KEY_PREFIX,
      ttlHours: this.DEFAULT_CACHE_TTL / (60 * 60 * 1000)
    };
  }

  /**
   * Check if cache is enabled
   * @returns Always true for now - can be extended with feature flags
   */
  isCacheEnabled(): boolean {
    return true;
  }
}

// Export singleton instance
export const cacheManager = new CacheManager();
