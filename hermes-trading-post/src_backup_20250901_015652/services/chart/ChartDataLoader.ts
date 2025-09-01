/**
 * ChartDataLoader - Handles loading and fetching of chart data
 * Extracted from the monolithic chartDataFeed.ts
 */

import type { CandleData } from '../../types/coinbase';
import { CoinbaseAPI } from '../coinbaseApi';
import { IndexedDBCache } from '../indexedDBCache';
import { HistoricalDataLoader } from '../historicalDataLoader';

export class ChartDataLoader {
  private api: CoinbaseAPI;
  private cache: IndexedDBCache;
  private historicalLoader: HistoricalDataLoader;
  private loadingPromises = new Map<string, Promise<void>>();
  private pendingLoadOperations: Map<string, AbortController> = new Map();
  
  constructor() {
    this.api = new CoinbaseAPI();
    this.cache = new IndexedDBCache();
    this.historicalLoader = new HistoricalDataLoader(this.api, this.cache);
  }

  /**
   * Load progressive data for fast initial render
   */
  async loadProgressiveData(
    symbol: string,
    startTime: number,
    endTime: number,
    granularity: string,
    instanceId: string,
    isCurrentInstance: () => boolean
  ): Promise<CandleData[]> {
    if (!isCurrentInstance()) {
      console.log(`[ChartDataLoader] Aborting progressive load - instance ${instanceId} is no longer active`);
      return [];
    }
    
    // For 1m granularity, prioritize loading the visible range first
    if (granularity === '1m') {
      const visibleRangeSeconds = endTime - startTime;
      const recentStartTime = Math.max(startTime, endTime - Math.min(visibleRangeSeconds, 14400)); // Max 4 hours
      
      const recentData = await this.cache.getCachedCandles(
        symbol,
        granularity,
        recentStartTime,
        endTime
      );
      
      if (recentData.candles.length > 0) {
        return recentData.candles;
      }
    }
    
    // Fall back to regular loading
    return this.loadDataForRange(symbol, startTime, endTime, granularity);
  }

  /**
   * Load data for a specific time range
   */
  async loadDataForRange(
    symbol: string,
    startTime: number,
    endTime: number,
    granularity: string
  ): Promise<CandleData[]> {
    const cacheKey = `${symbol}-${granularity}-${startTime}-${endTime}`;
    
    // Check if already loading
    const existingPromise = this.loadingPromises.get(cacheKey);
    if (existingPromise) {
      await existingPromise;
      const result = await this.cache.getCachedCandles(symbol, granularity, startTime, endTime);
      return result.candles;
    }
    
    // Create abort controller for this operation
    const abortController = new AbortController();
    this.pendingLoadOperations.set(cacheKey, abortController);
    
    const loadPromise = this.performLoad(symbol, startTime, endTime, granularity, abortController.signal);
    this.loadingPromises.set(cacheKey, loadPromise);
    
    try {
      await loadPromise;
      const result = await this.cache.getCachedCandles(symbol, granularity, startTime, endTime);
      return result.candles;
    } finally {
      this.loadingPromises.delete(cacheKey);
      this.pendingLoadOperations.delete(cacheKey);
    }
  }

  /**
   * Perform the actual data loading
   */
  private async performLoad(
    symbol: string,
    startTime: number,
    endTime: number,
    granularity: string,
    signal: AbortSignal
  ): Promise<void> {
    if (signal.aborted) return;
    
    // Check cache first
    const cachedData = await this.cache.getCachedCandles(symbol, granularity, startTime, endTime);
    
    if (cachedData.gaps.length === 0) {
      return; // All data is cached
    }
    
    // Load missing data from API
    for (const gap of cachedData.gaps) {
      if (signal.aborted) break;
      
      try {
        const data = await this.api.getCandles(
          symbol,
          granularity,
          Math.floor(gap.start / 1000),
          Math.floor(gap.end / 1000)
        );
        
        if (data.length > 0 && !signal.aborted) {
          await this.cache.storeCandles(symbol, granularity, data);
        }
      } catch (error) {
        console.error(`[ChartDataLoader] Error loading data for gap:`, error);
      }
    }
  }

  /**
   * Refresh data for a specific range (bypass cache)
   */
  async refreshDataForRange(
    symbol: string,
    startTime: number,
    endTime: number,
    granularity: string
  ): Promise<CandleData[]> {
    try {
      const data = await this.api.getCandles(
        symbol,
        granularity,
        Math.floor(startTime / 1000),
        Math.floor(endTime / 1000)
      );
      
      if (data.length > 0) {
        await this.cache.storeCandles(symbol, granularity, data);
      }
      
      return data;
    } catch (error) {
      console.error(`[ChartDataLoader] Error refreshing data:`, error);
      // Fall back to cached data
      const cached = await this.cache.getCachedCandles(symbol, granularity, startTime, endTime);
      return cached.candles;
    }
  }

  /**
   * Load historical data for a number of days
   */
  async loadHistoricalData(
    symbol: string,
    granularity: string,
    days: number,
    instanceId: string,
    isCurrentInstance: () => boolean
  ): Promise<CandleData[]> {
    const endTime = Date.now();
    const startTime = endTime - (days * 86400000);
    
    return this.loadProgressiveData(
      symbol,
      startTime,
      endTime,
      granularity,
      instanceId,
      isCurrentInstance
    );
  }

  /**
   * Fetch the latest candle from API
   */
  async fetchLatestCandle(symbol: string, granularity: string): Promise<CandleData | null> {
    try {
      const endTime = Date.now();
      const granularitySeconds = this.getGranularitySeconds(granularity);
      const startTime = endTime - (granularitySeconds * 1000 * 2);
      
      const candles = await this.api.getCandles(
        symbol,
        granularity,
        Math.floor(startTime / 1000),
        Math.floor(endTime / 1000)
      );
      
      return candles.length > 0 ? candles[candles.length - 1] : null;
    } catch (error) {
      console.error(`[ChartDataLoader] Error fetching latest candle:`, error);
      return null;
    }
  }

  /**
   * Abort all pending load operations
   */
  abortPendingOperations(): void {
    console.log(`[ChartDataLoader] Aborting ${this.pendingLoadOperations.size} pending operations`);
    this.pendingLoadOperations.forEach((controller) => {
      controller.abort();
    });
    this.pendingLoadOperations.clear();
    this.loadingPromises.clear();
  }

  /**
   * Get granularity in seconds
   */
  private getGranularitySeconds(granularity: string): number {
    const granularityMap: Record<string, number> = {
      '1m': 60,
      '5m': 300,
      '15m': 900,
      '1h': 3600,
      '6h': 21600,
      '1D': 86400
    };
    return granularityMap[granularity] || 60;
  }
}