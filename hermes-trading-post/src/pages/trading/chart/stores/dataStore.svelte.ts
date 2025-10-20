import type { CandlestickData } from 'lightweight-charts';

// Extend CandlestickData to include volume
interface CandlestickDataWithVolume extends CandlestickData {
  volume?: number;
}
import type { WebSocketCandle } from '../types/data.types';
import { chartCacheService } from '../../../../shared/services/chartCacheService';
import { chartRealtimeService } from '../../../../shared/services/chartRealtimeService';
import { chartIndexedDBCache } from '../services/ChartIndexedDBCache';
import { ChartDebug } from '../utils/debug';
import { chartStore } from './chartStore.svelte';
import { orderbookStore } from '../../orderbook/stores/orderbookStore.svelte';
import { dataUpdateNotifier, historicalDataNotifier } from '../../../../services/NotificationBatcher';
import { cacheManager } from './services/CacheManager';
import { dataTransformations } from './services/DataTransformations';
import { dataStoreSubscriptions } from './services/DataStoreSubscriptions';
import { typedArrayCache } from '../services/TypedArrayDataCache';

class DataStore {
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
  private l2SubscriptionCheckInterval: NodeJS.Timeout | null = null;  // Track the candle-loading check interval

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
      // PERF: Disabled - console.log(`💾 [DataStore] Hydrating from Redis cache for ${pair}:${granularity} (${hours}h)`);

      const response = await fetch(`/api/candles/${pair}/${granularity}?hours=${hours}`);

      if (!response.ok) {
        // PERF: Disabled - console.log(`⏭️ [DataStore] No cached candles available (HTTP ${response.status})`);
        this._dataStats.loadingStatus = 'idle';
        return;
      }

      const result = await response.json();

      if (!result.success || !result.data || result.data.length === 0) {
        // PERF: Disabled - console.log(`⏭️ [DataStore] Cached candles are empty`);
        this._dataStats.loadingStatus = 'idle';
        return;
      }

      // Use DataTransformations service to process and validate candles
      const sortedCandles = dataTransformations.transformCandles(result.data);

      if (sortedCandles.length < result.data.length) {
        // PERF: Disabled - console.warn(`⚠️ [DataStore] Filtered out ${result.data.length - sortedCandles.length} invalid candles from cache`);
      }

      this._candles = sortedCandles;
      this._visibleCandles = sortedCandles;
      this._currentPair = pair;
      this._currentGranularity = granularity;

      // Update stats
      this._dataStats.totalCount = sortedCandles.length;
      this._dataStats.visibleCount = sortedCandles.length;
      if (sortedCandles.length > 0) {
        this._dataStats.oldestTime = sortedCandles[0].time as number;
        this._dataStats.newestTime = sortedCandles[sortedCandles.length - 1].time as number;
      }
      this._dataStats.lastUpdate = Date.now();
      this._dataStats.loadingStatus = 'idle';

      // PERF: Disabled - console.log(`✅ [DataStore] Cache hydration complete: ${result.data.length} candles loaded from Redis`);

