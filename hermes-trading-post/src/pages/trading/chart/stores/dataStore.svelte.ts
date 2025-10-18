import type { CandlestickData } from 'lightweight-charts';

// Extend CandlestickData to include volume
interface CandlestickDataWithVolume extends CandlestickData {
  volume?: number;
}
import type { WebSocketCandle } from '../types/data.types';
import { RedisChartService } from '../services/RedisChartService';
import { chartIndexedDBCache } from '../services/ChartIndexedDBCache';
import { ChartDebug } from '../utils/debug';
import { chartStore } from './chartStore.svelte';
import { orderbookStore } from '../../orderbook/stores/orderbookStore.svelte';

class DataStore {
  private dataService = new RedisChartService();
  private _candles = $state<CandlestickDataWithVolume[]>([]);
  private _visibleCandles = $state<CandlestickDataWithVolume[]>([]);
  private _latestPrice = $state<number | null>(null);
  private _isNewCandle = $state<boolean>(false);
  private _priceUpdateLoggedOnce = false;
  private _currentPair = $state<string>('BTC-USD'); // Track current pair
  private _currentGranularity = $state<string>('1m'); // Track current granularity
  private _dataStats = $state({
    totalCount: 0,
    totalDatabaseCount: 0, // Total across ALL granularities
    visibleCount: 0,
    oldestTime: null as number | null,
    newestTime: null as number | null,
    lastUpdate: null as number | null,
    loadingStatus: 'idle' as 'idle' | 'fetching' | 'storing' | 'error' | 'rate-limited'
  });

  private realtimeUnsubscribe: (() => void) | null = null;
  private orderbookPriceUnsubscribe: (() => void) | null = null;
  private newCandleTimeout: NodeJS.Timeout | null = null;

  // Subscription mechanism for plugins
  private dataUpdateCallbacks: Set<() => void> = new Set();
  private historicalDataLoadedCallbacks: Set<() => void> = new Set();

  // Helper method to get current chart config
  private getCurrentConfig() {
    return {
      pair: this._currentPair,
      granularity: this._currentGranularity
    };
  }

  // Getters
  get candles() {
    return this._candles;
  }

  get visibleCandles() {
    return this._visibleCandles;
  }

  get latestPrice() {
    return this._latestPrice;
  }

  get isNewCandle() {
    return this._isNewCandle;
  }

  get stats() {
    return this._dataStats;
  }

  get isEmpty() {
    return this._candles.length === 0;
  }

  /**
   * 🚀 PERF: Load cached candles from Redis on mount
   * Enables instant chart display - refreshes no longer have loading delay
   * WebSocket will continue streaming live updates
   */
  async hydrateFromCache(pair: string = 'BTC-USD', granularity: string = '1m', hours: number = 24) {
    try {
      this._dataStats.loadingStatus = 'fetching';
      console.log(`💾 [DataStore] Hydrating from Redis cache for ${pair}:${granularity} (${hours}h)`);

      const response = await fetch(`/api/candles/${pair}/${granularity}?hours=${hours}`);

      if (!response.ok) {
        console.log(`⏭️ [DataStore] No cached candles available (HTTP ${response.status})`);
        this._dataStats.loadingStatus = 'idle';
        return;
      }

      const result = await response.json();

      if (!result.success || !result.data || result.data.length === 0) {
        console.log(`⏭️ [DataStore] Cached candles are empty`);
        this._dataStats.loadingStatus = 'idle';
        return;
      }

      // Process cached candles - MUST be sorted for lightweight-charts
      // Sort by time and remove any invalid entries
      const sortedCandles = result.data
        .filter(c => c && typeof c.time === 'number' && c.time > 0 && c.close > 0)
        .sort((a, b) => a.time - b.time);

      this._candles = sortedCandles;
      this._visibleCandles = sortedCandles;
      this._currentPair = pair;
      this._currentGranularity = granularity;

      // Update stats
      this._dataStats.totalCount = sortedCandles.length;
      this._dataStats.visibleCount = sortedCandles.length;
      if (sortedCandles.length > 0) {
        this._dataStats.oldestTime = sortedCandles[0].time;
        this._dataStats.newestTime = sortedCandles[sortedCandles.length - 1].time;
      }
      this._dataStats.lastUpdate = Date.now();
      this._dataStats.loadingStatus = 'idle';

      console.log(`✅ [DataStore] Cache hydration complete: ${result.data.length} candles loaded from Redis`);

      // Notify subscribers
      this.notifyDataUpdate();
    } catch (error) {
      console.error(`❌ [DataStore] Failed to hydrate from cache:`, error);
      this._dataStats.loadingStatus = 'error';
    }
  }


