/**
 * @file chartCacheService.ts
 * @description Redis cache operations for chart data
 * Part of Phase 5D: Chart Services Consolidation
 */

import { dataStore } from '../../stores/dataStore.svelte';
import type { CandleData } from '../../types/coinbase';

/**
 * Chart Cache Service - manages Redis caching for chart candles
 */
export class ChartCacheService {
  /**
   * Store candles in cache with TTL
   */
  async storeCandlesInCache(
    pair: string,
    granularity: string,
    candles: CandleData[],
    ttlSeconds: number = 3600
  ): Promise<void> {
    try {
      const cacheKey = `${pair}:${granularity}:candles`;
      const startTime = candles[0]?.time || 0;
      const endTime = candles[candles.length - 1]?.time || 0;

      await fetch('/api/cache-candles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pair,
          granularity,
          startTime,
          endTime,
          data: candles,
          ttl: ttlSeconds
        })
      });
    } catch (error) {
      console.warn('Failed to cache candles:', error);
    }
  }

  /**
   * Retrieve candles from cache
   */
  async getCandlesFromCache(
    pair: string,
    granularity: string,
    startTime: number,
    endTime: number
  ): Promise<CandleData[] | null> {
    try {
      const response = await fetch(
        `/api/candles/${pair}/${granularity}?startTime=${startTime}&endTime=${endTime}`
      );

      if (response.ok) {
        const data = await response.json();
        return data.success ? data.data : null;
      }
      return null;
    } catch (error) {
      console.warn('Cache retrieval failed:', error);
      return null;
    }
  }

  /**
   * Clear cache for a specific pair and granularity
   */
  async clearCache(pair: string, granularity?: string): Promise<void> {
    try {
      const url = granularity
        ? `/api/cache-clear?pair=${pair}&granularity=${granularity}`
        : `/api/cache-clear?pair=${pair}`;

      await fetch(url, { method: 'DELETE' });
    } catch (error) {
      console.warn('Cache clear failed:', error);
    }
  }

  /**
   * Get cache stats
   */
  async getCacheStats(): Promise<{
    size: number;
    entries: number;
    lastUpdate: number;
  } | null> {
    try {
      const response = await fetch('/api/cache-stats');
      if (response.ok) {
        return await response.json();
      }
      return null;
    } catch (error) {
      console.warn('Failed to get cache stats:', error);
      return null;
    }
  }
}

/**
 * Export singleton instance
 */
export const chartCacheService = new ChartCacheService();