      // Notify subscribers
      this.notifyDataUpdate();
    } catch (error) {
      // PERF: Disabled - console.error(`❌ [DataStore] Failed to hydrate from cache:`, error);
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
      // PERF: Disabled - console.error('❌ Error filling recent data gaps:', error);
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
      await chartCacheService.initialize();

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

          // Stats are already updated locally via updateStats(), no need for backend API call
          // (This was causing 30-second polling timeout errors)

          return;
        }

        // Cache is stale, fetch only NEW candles (delta sync)
        ChartDebug.log(`🔄 Fetching delta: from ${new Date(lastCandleTime * 1000).toISOString()} to now`);

        const deltaData = await chartCacheService.fetchCandles({
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

        const data = await chartCacheService.fetchCandles({
          pair,
          granularity,
          start: startTime,
          end: endTime,
          limit: maxCandles || 10000
        });

        // ⚡ PHASE 8A: Fallback if backend returns empty (timeout/error occurred)
        if (data.length === 0) {
          ChartDebug.log(`⚠️ Backend fetch returned empty - checking for any cached data as fallback`);
          // Try to get any available cached data as fallback
          const anyCache = await chartIndexedDBCache.get(pair, granularity);
          if (anyCache && anyCache.candles.length > 0) {
            ChartDebug.log(`📊 Using stale cache as fallback: ${anyCache.candles.length} candles`);
            this.setCandles(anyCache.candles);
            this.updateStats();
            return;
          }
        }

        this.setCandles(data);
        this.updateStats();

        // Cache the data for next time
        if (data.length > 0) {
          await chartIndexedDBCache.set(pair, granularity, data);
          ChartDebug.log(`💾 Cached ${data.length} candles to IndexedDB`);
        }

        ChartDebug.log(`⏱️ Full load time (cache miss): ${performance.now() - perfStart}ms`);
      }

      // Stats are updated locally via updateStats(), no need for backend API call
      // This prevents polling errors and keeps stats responsive

    } catch (error) {
      // ⚡ PHASE 8A: If error occurs, try to use cached data as fallback
      ChartDebug.log(`⚠️ Error during chart data load: ${error}. Attempting to use cached data...`);
      const cachedData = await chartIndexedDBCache.get(pair, granularity);
      if (cachedData && cachedData.candles.length > 0) {
        ChartDebug.log(`📊 Using cached data as fallback: ${cachedData.candles.length} candles`);
        this.setCandles(cachedData.candles);
        this.updateStats();
        return;
      }
      // PERF: Disabled - console.error(`❌ [DataStore] Error loading data for ${pair}/${granularity}:`, error);
      throw error;
    }
  }

  async reloadData(startTime: number, endTime: number): Promise<void> {
    const config = this.getCurrentConfig();
    // 🚀 PERF: Remove hard-coded candle limits during refresh
    // Use 50000 limit to accommodate large historical ranges without truncation
    const data = await chartCacheService.fetchCandles({
      pair: config.pair,
      granularity: config.granularity,
      start: startTime,
      end: endTime,
      limit: 50000  // Increased from 5000 to prevent missing candles on refresh
    });

    // ⚡ PHASE 8A: Fallback to cached data if backend returns empty on reload
    if (data.length === 0) {
      ChartDebug.log(`⚠️ Reload fetch returned empty - checking cached data as fallback`);
      const cachedData = await chartIndexedDBCache.get(config.pair, config.granularity);
      if (cachedData && cachedData.candles.length > 0) {
        ChartDebug.log(`📊 Using cached data as fallback for reload: ${cachedData.candles.length} candles`);
        this.setCandles(cachedData.candles);
        this.updateStats();
        return;
      }
    }

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
      const gapData = await chartCacheService.fetchCandles({
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
    // Use DataTransformations service to validate, normalize, and sort candles
    const sortedCandles = dataTransformations.transformCandles(candles);

    if (sortedCandles.length < candles.length) {
      // PERF: Disabled - console.warn(`⚠️ [DataStore] Filtered out ${candles.length - sortedCandles.length} invalid candles`);
    }

    this._candles = sortedCandles;
    this._visibleCandles = sortedCandles; // Initially all candles are visible

    // ⚡ PHASE 2: Automatically cache data in TypedArrays for memory optimization
    typedArrayCache.store(this._currentPair, this._currentGranularity, sortedCandles);

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

  /**
   * Add a single new candle (for real-time updates)
   * This is used when new candles arrive via WebSocket
   */
  addCandle(candle: CandlestickDataWithVolume) {
    // Use service transformation for validation and normalization
    const transformed = dataTransformations.transformCandles([candle]);
    if (transformed.length === 0) {
      return; // Validation failed
    }

    const validCandle = transformed[0];

    // 🚫 CRITICAL: NEVER add candles with time=0 (ticker updates) to the array
    if (validCandle.time === 0) {
      return; // Ticker update, not a new candle
    }

    // Add to candles array
    this._candles.push(validCandle);
    this._visibleCandles.push(validCandle);

    // Update latest price
    this._latestPrice = validCandle.close;

    // 🔥 PERFORMANCE: Only update stats on REAL CANDLES, not on every ticker update
    // Stats update happens rarely (new candle every 1-60 seconds depending on granularity)
    // Tickers arrive 10-100x per second, so NOT updating on every ticker = huge performance win
    // This prevents stats counter from thrashing and blocking the UI thread

    // ⚡ SVELTE 5 OPTIMIZATION: Update individual properties instead of spreading
    // Spreading object triggers reactive cascade even if only some properties changed
    // Direct assignment: No reactive cascade, only affects properties that changed
    this._dataStats.totalCount = this._candles.length;
    this._dataStats.newestTime = validCandle.time as number;
    this._dataStats.lastUpdate = Date.now();
    this._dataStats.visibleCount = this._visibleCandles.length;

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
      const historicalData = await chartCacheService.fetchCandles({
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
      // PERF: Disabled - console.error('❌ Error fetching historical data:', error);
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
    // PERF: Disabled - console.log('[DataStore] subscribeToRealtime called for', pair, granularity);

    // Only unsubscribe if we have an active subscription
    // ChartDataService.subscribeToRealtime() will handle its own cleanup
    if (this.realtimeUnsubscribe) {
      this.realtimeUnsubscribe();
      this.realtimeUnsubscribe = null;
    }

    this.realtimeUnsubscribe = chartRealtimeService.subscribeToRealtime(
      pair,
      granularity,
      (update: WebSocketCandle) => {
        // Allow ticker updates with time=0 (they update the current open candle)
        // Only reject completely invalid data
        if (!update || typeof update.open !== 'number' || typeof update.close !== 'number') {
          return;
        }

        // For ticker updates (time=0), pass them through to the callback handler
        // which will update the current open candle with new price data
        // For full candle updates (time > 0), store them in the candles array
        if (update.time && update.time > 0) {
          // Full candle update with valid timestamp
          // 🚫 CRITICAL: Normalize timestamps to prevent time=0 from getting mixed in
          let normalizedTime = update.time;
          if (typeof update.time === 'number' && update.time > 10000000000) {
            normalizedTime = Math.floor(update.time / 1000);
          }

          // Reject candles with invalid timestamps
          if (normalizedTime < 1577836800 || normalizedTime > 1893456000) {
            // PERF: Disabled - console.warn('⚠️ [DataStore] Rejecting candle with invalid time:', normalizedTime);
            return;
          }

          const candleData: CandlestickData = {
            time: normalizedTime as any,
            open: update.open,
            high: update.high,
            low: update.low,
            close: update.close,
            volume: update.volume || 0
          };

          // Update or add candle IN-PLACE without triggering Svelte reactivity on historical candles
          const existingIndex = this._candles.findIndex(c => c.time === normalizedTime);

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
            // 🚫 CRITICAL: Only append if time > 0 (never append ticker updates)
            if (normalizedTime > 0) {
              this._candles.push(candleData);

              // ⚡ SVELTE 5 OPTIMIZATION: Update individual properties instead of spreading
              // Direct assignment avoids reactive cascade overhead
              this._dataStats.totalCount = this._candles.length;
              this._dataStats.newestTime = candleData.time as number;
              this._dataStats.lastUpdate = Date.now();
              this._dataStats.visibleCount = this._visibleCandles.length;
            }
          }
        }

        // Update latest price for status display (for both ticker AND full candle updates)
        this._latestPrice = update.close;

        // ⚡ SVELTE 5 OPTIMIZATION: Only update lastUpdate property directly
        // This ensures the UI responds immediately to price changes
        // Single property update = no reactive cascade overhead
        this._dataStats.lastUpdate = Date.now();

        // Notify data update callbacks for price updates (e.g., chart header)
        this.notifyDataUpdate();

        // Notify callback with the update (ticker or full candle)
        // The callback handler will decide how to handle it
        if (onUpdate) {
          onUpdate(update as CandlestickData);
        }
      },
      onReconnect
    );

    // ALSO subscribe to orderbook L2 data for instant price updates
    // This is MUCH faster than waiting for candle/ticker updates
    // ⚠️ WAIT: Only subscribe to L2 if we already have candles loaded
    // Otherwise we'll get updates for empty array (race condition)
    if (this.orderbookPriceUnsubscribe) {
      this.orderbookPriceUnsubscribe();
    }

    // Check if candles are loaded; if not, wait before subscribing
    const subscribeToL2 = () => {
      console.log(`🔌 [L2 Bridge] Subscribing to L2 prices (candles=${this._candles.length})`);
      this.orderbookPriceUnsubscribe = orderbookStore.subscribeToPriceUpdates((price: number) => {
        // Update latest price immediately from L2 data
        this._latestPrice = price;

        // Log every L2 update to debug chart latency
        console.log(`📊 [L2 Bridge] Price update: $${price.toFixed(2)}, candles.length=${this._candles.length}`);

        // ⚡ INSTANT UPDATE: Update candle immediately with L2 price (no RAF delay)
        // Chart must update as fast as orderbook - every L2 tick
        if (this._candles.length > 0) {
          const lastCandle = this._candles[this._candles.length - 1];
          const updatedCandle = {
            ...lastCandle,
            close: price,
            high: Math.max(lastCandle.high, price),
            low: Math.min(lastCandle.low, price)
          };

          // Update in place for reactivity
          this._candles[this._candles.length - 1] = updatedCandle;
          console.log(`📈 [L2 Bridge] Candle updated: close=${price}, high=${updatedCandle.high}, low=${updatedCandle.low}`);
        } else {
          console.log(`⚠️  [L2 Bridge] No candles to update!`);
        }

        // Update stats and notify subscribers IMMEDIATELY (no batching delay)
        this._dataStats.lastUpdate = Date.now();
        console.log(`🔔 [L2 Bridge] Calling notifyDataUpdate(true) with ${this.dataUpdateCallbacks.size} callbacks`);
        this.notifyDataUpdate(true);  // ✅ immediate=true skips 16ms batcher
      });
    };

    // Subscribe immediately if candles are already loaded, otherwise defer
    if (this._candles.length > 0) {
      subscribeToL2();
    } else {
      console.log(`⏱️  [L2 Bridge] Deferring subscription - waiting for candles to load`);
      // Clear any existing check interval
      if (this.l2SubscriptionCheckInterval) {
        clearInterval(this.l2SubscriptionCheckInterval);
      }
      // Use a timeout to check periodically if candles are loaded
      this.l2SubscriptionCheckInterval = setInterval(() => {
        if (this._candles.length > 0) {
          clearInterval(this.l2SubscriptionCheckInterval!);
          this.l2SubscriptionCheckInterval = null;
          subscribeToL2();
        }
      }, 100); // Check every 100ms
    }
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

    // Clear any pending L2 subscription check
    if (this.l2SubscriptionCheckInterval) {
      clearInterval(this.l2SubscriptionCheckInterval);
      this.l2SubscriptionCheckInterval = null;
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

    // ⚡ SVELTE 5 OPTIMIZATION: Update individual properties instead of spreading
    // Direct assignment avoids reactive cascade overhead
    this._dataStats.totalCount = count;
    this._dataStats.visibleCount = this._visibleCandles.length;
    this._dataStats.oldestTime = count > 0 ? (this._candles[0].time as number) : null;
    this._dataStats.newestTime = count > 0 ? (this._candles[count - 1].time as number) : null;
    this._dataStats.lastUpdate = Date.now();
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
      const response = await chartCacheService.fetchCandlesWithMetadata({
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
      // PERF: Disabled - console.error('Error getting database count:', error);
    }
  }

  // Redis statistics
  async getStorageStats() {
    return await chartCacheService.getStorageStats();
  }

  // Cleanup
  destroy() {
    this.unsubscribeFromRealtime();
    
    if (this.newCandleTimeout) {
      clearTimeout(this.newCandleTimeout);
    }
    
    chartRealtimeService.disconnect();
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

  /**
   * 🚀 PERF: Batched notification - groups rapid updates into single batch
   * Reduces reactive overhead by ~50% on high-frequency updates
   * ⚡ PHASE 10: Added immediate mode to bypass 16ms batcher delay for real-time updates
   */
  private notifyDataUpdate(immediate: boolean = false) {
    const executeCallbacks = () => {
      console.log(`⚡ [notifyDataUpdate] Executing ${this.dataUpdateCallbacks.size} callbacks`);
      let index = 0;
      this.dataUpdateCallbacks.forEach((callback) => {
        try {
          console.log(`   → Callback ${++index}/${this.dataUpdateCallbacks.size}`);
          callback();
        } catch (error) {
          console.error(`❌ [DataStore] Error in data update callback ${index}:`, error);
        }
      });
      console.log(`✅ [notifyDataUpdate] All callbacks executed`);
    };

    if (immediate) {
      // ⚡ PHASE 10: For real-time L2 updates, execute immediately (no 16ms batcher delay)
      // This keeps chart responsive to price changes
      console.log(`🔥 [notifyDataUpdate] IMMEDIATE mode - executing callbacks now`);
      executeCallbacks();
    } else {
      // For historical data loads, use batcher to group updates
      console.log(`⏱️  [notifyDataUpdate] BATCHED mode - scheduling callbacks with 16ms delay`);
      dataUpdateNotifier.scheduleNotification(executeCallbacks);
    }
  }

  /**
   * 🚀 PERF: Batched historical data notification
   */
  private notifyHistoricalDataLoaded() {
    historicalDataNotifier.scheduleNotification(() => {
      this.historicalDataLoadedCallbacks.forEach((callback) => {
        try {
          callback();
        } catch (error) {
          // PERF: Disabled - console.error(`❌ [DataStore] Error in historical data callback:`, error);
        }
      });
    });
  }

  /**
   * Get the WebSocket connection for other components to use
   */
  getWebSocket(): WebSocket | null {
    return chartRealtimeService.getWebSocket();
  }

  /**
   * Enable TypedArray memory optimization
   * This reduces memory usage by 60-70% for large candle datasets
   * Safe to call multiple times (idempotent)
   */
  enableTypedArrayOptimization(): void {
    typedArrayCache.enable();
    ChartDebug.log(`✅ TypedArray memory optimization ENABLED - data will be automatically cached`);
  }

  /**
   * Disable TypedArray caching
   */
  disableTypedArrayOptimization(): void {
    typedArrayCache.disable();
    ChartDebug.log(`❌ TypedArray caching DISABLED`);
  }

  /**
   * Get TypedArray cache statistics
   */
  getCacheStats() {
    return typedArrayCache.getStats();
  }

  /**
   * Print detailed cache report to console
   */
  printCacheReport(): void {
    typedArrayCache.printReport();
  }
}

// Create and export singleton
export const dataStore = new DataStore();

// Export cache for direct access if needed
export { typedArrayCache };