  // Fill only recent data gaps (last few hours)
  private async fillRecentDataGaps() {
    try {
      const config = this.getCurrentConfig();
      const granularitySeconds = config.granularity === '5m' ? 300 : 60;

      // Only check last 6 hours for missing data
      const endTime = Math.floor(Date.now() / 1000);
      const startTime = endTime - (6 * 60 * 60); // 6 hours ago

      const response = await fetch(`/api/coinbase/products/BTC-USD/candles?granularity=${granularitySeconds}&start=${startTime}&end=${endTime}`);

      if (response.ok) {
        const candles = await response.json();
        if (candles.length > 0) {
          // Store in Redis via the backend API
          await fetch('/api/chart/store-candles', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              pair: config.pair,
              granularity: config.granularity,
              candles: candles
            })
          });
        }
      }
    } catch (error) {
      console.error('❌ Error filling recent data gaps:', error);
    }
  }

  // Data management with IndexedDB cache + delta sync
  async loadData(
    pair: string,
    granularity: string,
    startTime: number,
    endTime: number,
    maxCandles?: number
  ): Promise<void> {
    const perfStart = performance.now();

    // Update current pair/granularity
    this._currentPair = pair;
    this._currentGranularity = granularity;

    try {
      await this.dataService.initialize();

      // 🚀 PHASE 1: Check IndexedDB cache first (instant load)
      const cachedData = await chartIndexedDBCache.get(pair, granularity);

      if (cachedData && cachedData.candles.length > 0) {
        // ✅ Cache hit! Show cached data immediately (0ms perceived load time)
        ChartDebug.log(`⚡ INSTANT LOAD from IndexedDB: ${cachedData.candles.length} candles (${performance.now() - perfStart}ms)`);

        this.setCandles(cachedData.candles);
        this.updateStats();

        // 🔄 DELTA SYNC: Only fetch new candles since last cache
        const lastCandleTime = cachedData.lastCandleTime;
        const now = Math.floor(Date.now() / 1000);
        const timeSinceLastCandle = now - lastCandleTime;

        // If cache is fresh (< 5 minutes old), skip network fetch
        const isFresh = await chartIndexedDBCache.isFresh(pair, granularity);

        if (isFresh && timeSinceLastCandle < 300) {
          ChartDebug.log(`✅ Cache is fresh, skipping network fetch`);

          // Still update DB count
          setTimeout(() => {
            this.updateDatabaseCount();
          }, 100);

          return;
        }

        // Cache is stale, fetch only NEW candles (delta sync)
        ChartDebug.log(`🔄 Fetching delta: from ${new Date(lastCandleTime * 1000).toISOString()} to now`);

        const deltaData = await this.dataService.fetchCandles({
          pair,
          granularity,
          start: lastCandleTime + 60, // Start from next candle after last cached
          end: endTime,
          limit: 1000 // Should be small (only recent candles)
        });

        if (deltaData.length > 0) {
          ChartDebug.log(`📊 Delta sync: fetched ${deltaData.length} new candles`);

          // Convert Candle[] to CandlestickData[] for cache
          const deltaAsChartData: CandlestickDataWithVolume[] = deltaData.map(c => ({
            time: c.time as any,
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close,
            volume: c.volume
          }));

          // Merge delta with cached data
          await chartIndexedDBCache.appendCandles(pair, granularity, deltaAsChartData);

          // Update UI with merged data
          const mergedCandles = [...cachedData.candles, ...deltaAsChartData].sort(
            (a, b) => (a.time as number) - (b.time as number)
          );

          this.setCandles(mergedCandles as CandlestickDataWithVolume[]);
          this.updateStats();
        }

        ChartDebug.log(`⚡ Total load time with delta sync: ${performance.now() - perfStart}ms`);

      } else {
        // ❌ Cache miss - fetch full data from backend
        ChartDebug.log(`❌ Cache miss - fetching full data from backend`);

        const data = await this.dataService.fetchCandles({
          pair,
          granularity,
          start: startTime,
          end: endTime,
          limit: maxCandles || 10000
        });

        this.setCandles(data);
        this.updateStats();

        // Cache the data for next time
        if (data.length > 0) {
          await chartIndexedDBCache.set(pair, granularity, data);
          ChartDebug.log(`💾 Cached ${data.length} candles to IndexedDB`);
        }

        ChartDebug.log(`⏱️ Full load time (cache miss): ${performance.now() - perfStart}ms`);
      }

      // Delay DB count update to avoid interfering with initial render
      setTimeout(() => {
        this.updateDatabaseCount();
      }, 100);

    } catch (error) {
      console.error(`❌ [DataStore] Error loading data for ${pair}/${granularity}:`, error);
      throw error;
    }
  }

  async reloadData(startTime: number, endTime: number): Promise<void> {
    const config = this.getCurrentConfig();
    const data = await this.dataService.fetchCandles({
      pair: config.pair,
      granularity: config.granularity,
      start: startTime,
      end: endTime,
      limit: 5000
    });

    this.setCandles(data);
    this.updateStats();

    // Update IndexedDB cache
    if (data.length > 0) {
      await chartIndexedDBCache.set(config.pair, config.granularity, data);
    }
  }

  async fetchGapData(fromTime: number, toTime: number): Promise<CandlestickData[]> {
    ChartDebug.log(`Fetching gap data from ${new Date(fromTime * 1000).toISOString()} to ${new Date(toTime * 1000).toISOString()}`);
    
    try {
      // Fetch data for the gap period from Redis
      const config = this.getCurrentConfig();
      const gapData = await this.dataService.fetchCandles({
        pair: config.pair,
        granularity: config.granularity,
        start: fromTime,
        end: toTime,
        limit: 5000
      });
      
      // Filter out any candles we already have
      const existingTimes = new Set(this._candles.map(c => c.time));
      const newCandles = gapData.filter(candle => !existingTimes.has(candle.time));
      
      ChartDebug.log(`Gap fetch returned ${gapData.length} candles, ${newCandles.length} are new`);
      
      return newCandles;
    } catch (error) {
      ChartDebug.error('Error fetching gap data:', error);
      return [];
    }
  }

  setCandles(candles: CandlestickDataWithVolume[]) {
    // Filter out invalid candles (must have valid time > 0) and sort
    // This prevents lightweight-charts assertion errors
    const validCandles = candles.filter(c =>
      c &&
      typeof c.time === 'number' &&
      c.time > 0 &&
      typeof c.close === 'number' &&
      c.close > 0
    );

    // Ensure candles are sorted by time (required by lightweight-charts)
    const sortedCandles = [...validCandles].sort((a, b) => (a.time as number) - (b.time as number));

    this._candles = sortedCandles;
    this._visibleCandles = sortedCandles; // Initially all candles are visible

    // Update latest price
    if (sortedCandles.length > 0) {
      const lastCandle = sortedCandles[sortedCandles.length - 1];
      this._latestPrice = lastCandle.close;
    }

    // Update stats to trigger UI updates
    this.updateStats();

    // Notify plugins of data update
    this.notifyDataUpdate();
  }

  async fetchAndPrependHistoricalData(additionalCandleCount: number = 300): Promise<number> {
    try {
      if (this._candles.length === 0) return 0;
      
      // Calculate start time for additional data
      const config = this.getCurrentConfig();
      const firstCandle = this._candles[0];
      const firstCandleTime = firstCandle.time as number;
      
      // Get granularity seconds
      const granularitySeconds = config.granularity === '5m' ? 300 : 
                                config.granularity === '15m' ? 900 :
                                config.granularity === '30m' ? 1800 :
                                config.granularity === '1h' ? 3600 : 60; // default to 1m
      
      const fetchStartTime = firstCandleTime - (additionalCandleCount * granularitySeconds);
      
      // Fetch additional historical data from Redis
      const historicalData = await this.dataService.fetchCandles({
        pair: config.pair,
        granularity: config.granularity,
        start: fetchStartTime,
        end: firstCandleTime - granularitySeconds, // Don't overlap with existing data
        limit: additionalCandleCount
      });

      if (historicalData.length > 0) {
        // Merge historical data with existing data (prepend historical data)
        const mergedCandles = [...historicalData, ...this._candles];

        // Sort by time to ensure proper order (should already be sorted, but safety check)
        mergedCandles.sort((a, b) => (a.time as number) - (b.time as number));

        // Use setCandles to ensure proper reactivity and notifications
        this.setCandles(mergedCandles);

        // Notify plugins that historical data was loaded (separate from real-time updates)
        this.notifyHistoricalDataLoaded();

        return historicalData.length;
      }

      return 0;
    } catch (error) {
      console.error('❌ Error fetching historical data:', error);
      return 0;
    }
  }

  updateVisibleRange(from: number, to: number) {
    this._visibleCandles = this._candles.filter(
      candle => candle.time >= from && candle.time <= to
    );

    this._dataStats.visibleCount = this._visibleCandles.length;
  }

  // Realtime updates
  subscribeToRealtime(
    pair: string,
    granularity: string,
    onUpdate?: (candle: CandlestickData) => void,
    onReconnect?: () => void
  ) {
    console.log('[DataStore] subscribeToRealtime called for', pair, granularity);

    // Only unsubscribe if we have an active subscription
    // ChartDataService.subscribeToRealtime() will handle its own cleanup
    if (this.realtimeUnsubscribe) {
      this.realtimeUnsubscribe();
      this.realtimeUnsubscribe = null;
    }

    this.realtimeUnsubscribe = this.dataService.subscribeToRealtime(
      pair,
      granularity,
      (update: WebSocketCandle) => {
        // Validate that update.time is a valid number (Unix timestamp in seconds)
        if (!update.time || typeof update.time !== 'number' || update.time <= 0) {
          console.warn(`⚠️ Invalid candle time from WebSocket:`, update);
          return;
        }

        const candleData: CandlestickData = {
          time: update.time,
          open: update.open,
          high: update.high,
          low: update.low,
          close: update.close,
          volume: update.volume || 0
        };

        // Update or add candle IN-PLACE without triggering Svelte reactivity on historical candles
        const existingIndex = this._candles.findIndex(c => c.time === update.time);

        if (existingIndex >= 0) {
          // Update existing candle IN-PLACE (last candle only)
          // This is safe because it's always the most recent candle
          const lastIndex = this._candles.length - 1;
          if (existingIndex === lastIndex) {
            // Update the last candle directly - this won't trigger historical candle re-renders
            this._candles[lastIndex] = candleData;
          }
        } else {
          // New candle - append without replacing the entire array
          this._candles.push(candleData);
        }

        // Update latest price for status display
        this._latestPrice = update.close;

        // Update stats timestamp only
        this._dataStats.lastUpdate = Date.now();

        // Notify data update callbacks for price updates (e.g., chart header)
        this.notifyDataUpdate();

        // Notify callback if provided
        if (onUpdate) {
          onUpdate(candleData);
        }
      },
      onReconnect
    );

    // ALSO subscribe to orderbook L2 data for instant price updates
    // This is MUCH faster than waiting for candle/ticker updates
    if (this.orderbookPriceUnsubscribe) {
      this.orderbookPriceUnsubscribe();
    }

    this.orderbookPriceUnsubscribe = orderbookStore.subscribeToPriceUpdates((price: number) => {
      // Update latest price immediately from L2 data
      this._latestPrice = price;
      this._dataStats.lastUpdate = Date.now();

      // Log only once to confirm price updates are working
      if (!this._priceUpdateLoggedOnce) {
        console.log(`✅ [DataStore] L2 price updates active: $${price.toFixed(2)}`);
        this._priceUpdateLoggedOnce = true;
      }

      // ALSO update the current candle with L2 price for instant chart updates
      if (this._candles.length > 0) {
        const lastCandle = this._candles[this._candles.length - 1];

        // Update the last candle's close, high, and low based on L2 price
        const updatedCandle = {
          ...lastCandle,
          close: price,
          high: Math.max(lastCandle.high, price),
          low: Math.min(lastCandle.low, price)
        };

        // Update in place for reactivity
        this._candles[this._candles.length - 1] = updatedCandle;
      }

      // Notify data update callbacks so header/footer AND chart update
      this.notifyDataUpdate();
    });
  }

  unsubscribeFromRealtime() {
    if (this.realtimeUnsubscribe) {
      this.realtimeUnsubscribe();
      this.realtimeUnsubscribe = null;
    }

    // Also unsubscribe from orderbook price updates
    if (this.orderbookPriceUnsubscribe) {
      this.orderbookPriceUnsubscribe();
      this.orderbookPriceUnsubscribe = null;
    }
  }

  private triggerNewCandle() {
    this._isNewCandle = true;
    
    // Clear existing timeout
    if (this.newCandleTimeout) {
      clearTimeout(this.newCandleTimeout);
    }
    
    // Reset after 2 seconds
    this.newCandleTimeout = setTimeout(() => {
      this._isNewCandle = false;
    }, 2000);
  }

  private updateStats() {
    const count = this._candles.length;
    
    // Update all stats EXCEPT totalCount - that's managed separately by updateDatabaseCount
    this._dataStats.visibleCount = this._visibleCandles.length;
    this._dataStats.oldestTime = count > 0 ? this._candles[0].time as number : null;
    this._dataStats.newestTime = count > 0 ? this._candles[count - 1].time as number : null;
    this._dataStats.lastUpdate = Date.now();
    
    // totalCount is NOT updated here - only by updateDatabaseCount()
  }
  
  // Get actual count from database via the existing Redis service
  async updateDatabaseCount() {
    try {
      const config = this.getCurrentConfig();

      // Use dynamic host for network access
      const backendHost = (import.meta.env.VITE_BACKEND_HOST as string) || window.location.hostname || 'localhost';
      const backendUrl = `http://${backendHost}:4828`;

      // Get total count across ALL granularities
      const totalResponse = await fetch(`${backendUrl}/api/trading/total-candles?pair=${config.pair}`);
      if (totalResponse.ok) {
        const totalData = await totalResponse.json();
        if (totalData.success) {
          this._dataStats.totalDatabaseCount = totalData.data.totalCandles;
        }
      }

      // Also get count for current granularity
      const response = await this.dataService.fetchCandlesWithMetadata({
        pair: config.pair,
        granularity: config.granularity,
        limit: 1 // We only need metadata, not actual candles
      });

      if (response && response.metadata) {
        // Use storageMetadata.totalCandles if available, otherwise metadata.totalCandles
        const dbCount = response.metadata.storageMetadata?.totalCandles || response.metadata.totalCandles || 0;
        this._dataStats.totalCount = dbCount;
      }
    } catch (error) {
      console.error('Error getting database count:', error);
    }
  }

  // Redis statistics
  async getStorageStats() {
    return await this.dataService.getStorageStats();
  }

  // Cleanup
  destroy() {
    this.unsubscribeFromRealtime();
    
    if (this.newCandleTimeout) {
      clearTimeout(this.newCandleTimeout);
    }
    
    this.dataService.disconnect();
  }

  reset() {
    this._candles = [];
    this._visibleCandles = [];
    this._latestPrice = null;
    this._isNewCandle = false;
    this._dataStats = {
      totalCount: 0,
      totalDatabaseCount: 0,
      visibleCount: 0,
      oldestTime: null,
      newestTime: null,
      lastUpdate: null,
      loadingStatus: 'idle'
    };
  }

  // Debug method to check current state
  debug() {
    // Make debug available globally for testing
    (window as any).debugDataStore = () => this.debug();

    return this._candles;
  }

  // Plugin subscription methods
  onDataUpdate(callback: () => void): () => void {
    this.dataUpdateCallbacks.add(callback);
    // Return unsubscribe function
    return () => {
      this.dataUpdateCallbacks.delete(callback);
    };
  }

  onHistoricalDataLoaded(callback: () => void): () => void {
    this.historicalDataLoadedCallbacks.add(callback);
    // Return unsubscribe function
    return () => {
      this.historicalDataLoadedCallbacks.delete(callback);
    };
  }

  private notifyDataUpdate() {
    this.dataUpdateCallbacks.forEach((callback) => {
      try {
        callback();
      } catch (error) {
        console.error(`❌ [DataStore] Error in data update callback:`, error);
      }
    });
  }

  private notifyHistoricalDataLoaded() {
    this.historicalDataLoadedCallbacks.forEach((callback) => {
      try {
        callback();
      } catch (error) {
        console.error(`❌ [DataStore] Error in historical data callback:`, error);
      }
    });
  }

  /**
   * Get the WebSocket connection for other components to use
   */
  getWebSocket(): WebSocket | null {
    return this.dataService.ws;
  }
}

// Create and export singleton
export const dataStore = new DataStore();