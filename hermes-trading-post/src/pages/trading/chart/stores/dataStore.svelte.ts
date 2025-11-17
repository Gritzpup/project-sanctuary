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
import { getGranularitySeconds } from '../utils/granularityHelpers';
import { chartStore } from './chartStore.svelte';
import { orderbookStore } from '../../orderbook/stores/orderbookStore.svelte';
import { dataUpdateNotifier, historicalDataNotifier } from '../../../../services/NotificationBatcher';
import { cacheManager } from './services/CacheManager';
import { dataTransformations } from './services/DataTransformations';
import { dataStoreSubscriptions } from './services/DataStoreSubscriptions';
import { typedArrayCache } from '../services/TypedArrayDataCache';

class DataStore {
  // ✅ PHASE 2: Memory optimization - cap maximum candles to prevent OOM crashes
  private readonly MAX_CANDLES = 1000; // Browser can safely render 1000 candles

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
    loadedCount: 0, // 🚀 PHASE 11: Candles loaded for current granularity from cache + backend
    oldestTime: null as number | null,
    newestTime: null as number | null,
    lastUpdate: null as number | null,
    loadingStatus: 'idle' as 'idle' | 'fetching' | 'storing' | 'error' | 'rate-limited'
  });

  private realtimeUnsubscribe: (() => void) | null = null;
  private orderbookPriceUnsubscribe: (() => void) | null = null;
  private newCandleTimeout: NodeJS.Timeout | null = null;
  private l2SubscriptionCheckInterval: NodeJS.Timeout | null = null;  // Track the candle-loading check interval
  private l2SubscriptionCheckRetries: number = 0;  // ✅ FIXED: Track retries to prevent infinite loop
  private l2SubscriptionCheckMaxRetries: number = 30;  // Max 30 seconds (30 * 1 second) before giving up
  private l2NotifyRafId: number | null = null;  // RAF throttle for notifyDataUpdate calls
  private maxCallbacksSize: number = 50; // Max callbacks to prevent memory leaks

  // Subscription mechanism for plugins
  private dataUpdateCallbacks: Set<() => void> = new Set();
  private historicalDataLoadedCallbacks: Set<() => void> = new Set();

  // 🔍 MEMORY DEBUG: Track metrics over time
  private memoryMonitorInterval: NodeJS.Timeout | null = null;
  private notifyUpdateCount: number = 0;
  private lastMemoryReport: number = Date.now();

  constructor() {
    // 🔍 MEMORY DEBUG: Periodic memory diagnostics
    this.memoryMonitorInterval = setInterval(() => {
      this.logMemoryDiagnostics();
    }, 30000); // Every 30 seconds

    console.log('🔍 [DataStore] Memory monitoring enabled - diagnostics every 30s');
  }

  /**
   * 🔍 MEMORY DEBUG: Log memory diagnostics to identify leak sources
   */
  private logMemoryDiagnostics(): void {
    const now = Date.now();
    const timeSinceLastReport = (now - this.lastMemoryReport) / 1000;

    const diagnostics = {
      timestamp: new Date().toISOString(),
      arrays: {
        candles: this._candles.length,
        visibleCandles: this._visibleCandles.length,
        maxAllowed: this.MAX_CANDLES
      },
      callbacks: {
        dataUpdate: this.dataUpdateCallbacks.size,
        historicalDataLoaded: this.historicalDataLoadedCallbacks.size,
        maxAllowed: this.maxCallbacksSize
      },
      updateFrequency: {
        notifyCallsInPeriod: this.notifyUpdateCount,
        periodSeconds: timeSinceLastReport,
        callsPerSecond: (this.notifyUpdateCount / timeSinceLastReport).toFixed(2)
      },
      browserMemory: (performance as any).memory ? {
        usedJSHeapSize: ((performance as any).memory.usedJSHeapSize / 1024 / 1024).toFixed(2) + ' MB',
        totalJSHeapSize: ((performance as any).memory.totalJSHeapSize / 1024 / 1024).toFixed(2) + ' MB',
        jsHeapSizeLimit: ((performance as any).memory.jsHeapSizeLimit / 1024 / 1024).toFixed(2) + ' MB'
      } : 'Not available (non-Chromium browser)'
    };

    // Use JSON.stringify to ensure CDP shows full details (not just "Object")
    console.log('🔍 [Memory Diagnostics]', JSON.stringify(diagnostics, null, 2));

    // Reset counters
    this.notifyUpdateCount = 0;
    this.lastMemoryReport = now;

    // ⚠️ WARNING: Check for potential memory issues
    if (this._candles.length > this.MAX_CANDLES * 0.9) {
      console.warn(`⚠️ [Memory Warning] Candle array approaching limit: ${this._candles.length}/${this.MAX_CANDLES}`);
    }

    if (this.dataUpdateCallbacks.size > this.maxCallbacksSize * 0.8) {
      console.warn(`⚠️ [Memory Warning] Data update callbacks growing: ${this.dataUpdateCallbacks.size}/${this.maxCallbacksSize}`);
    }
  }

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
      // 🚀 PHASE 6 FIX: Don't set visibleCount here!
      // visibleCount is managed by VisibleCandleTracker and will be set when chart initializes
      // this._dataStats.visibleCount = sortedCandles.length;
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
    console.log(`🚀🚀🚀 [DataStore] loadData called: pair=${pair}, granularity=${granularity}, maxCandles=${maxCandles || 'default(120)'}`);
    console.log(`🚀🚀🚀 [DataStore] Time range: ${new Date(startTime * 1000).toISOString()} to ${new Date(endTime * 1000).toISOString()}`);
    const perfStart = performance.now();

    // Update current pair/granularity
    this._currentPair = pair;
    this._currentGranularity = granularity;

    try {
      await chartCacheService.initialize();

      // 🔥 DISABLED IndexedDB cache - always fetch fresh data from Redis
      // IndexedDB causes stale data issues - Redis is fast enough
      const cachedData = null; // Force cache miss to always fetch from Redis

      if (false && cachedData && cachedData.candles.length > 0) {
        // ✅ Cache hit! Show cached data immediately (0ms perceived load time)
        // 🚀 PHASE 11: Check if cache needs enhancement BEFORE slicing
        const cachedCandles = cachedData.candles;
        const requestedCandles = maxCandles || 1000;

        console.log(`[DataStore CACHE HIT] Loading from cache (cached=${cachedCandles.length}, maxCandles=${requestedCandles})`);
        ChartDebug.log(`⚡ INSTANT LOAD from IndexedDB: ${cachedCandles.length} candles (${performance.now() - perfStart}ms)`);

        // 🚀 PHASE 11: Load immediately from cache, then fetch additional data asynchronously
        // This gives instant display while fetching more data from backend
        const candlesToLoad = maxCandles ? cachedCandles.slice(-maxCandles) : cachedCandles;
        console.log(`[DataStore CACHE HIT] Loading ${candlesToLoad.length} candles (cached=${cachedCandles.length})`);
        this.setCandles(candlesToLoad);
        this.updateStats();

        // 🚀 PHASE 11: Cache enhancement now happens at app init via AppInitializer
        // We load sufficient data per granularity during warming, so we don't need additional fetches here
        // Infinite scroll will handle loading more as user scrolls left

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

          // 🚀 PHASE 6: Merge delta with already-loaded candles (not full cache)
          // Only merge with candlesToLoad to maintain maxCandles limit
          const mergedCandles = [...candlesToLoad, ...deltaAsChartData].sort(
            (a, b) => (a.time as number) - (b.time as number)
          );

          this.setCandles(mergedCandles as CandlestickDataWithVolume[]);
          this.updateStats();
        }

        ChartDebug.log(`⚡ Total load time with delta sync: ${performance.now() - perfStart}ms`);

      } else if (cachedData === null || cachedData.candles.length === 0) {
        // ❌ Cache miss - fetch full data from backend
        ChartDebug.log(`❌ Cache miss - fetching full data from backend`);

        const data = await chartCacheService.fetchCandles({
          pair,
          granularity,
          start: startTime,
          end: endTime,
          limit: maxCandles || 10000
        });

        console.log(`[DataStore CACHE MISS - BACKEND] Loading ${data.length} candles from backend`);

        // 🎯 ALWAYS FETCH FRESH 60 CANDLES: If we have less than 60 candles, fetch fresh from Coinbase
        // This ensures we always display a complete chart on every refresh
        const MIN_CANDLES = 60;
        const requestedCandles = Math.max(maxCandles || 120, MIN_CANDLES);

        console.log(`🎯 [DataStore 60-CANDLE CHECK] Redis returned ${data.length} candles, MIN_CANDLES=${MIN_CANDLES}, maxCandles=${maxCandles}, requestedCandles=${requestedCandles}`);

        if (data.length < MIN_CANDLES) {
          console.log(`🚀 [DataStore] Only ${data.length} candles in Redis - fetching fresh ${MIN_CANDLES} from Coinbase API...`);

          // Fetch fresh 120 candles directly from Coinbase (ask for 2x to ensure we get at least 60)
          // Coinbase might have gaps or rate limits, so asking for more ensures we hit MIN_CANDLES
          const FETCH_CANDLE_COUNT = 120;
          const granularityMap: Record<string, number> = {
            '1m': 60, '5m': 300, '15m': 900, '30m': 1800, '1h': 3600, '2h': 7200, '4h': 14400, '6h': 21600, '1d': 86400
          };
          const granularitySeconds = granularityMap[granularity] || 60;
          const timeRange = FETCH_CANDLE_COUNT * granularitySeconds; // Fetch 120 candles worth of time
          const fetchStart = endTime - timeRange;

          const freshCandles = await this.fetchGapData(fetchStart, endTime);
          console.log(`✅ [DataStore] Fetched ${freshCandles.length} fresh candles from Coinbase`);

          if (freshCandles.length > 0) {
            this.setCandles(freshCandles as CandlestickDataWithVolume[]);
            this.updateStats();
            console.log(`🎯🎯🎯 [DataStore 60-CANDLE RESULT] Loaded ${this._candles.length} fresh candles from Coinbase API (requested ${MIN_CANDLES})`);

            // Cache for next time
            await chartIndexedDBCache.set(pair, granularity, freshCandles);
            ChartDebug.log(`⏱️ Full load time (fresh from Coinbase): ${performance.now() - perfStart}ms`);
            return;
          }
        }

        // If we have enough candles or Coinbase fetch failed, use Redis data
        this.setCandles(data);
        this.updateStats();
        console.log(`🎯🎯🎯 [DataStore 60-CANDLE RESULT] After setCandles: ${this._candles.length} candles in memory (Redis had ${data.length})`);

        // 🔧 AUTO-FILL: If we got fewer candles than requested, try to backfill older ones
        if (data.length < requestedCandles && data.length > 0) {
          console.log(`⚠️ [DataStore] Have ${data.length}/${requestedCandles} candles, backfilling older ones...`);

          // Calculate how far back we need to go to get the requested number of candles
          const granularityMap: Record<string, number> = {
            '1m': 60, '5m': 300, '15m': 900, '30m': 1800, '1h': 3600, '2h': 7200, '4h': 14400, '6h': 21600, '1d': 86400
          };
          const granularitySeconds = granularityMap[granularity] || 60;
          const candlesNeeded = requestedCandles - data.length;
          const timeRangeNeeded = candlesNeeded * granularitySeconds;

          // If we have no data, fetch from endTime backwards; otherwise fetch before oldest candle
          let fetchStartTime: number;
          let fetchEndTime: number;

          if (data.length === 0) {
            // No data at all - fetch the requested amount backwards from endTime
            fetchEndTime = endTime;
            fetchStartTime = endTime - timeRangeNeeded;
            console.log(`📥 [DataStore] No Redis data - fetching ${candlesNeeded} candles from scratch`);
          } else {
            // Have some data - fetch older candles
            const oldestCandleTime = data[0].time as number;
            fetchStartTime = oldestCandleTime - timeRangeNeeded;
            fetchEndTime = oldestCandleTime - granularitySeconds; // Don't overlap with existing data
            console.log(`📥 [DataStore] Have ${data.length} candles - backfilling ${candlesNeeded} older ones`);
          }

          // Fetch additional historical data from Coinbase API
          try {
            const additionalCandles = await this.fetchGapData(fetchStartTime, fetchEndTime);
            if (additionalCandles.length > 0) {
              console.log(`✅ [DataStore] Fetched ${additionalCandles.length} additional candles from Coinbase API`);

              // Merge with existing candles and update
              const allCandles = [...additionalCandles, ...data].sort((a, b) => (a.time as number) - (b.time as number));
              this.setCandles(allCandles as CandlestickDataWithVolume[]);
              this.updateStats();
              console.log(`🎯🎯🎯 [DataStore] FINAL COUNT after API backfill: ${this._candles.length} candles (${data.length} from Redis + ${additionalCandles.length} from API)`);

              // Cache the enhanced dataset
              await chartIndexedDBCache.set(pair, granularity, allCandles);
              console.log(`💾 [DataStore] Cached ${allCandles.length} candles (original ${data.length} + ${additionalCandles.length} from API)`);
            } else {
              console.warn(`⚠️ [DataStore] Could not fetch additional candles from Coinbase API`);
            }
          } catch (error) {
            console.error(`❌ [DataStore] Error fetching additional candles:`, error);
          }
        } else {
          // Cache the data for next time (normal case - got enough candles)
          if (data.length > 0) {
            await chartIndexedDBCache.set(pair, granularity, data);
            ChartDebug.log(`💾 Cached ${data.length} candles to IndexedDB`);
          }
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

    console.log(`[DataStore RELOAD] Loading ${data.length} candles via reloadData`);
    this.setCandles(data);
    this.updateStats();

    // Update IndexedDB cache
    if (data.length > 0) {
      await chartIndexedDBCache.set(config.pair, config.granularity, data);
    }
  }

  async fetchGapData(fromTime: number, toTime: number): Promise<CandlestickData[]> {
    console.log(`🔍 [fetchGapData] Fetching gap data from ${new Date(fromTime * 1000).toISOString()} to ${new Date(toTime * 1000).toISOString()}`);

    try {
      const config = this.getCurrentConfig();
      console.log(`🔍 [fetchGapData] Config: pair=${config.pair}, granularity=${config.granularity}`);

      // First try to fetch from Redis/backend cache
      let gapData = await chartCacheService.fetchCandles({
        pair: config.pair,
        granularity: config.granularity,
        start: fromTime,
        end: toTime,
        limit: 5000
      });

      console.log(`📥 [fetchGapData] chartCacheService.fetchCandles returned ${gapData.length} candles from Redis`);

      // If Redis doesn't have the data, fetch from Coinbase API
      if (gapData.length === 0) {
        console.log(`🌐 [fetchGapData] No data in Redis, fetching from Coinbase API...`);

        // Convert granularity to seconds for Coinbase API
        const granularityMap: Record<string, number> = {
          '1m': 60, '5m': 300, '15m': 900, '30m': 1800, '1h': 3600, '2h': 7200, '4h': 14400, '6h': 21600, '1d': 86400
        };
        const granularitySeconds = granularityMap[config.granularity] || 60;

        // Direct fetch to Coinbase API to avoid Axios import issues
        const url = `https://api.exchange.coinbase.com/products/${config.pair}/candles?start=${fromTime}&end=${toTime}&granularity=${granularitySeconds}`;
        console.log(`🔗 [fetchGapData] Fetching: ${url}`);

        try {
          const response = await fetch(url);
          if (!response.ok) {
            console.error(`❌ [fetchGapData] Coinbase API error: ${response.status} ${response.statusText}`);
            gapData = [];
          } else {
            const apiData = await response.json();
            console.log(`📥 [fetchGapData] Coinbase API returned ${apiData.length} raw candles`);

            // Convert Coinbase API format [time, low, high, open, close, volume] to our format
            gapData = apiData.map((candle: any[]) => ({
              time: candle[0],
              low: candle[1],
              high: candle[2],
              open: candle[3],
              close: candle[4],
              volume: candle[5] || 0
            }));

            console.log(`📥 [fetchGapData] Converted ${gapData.length} candles to chart format`);
          }
        } catch (fetchError) {
          console.error(`❌ [fetchGapData] Fetch error:`, fetchError);
          gapData = [];
        }
      }

      // Filter out any candles we already have
      const existingTimes = new Set(this._candles.map(c => c.time));
      const newCandles = gapData.filter(candle => !existingTimes.has(candle.time));

      console.log(`✅ [fetchGapData] Gap fetch returned ${gapData.length} candles, ${newCandles.length} are new (${existingTimes.size} existing)`);

      return newCandles;
    } catch (error) {
      console.error('❌ [fetchGapData] Error fetching gap data:', error);
      return [];
    }
  }

  setCandles(candles: CandlestickDataWithVolume[]) {
    // Use DataTransformations service to validate, normalize, and sort candles
    const sortedCandles = dataTransformations.transformCandles(candles);

    if (sortedCandles.length < candles.length) {
      // PERF: Disabled - console.warn(`⚠️ [DataStore] Filtered out ${candles.length - sortedCandles.length} invalid candles`);
    }

    // 🔍 DEBUG: Log candle time range
    if (sortedCandles.length > 0) {
      const firstTime = sortedCandles[0].time as number;
      const lastTime = sortedCandles[sortedCandles.length - 1].time as number;
      console.log(`📊 [DataStore] setCandles: ${sortedCandles.length} candles from ${new Date(firstTime * 1000).toISOString()} to ${new Date(lastTime * 1000).toISOString()}`);
    }

    if (sortedCandles.length > 100) {
      console.log(`[DataStore] setCandles called with ${sortedCandles.length} candles - Stack:`, new Error().stack?.split('\n').slice(1,5).join('\n'));
    }

    // ✅ PHASE 2: Cap maximum candles to prevent OOM crashes
    // Keep the most recent MAX_CANDLES to maintain viewport + history
    let cappedCandles = sortedCandles;
    if (sortedCandles.length > this.MAX_CANDLES) {
      const excessCandles = sortedCandles.length - this.MAX_CANDLES;
      cappedCandles = sortedCandles.slice(excessCandles);
      console.log(`[DataStore] ⚠️ Capped candles from ${sortedCandles.length} to ${this.MAX_CANDLES} (removed oldest ${excessCandles})`);
    }

    this._candles = cappedCandles;
    this._visibleCandles = cappedCandles; // Initially all candles are visible

    // ⚡ PHASE 2: Automatically cache data in TypedArrays for memory optimization
    typedArrayCache.store(this._currentPair, this._currentGranularity, cappedCandles);

    // Update latest price
    if (cappedCandles.length > 0) {
      const lastCandle = cappedCandles[cappedCandles.length - 1];
      this._latestPrice = lastCandle.close;
    }

    // Update stats to trigger UI updates
    this.updateStats();

    // Notify plugins of data update
    this.notifyDataUpdate();

    // 🔧 AUTO GAP DETECTION: Scan for gaps in loaded data and auto-fill them
    this.detectAndFillGaps();
  }

  /**
   * Scan loaded candles for gaps and automatically fill them from backend
   */
  private async detectAndFillGaps() {
    if (this._candles.length < 2) return;

    const config = this.getCurrentConfig();
    const granularityMap: Record<string, number> = {
      '1m': 60, '5m': 300, '15m': 900, '30m': 1800, '1h': 3600, '2h': 7200, '4h': 14400, '6h': 21600, '1d': 86400
    };
    const granularitySeconds = granularityMap[config.granularity] || 60;

    const gaps: Array<{ start: number; end: number; count: number }> = [];

    // Scan for gaps between consecutive candles
    for (let i = 1; i < this._candles.length; i++) {
      const prevTime = this._candles[i - 1].time as number;
      const currentTime = this._candles[i].time as number;
      const expectedTime = prevTime + granularitySeconds;
      const gapSize = currentTime - expectedTime;

      if (gapSize >= granularitySeconds) {
        const missedCandles = Math.floor(gapSize / granularitySeconds);
        gaps.push({
          start: expectedTime,
          end: currentTime - granularitySeconds,
          count: missedCandles
        });
      }
    }

    if (gaps.length > 0) {
      console.log(`⚠️ [DataStore] Found ${gaps.length} gap(s) in loaded data, auto-filling...`);
      console.log(`🔍 [DataStore] Gap details:`, gaps.map(g => ({
        start: new Date(g.start * 1000).toISOString(),
        end: new Date(g.end * 1000).toISOString(),
        count: g.count
      })));

      // Fill each gap asynchronously
      let totalFilled = 0;
      for (const gap of gaps) {
        try {
          console.log(`🔄 [DataStore] Fetching gap data: ${gap.count} candles from ${new Date(gap.start * 1000).toISOString()} to ${new Date(gap.end * 1000).toISOString()}`);
          const gapCandles = await this.fetchGapData(gap.start, gap.end);
          console.log(`📥 [DataStore] fetchGapData returned ${gapCandles.length} candles`);

          if (gapCandles.length > 0) {
            console.log(`✅ [DataStore] Auto-filled gap: ${gapCandles.length} candles from ${new Date(gap.start * 1000).toISOString()}`);

            // Insert gap candles into the correct position
            const insertIndex = this._candles.findIndex(c => (c.time as number) >= (gapCandles[0].time as number));
            console.log(`📍 [DataStore] Insert index: ${insertIndex}, total candles before: ${this._candles.length}`);
            if (insertIndex !== -1) {
              this._candles.splice(insertIndex, 0, ...gapCandles);
              this._visibleCandles.splice(insertIndex, 0, ...gapCandles);
              totalFilled += gapCandles.length;
              console.log(`✅ [DataStore] Inserted ${gapCandles.length} candles at index ${insertIndex}, total candles now: ${this._candles.length}`);
            } else {
              console.warn(`⚠️ [DataStore] Could not find insert index for gap candles`);
            }
          } else {
            console.warn(`⚠️ [DataStore] No candles returned for gap from ${new Date(gap.start * 1000).toISOString()}`);
          }
        } catch (err) {
          console.error(`❌ [DataStore] Failed to fill gap:`, err);
        }
      }

      // Notify after all gaps are filled
      if (totalFilled > 0) {
        console.log(`🎉 [DataStore] Gap filling complete! Added ${totalFilled} total candles`);
        this.updateStats();
        this.notifyDataUpdate();
      } else {
        console.warn(`⚠️ [DataStore] Gap filling completed but no candles were added`);
      }
    }
  }

  /**
   * Add a single new candle (for real-time updates)
   * This is used when new candles arrive via WebSocket
   */
  async addCandle(candle: CandlestickDataWithVolume) {
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

    // 🔧 AUTO GAP DETECTION: Check if there's a gap before adding new candle
    if (this._candles.length > 0) {
      const lastCandle = this._candles[this._candles.length - 1];
      const config = this.getCurrentConfig();
      const granularityMap: Record<string, number> = {
        '1m': 60, '5m': 300, '15m': 900, '30m': 1800, '1h': 3600, '2h': 7200, '4h': 14400, '6h': 21600, '1d': 86400
      };
      const granularitySeconds = granularityMap[config.granularity] || 60;
      const expectedNextTime = (lastCandle.time as number) + granularitySeconds;
      const actualTime = validCandle.time as number;
      const gapSize = actualTime - expectedNextTime;

      // 🎯 INDUSTRY STANDARD: Block and backfill gaps BEFORE adding new candle
      // This prevents visual discontinuities when transitioning from historical → live data
      // Used by TradingView, Binance, Coinbase, and other professional platforms
      if (gapSize >= granularitySeconds) {
        const missedCandles = Math.floor(gapSize / granularitySeconds);
        console.log(`⚠️ [DataStore] Gap detected: ${missedCandles} missing candles between ${new Date(expectedNextTime * 1000).toISOString()} and ${new Date(actualTime * 1000).toISOString()}`);
        console.log(`🔄 [DataStore] BLOCKING to backfill gap before adding new candle (industry best practice)`);

        try {
          // ✅ BLOCKING: Wait for gap data before proceeding
          const gapCandles = await this.fetchGapData(expectedNextTime, actualTime - granularitySeconds);

          if (gapCandles.length > 0) {
            console.log(`✅ [DataStore] Successfully backfilled ${gapCandles.length} missing candles`);
            // Insert gap candles in correct position
            const insertIndex = this._candles.findIndex(c => (c.time as number) >= (gapCandles[0].time as number));
            if (insertIndex !== -1) {
              this._candles.splice(insertIndex, 0, ...gapCandles);
              this._visibleCandles.splice(insertIndex, 0, ...gapCandles);
            } else {
              // Gap candles go at the end (before new candle)
              this._candles.push(...gapCandles);
              this._visibleCandles.push(...gapCandles);
            }
            this.notifyDataUpdate();
          } else {
            console.warn(`⚠️ [DataStore] Gap backfill returned 0 candles - no data available for gap period`);
          }
        } catch (err) {
          console.error('❌ [DataStore] Gap backfill failed:', err);
          // Continue anyway - add the new candle even if gap fill fails
        }
      }
    }

    // Add to candles array
    this._candles.push(validCandle);
    this._visibleCandles.push(validCandle);

    // 🔍 DEBUG: Log new candle addition
    const candleTime = new Date((validCandle.time as number) * 1000).toISOString();
    console.log(`➕ [DataStore] addCandle: New candle at ${candleTime}, price: $${validCandle.close}, total: ${this._candles.length}`);

    // 🔧 FIX: Cap candle array to prevent memory leak
    // Granularity-aware limits to support various timeframes:
    // - 1m/5m/15m/30m: Keep 2000 candles (handles ~2 weeks to ~30 days)
    // - 1h/4h/6h: Keep 2000 candles (handles ~3 months to ~6 months)
    // - 1d: Keep 1825 candles (exactly 5 years)
    const granularity = this.getCurrentConfig().granularity;
    const MAX_STORED_CANDLES = (granularity === '1d' || granularity === '1D') ? 1825 : 2000;
    if (this._candles.length > MAX_STORED_CANDLES) {
      const trimCount = this._candles.length - MAX_STORED_CANDLES;
      this._candles.splice(0, trimCount);
      this._visibleCandles.splice(0, trimCount);
    }

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
    // 🚀 PHASE 6 FIX: Don't update visibleCount here - it's managed by VisibleCandleTracker
    // this._dataStats.visibleCount = this._visibleCandles.length;

    // Notify plugins of data update
    this.notifyDataUpdate();
  }

  async fetchAndPrependHistoricalData(additionalCandleCount: number = 300): Promise<number> {
    console.log(`[DataStore] fetchAndPrependHistoricalData called with ${additionalCandleCount} candles`);
    try {
      if (this._candles.length === 0) return 0;

      const config = this.getCurrentConfig();
      const firstCandle = this._candles[0];
      const firstCandleTime = firstCandle.time as number;

      // 🚀 PHASE 11: NO granularity escalation - respect user's granularity choice
      // Infinite scroll fetches more data for the CURRENT granularity only
      const granularityMap: Record<string, number> = {
        '1m': 60, '5m': 300, '15m': 900, '30m': 1800, '1h': 3600, '2h': 7200, '4h': 14400, '6h': 21600, '1d': 86400
      };
      const granularitySeconds = granularityMap[config.granularity] || 60;
      const fetchStartTime = firstCandleTime - (additionalCandleCount * granularitySeconds);

      console.log(`[DataStore] 📜 Infinite scroll: Loading ${additionalCandleCount} more ${config.granularity} candles...`);

      // Fetch additional historical data for the CURRENT granularity
      const historicalData = await chartCacheService.fetchCandles({
        pair: config.pair,
        granularity: config.granularity,
        start: fetchStartTime,
        end: firstCandleTime - granularitySeconds, // Don't overlap with existing data
        limit: additionalCandleCount
      });

      if (historicalData.length > 0) {
        console.log(`[DataStore] ✅ Infinite scroll: Loaded ${historicalData.length} more ${config.granularity} candles`);

        // Merge historical data with existing data (prepend historical data)
        const mergedCandles = [...historicalData, ...this._candles];

        // Sort by time to ensure proper order (should already be sorted, but safety check)
        mergedCandles.sort((a, b) => (a.time as number) - (b.time as number));

        // Use setCandles to ensure proper reactivity and notifications
        this.setCandles(mergedCandles);

        // Notify plugins that historical data was loaded (separate from real-time updates)
        this.notifyHistoricalDataLoaded();

        return historicalData.length;
      } else {
        console.log(`[DataStore] No additional data available for ${config.granularity}`);
        return 0;
      }
    } catch (error) {
      // PERF: Disabled - console.error('❌ Error fetching historical data:', error);
      return 0;
    }
  }

  updateVisibleRange(from: number, to: number) {
    this._visibleCandles = this._candles.filter(
      candle => candle.time >= from && candle.time <= to
    );

    // 🚀 PHASE 6 FIX: Don't update visibleCount here - it's managed by VisibleCandleTracker
    // this._dataStats.visibleCount = this._visibleCandles.length;
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
              console.log(`🔄 [DataStore] Updated EXISTING candle #${this._candles.length}: time=${normalizedTime}, close=$${candleData.close}`);
            }
          } else {
            // New candle - append without replacing the entire array
            // 🚫 CRITICAL: Only append if time > 0 (never append ticker updates)
            if (normalizedTime > 0) {
              this._candles.push(candleData);
              console.log(`✅ [DataStore] Added NEW candle #${this._candles.length}: time=${normalizedTime}, close=$${candleData.close}`);

              // 🔧 FIX: Cap candle array to prevent memory leak
              const MAX_STORED_CANDLES = 2000;
              if (this._candles.length > MAX_STORED_CANDLES) {
                const trimCount = this._candles.length - MAX_STORED_CANDLES;
                this._candles.splice(0, trimCount);
              }

              // ⚡ SVELTE 5 OPTIMIZATION: Update individual properties instead of spreading
              // Direct assignment avoids reactive cascade overhead
              this._dataStats.totalCount = this._candles.length;
              this._dataStats.newestTime = candleData.time as number;
              this._dataStats.lastUpdate = Date.now();
              // 🚀 PHASE 6 FIX: Don't update visibleCount here - it's managed by VisibleCandleTracker
              // this._dataStats.visibleCount = this._visibleCandles.length;
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

    // ⚡ PHASE 10C: Defer L2 subscription until candles are loaded to avoid race condition
    // L2 updates must have candles to update, otherwise they're wasted
    const subscribeToL2 = () => {
      this.orderbookPriceUnsubscribe = orderbookStore.subscribeToPriceUpdates((price: number) => {
        // ✅ PERFORMANCE FIX: Only update latestPrice for header display
        // DO NOT update chart candles on every L2 tick - causes freezing
        // Chart updates from ticker/candle WebSocket messages instead
        this._latestPrice = price;

        // NO chart candle updates here - would freeze the UI
        // Header price updates instantly, chart updates from WebSocket only
      });
    };

    // ✅ RE-ENABLED: L2 orderbook for instant price updates
    // Using orderbook mid-price for fastest possible header price updates
    console.log('[DataStore] 🚀 L2 orderbook subscription ENABLED for instant price updates');

    // 🚀 PHASE 6 FIX: Subscribe immediately if ready, otherwise defer with timeout
    // CRITICAL: Prevent L2 race condition where subscription starts before candles load
    // This ensures we never try to update candles that don't exist yet
    if (this._candles.length > 0) {
      subscribeToL2();
    } else {
      // Candles not yet loaded - use efficient single timeout chain instead of polling loop
      // Clear any existing timeout
      if (this.l2SubscriptionCheckInterval) {
        clearTimeout(this.l2SubscriptionCheckInterval as any);
        this.l2SubscriptionCheckInterval = null;
      }

      // ✅ FIXED: Recursive timeout with max retry limit
      this.l2SubscriptionCheckRetries = 0;  // Reset retry counter
      const checkAndSubscribe = () => {
        if (this._candles.length > 0) {
          // Success: candles loaded
          subscribeToL2();
          this.l2SubscriptionCheckRetries = 0;
        } else if (this.l2SubscriptionCheckRetries < this.l2SubscriptionCheckMaxRetries) {
          // Not ready yet, but within retry limit - schedule next check
          this.l2SubscriptionCheckRetries++;
          this.l2SubscriptionCheckInterval = setTimeout(checkAndSubscribe, 1000) as any;
        } else {
          // Max retries exceeded - give up and log failure
          console.warn(
            `[DataStore] L2 subscription check reached max retries (${this.l2SubscriptionCheckMaxRetries}s), giving up`
          );
          this.l2SubscriptionCheckRetries = 0;
          this.l2SubscriptionCheckInterval = null;
        }
      };

      // Initial check after 100ms (allow time for API response)
      this.l2SubscriptionCheckInterval = setTimeout(checkAndSubscribe, 100) as any;
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
      clearTimeout(this.l2SubscriptionCheckInterval as any);
      this.l2SubscriptionCheckInterval = null;
    }

    // Cancel any pending RAF notification
    if (this.l2NotifyRafId) {
      cancelAnimationFrame(this.l2NotifyRafId);
      this.l2NotifyRafId = null;
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
    // 🚀 PHASE 11: Track loadedCount - total candles loaded for this granularity
    this._dataStats.loadedCount = count;
    // 🚀 PHASE 6 FIX: DON'T overwrite visibleCount here!
    // visibleCount is managed by VisibleCandleTracker and updateVisibleCandleCount()
    // Overwriting it here breaks the connection to the actual chart viewport
    // this._dataStats.visibleCount = this._visibleCandles.length;
    this._dataStats.oldestTime = count > 0 ? (this._candles[0].time as number) : null;
    this._dataStats.newestTime = count > 0 ? (this._candles[count - 1].time as number) : null;
    this._dataStats.lastUpdate = Date.now();
  }

  /**
   * 🚀 PHASE 6 FIX: Update visible candle count from chart viewport
   * This is called by VisibleCandleTracker whenever the user pans/zooms
   * Separate from totalCount (all loaded candles in memory)
   */
  updateVisibleCandleCount(count: number): void {
    this._dataStats.visibleCount = Math.max(0, count);
  }

  // Get actual count from database via the existing Redis service
  async updateDatabaseCount() {
    try {
      const config = this.getCurrentConfig();

      // Use dynamic host for network access
      const backendHost = (import.meta.env.VITE_BACKEND_HOST as string) || window.location.hostname || 'localhost';
      const backendUrl = `http://${backendHost}:4828`;

      // Get total count for current granularity from database
      // This is the total available in the database for the current pair/granularity
      const response = await chartCacheService.fetchCandlesWithMetadata({
        pair: config.pair,
        granularity: config.granularity,
        limit: 1 // We only need metadata, not actual candles
      });

      if (response && response.metadata) {
        // Use storageMetadata.totalCandles if available, otherwise metadata.totalCandles
        // This represents ALL candles available in the database for this granularity
        const dbCount = response.metadata.storageMetadata?.totalCandles || response.metadata.totalCandles || 0;
        this._dataStats.totalDatabaseCount = dbCount;
      }

      // Also get total count across ALL granularities for reference
      const totalResponse = await fetch(`${backendUrl}/api/trading/total-candles?pair=${config.pair}`);
      if (totalResponse.ok) {
        const totalData = await totalResponse.json();
        if (totalData.success) {
          // This is just for reference, not displayed
          // ChartDebug.log(`Total database count across all granularities: ${totalData.data.totalCandles}`);
        }
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

    // 🔍 MEMORY DEBUG: Cleanup memory monitoring
    if (this.memoryMonitorInterval) {
      clearInterval(this.memoryMonitorInterval);
      this.memoryMonitorInterval = null;
      console.log('🔍 [DataStore] Memory monitoring stopped');
    }

    // 🔧 FIX: Clear callback Sets to prevent memory leaks
    // These Sets accumulate callbacks indefinitely if not cleared
    this.dataUpdateCallbacks.clear();
    this.historicalDataLoadedCallbacks.clear();

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
    // Prevent memory leaks by limiting callback Set size
    if (this.dataUpdateCallbacks.size < this.maxCallbacksSize) {
      this.dataUpdateCallbacks.add(callback);
    } else {
      ChartDebug.warn(`⚠️ DataStore: Max callbacks (${this.maxCallbacksSize}) reached for dataUpdateCallbacks, dropping new subscription`);
    }
    // Return unsubscribe function
    return () => {
      this.dataUpdateCallbacks.delete(callback);
    };
  }

  onHistoricalDataLoaded(callback: () => void): () => void {
    // Prevent memory leaks by limiting callback Set size
    if (this.historicalDataLoadedCallbacks.size < this.maxCallbacksSize) {
      this.historicalDataLoadedCallbacks.add(callback);
    } else {
      ChartDebug.warn(`⚠️ DataStore: Max callbacks (${this.maxCallbacksSize}) reached for historicalDataLoadedCallbacks, dropping new subscription`);
    }
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
    // 🔍 MEMORY DEBUG: Track notification frequency
    this.notifyUpdateCount++;

    const executeCallbacks = () => {
      this.dataUpdateCallbacks.forEach((callback) => {
        try {
          callback();
        } catch (error) {
          // PERF: Disabled - console.error(`❌ [DataStore] Error in data update callback:`, error);
        }
      });
    };

    if (immediate) {
      // ⚡ PHASE 10: For real-time L2 updates, execute immediately (no 16ms batcher delay)
      // This keeps chart responsive to price changes
      executeCallbacks();
    } else {
      // For historical data loads, use batcher to group updates
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