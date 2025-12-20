/**
 * @file chartDataService.ts
 * @description Unified chart data service consolidating multiple implementations
 * Phase 5D: Consolidate 6+ chart services into 3 coordinated services
 */

import { dataStore } from '../../stores/dataStore.svelte';
import type { CandleData } from '../../types/coinbase';

/**
 * Main Chart Data Service - unified API for all chart data operations
 */
export class ChartDataService {
  /**
   * Load chart data with caching and fallback
   */
  async loadChartData(pair: string, granularity: string, startTime: number, endTime: number): Promise<CandleData[]> {
    try {
      // 1. Try Redis cache first
      const cachedData = await this.loadFromCache(pair, granularity, startTime, endTime);
      if (cachedData && cachedData.length > 0) {
        return cachedData;
      }

      // 2. Fallback to Coinbase API
      const apiData = await this.loadFromAPI(pair, granularity, startTime, endTime);

      // 3. Cache for future requests
      await this.cacheData(pair, granularity, apiData);

      return apiData;
    } catch (error) {
      console.error('Failed to load chart data:', error);
      throw error;
    }
  }

  /**
   * Load from cache
   */
  private async loadFromCache(pair: string, granularity: string, startTime: number, endTime: number): Promise<CandleData[] | null> {
    try {
      const response = await fetch(`/api/candles/${pair}/${granularity}?startTime=${startTime}&endTime=${endTime}`);
      if (response.ok) {
        const data = await response.json();
        return data.success ? data.data : null;
      }
      return null;
    } catch (error) {
      console.warn('Cache load failed:', error);
      return null;
    }
  }

  /**
   * Load from Coinbase API
   */
  private async loadFromAPI(pair: string, granularity: string, startTime: number, endTime: number): Promise<CandleData[]> {
    const granularityMap: Record<string, number> = {
      '1m': 60, '5m': 300, '15m': 900, '1h': 3600, '6h': 21600, '1d': 86400
    };
    const granularitySeconds = granularityMap[granularity] || 60;

    const url = `https://api.exchange.coinbase.com/products/${pair}/candles?start=${startTime}&end=${endTime}&granularity=${granularitySeconds}`;
    const response = await fetch(url);
    const candleData = await response.json();

    if (!Array.isArray(candleData) || candleData.length === 0) {
      throw new Error(`No data from Coinbase for ${pair}`);
    }

    return candleData
      .map(([time, low, high, open, close, volume]) => ({
        time: Math.floor(time),
        open: parseFloat(open),
        high: parseFloat(high),
        low: parseFloat(low),
        close: parseFloat(close),
        volume: parseFloat(volume)
      }))
      .sort((a, b) => a.time - b.time);
  }

  /**
   * Cache data for future requests
   */
  private async cacheData(pair: string, granularity: string, data: CandleData[]): Promise<void> {
    try {
      const startTime = data[0]?.time || 0;
      const endTime = data[data.length - 1]?.time || 0;

      await fetch('/api/cache-candles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pair, granularity, startTime, endTime, data })
      });
    } catch (error) {
      console.warn('Cache store failed:', error);
      // Continue even if caching fails
    }
  }

  /**
   * Invalidate cache for a pair
   */
  async invalidateCache(pair: string, granularity?: string): Promise<void> {
    try {
      const url = granularity
        ? `/api/cache-clear?pair=${pair}&granularity=${granularity}`
        : `/api/cache-clear?pair=${pair}`;

      await fetch(url, { method: 'DELETE' });
    } catch (error) {
      console.warn('Cache invalidation failed:', error);
    }
  }
}

/**
 * Export singleton instance
 */
export const chartDataService = new ChartDataService();
