/**
 * @file useCacheManager.svelte.ts
 * @description Svelte hook for reactive cache management
 */

import { cacheManager } from '../services/CacheManager';
import type { CandlestickDataWithVolume } from '../services/DataTransformations';

/**
 * Hook for managing cache operations with proper async handling
 *
 * Usage:
 * ```svelte
 * <script lang="ts">
 *   import { useCacheManager } from './hooks/useCacheManager.svelte';
 *
 *   const cache = useCacheManager();
 *
 *   // Get cached candles
 *   const cached = await cache.getCachedCandles('BTC-USD', '1m', 24);
 *
 *   // Cache new candles
 *   await cache.cacheCandles('BTC-USD', '1m', newCandles);
 *
 *   // Invalidate specific cache
 *   await cache.invalidateCache('BTC-USD', '1m');
 * </script>
 * ```
 *
 * @returns Object containing cache management methods
 */
export function useCacheManager() {
  return {
    /**
     * Generate a cache key for pair and granularity
     * @param pair Trading pair (e.g., 'BTC-USD')
     * @param granularity Candle granularity (e.g., '1m')
     * @returns Cache key string
     */
    generateCacheKey: (pair: string, granularity: string): string => {
      return cacheManager.generateCacheKey(pair, granularity);
    },

    /**
     * Retrieve cached candles from Redis with IndexedDB fallback
     * @param pair Trading pair
     * @param granularity Candle granularity
     * @param hours Number of hours to retrieve (default 24)
     * @returns Array of cached candles or null
     */
    getCachedCandles: async (
      pair: string,
      granularity: string,
      hours: number = 24
    ): Promise<CandlestickDataWithVolume[] | null> => {
      return await cacheManager.getCachedCandles(pair, granularity, hours);
    },

    /**
     * Store candles in cache (both Redis and IndexedDB)
     * @param pair Trading pair
     * @param granularity Candle granularity
     * @param candles Candles to cache
     */
    cacheCandles: async (
      pair: string,
      granularity: string,
      candles: CandlestickDataWithVolume[]
    ): Promise<void> => {
      await cacheManager.cacheCandles(pair, granularity, candles);
    },

    /**
     * Invalidate cache for specific pair and granularity
     * @param pair Trading pair
     * @param granularity Candle granularity
     */
    invalidateCache: async (pair: string, granularity: string): Promise<void> => {
      await cacheManager.invalidateCache(pair, granularity);
    },

    /**
     * Clear all cached data
     */
    clearAllCache: async (): Promise<void> => {
      await cacheManager.clearAllCache();
    },

    /**
     * Get cache settings and configuration
     * @returns Object with cache settings (ttl, prefix, ttlHours)
     */
    getCacheSettings: () => {
      return cacheManager.getCacheSettings();
    },

    /**
     * Check if caching is enabled
     * @returns True if cache is enabled
     */
    isCacheEnabled: (): boolean => {
      return cacheManager.isCacheEnabled();
    }
  };
}

/**
 * Hook to access singleton cache manager instance directly
 * Use this when you need the full CacheManager class methods
 *
 * @returns CacheManager singleton instance
 */
export function useCacheManagerService() {
  return cacheManager;
}
