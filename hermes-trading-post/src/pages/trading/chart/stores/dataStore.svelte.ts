import type { CandlestickData } from 'lightweight-charts';

// Extend CandlestickData to include volume
interface CandlestickDataWithVolume extends CandlestickData {
  volume?: number;
}
import type { WebSocketCandle } from '../types/data.types';
import { RedisChartService } from '../services/RedisChartService';
import { ChartDebug } from '../utils/debug';
import { chartStore } from './chartStore.svelte';

class DataStore {
  private dataService = new RedisChartService();
  private _candles = $state<CandlestickDataWithVolume[]>([]);
  private _visibleCandles = $state<CandlestickDataWithVolume[]>([]);
  private _latestPrice = $state<number | null>(null);
  private _isNewCandle = $state<boolean>(false);
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
  private newCandleTimeout: NodeJS.Timeout | null = null;
  
  // Subscription mechanism for plugins
  private dataUpdateCallbacks: Set<() => void> = new Set();

  // Helper method to get current chart config
  private getCurrentConfig() {
    return {
      pair: chartStore.config?.pair || 'BTC-USD',
      granularity: chartStore.config?.granularity || '1m'
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

  // Auto-populate Redis with 5 years of historical data from Coinbase API
  private async autoLoadHistoricalData() {
    try {
      console.log('🚀 FILLING DATABASE: Starting 5-year historical data population from Coinbase API...');
      
      const config = this.getCurrentConfig();
      const granularitySeconds = config.granularity === '5m' ? 300 : 60; // 1m = 60s, 5m = 300s
      const candlesPerRequest = 300; // Coinbase API limit
      
      // Calculate 5 years back from now
      const endTime = Math.floor(Date.now() / 1000);
      const fiveYearsSeconds = 5 * 365 * 24 * 60 * 60; // 5 years in seconds
      const startTime = endTime - fiveYearsSeconds;
      
      console.log(`📊 Target: ${Math.floor(fiveYearsSeconds / granularitySeconds).toLocaleString()} candles over 5 years`);
      console.log(`📊 Period: ${new Date(startTime * 1000).toISOString()} to ${new Date(endTime * 1000).toISOString()}`);
      
      let currentEndTime = endTime;
      let totalFetched = 0;
      let requestCount = 0;
      
      // Work backwards in 300-candle chunks
      while (currentEndTime > startTime && requestCount < 10000) { // Safety limit
        requestCount++;
        const chunkStartTime = currentEndTime - (candlesPerRequest * granularitySeconds);
        
        console.log(`🔄 Request ${requestCount}: Fetching candles ${currentEndTime} to ${chunkStartTime}`);
        
        try {
          // Set status to fetching
          this._dataStats.loadingStatus = 'fetching';
          
          // Call Coinbase API directly to populate Redis
          const response = await fetch(`/api/coinbase/products/BTC-USD/candles?granularity=${granularitySeconds}&start=${chunkStartTime}&end=${currentEndTime}`);
          
          if (!response.ok) {
            console.error(`❌ API error: ${response.status} ${response.statusText}`);
            if (response.status === 429) {
              this._dataStats.loadingStatus = 'rate-limited';
            } else {
              this._dataStats.loadingStatus = 'error';
            }
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s on error
            continue;
          }
          
          const candles = await response.json();
          
          if (candles && candles.length > 0) {
            // Set status to storing
            this._dataStats.loadingStatus = 'storing';
            
            totalFetched += candles.length;
            console.log(`✅ Fetched ${candles.length} candles. Total: ${totalFetched.toLocaleString()}`);
            
            // Log progress and update DB count periodically during loading
            console.log(`📊 Added ${candles.length} candles to database`);
            
            // Update DB count every 10 requests to show progress
            if (requestCount % 10 === 0) {
              this.updateDatabaseCount();
            }
            
            // Move to next chunk
            currentEndTime = chunkStartTime;
          } else {
            console.log('📈 No more data from Coinbase API');
            break;
          }
          
          // Rate limiting - don't overwhelm Coinbase API
          await new Promise(resolve => setTimeout(resolve, 100)); // 100ms between requests
          
        } catch (error) {
          console.error('❌ Error fetching chunk:', error);
          this._dataStats.loadingStatus = 'error';
          await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s on error
        }
      }
      
      console.log(`✅ DATABASE POPULATION COMPLETE! Fetched ${totalFetched.toLocaleString()} candles in ${requestCount} requests`);
      
      // Set status back to idle
      this._dataStats.loadingStatus = 'idle';
      
      // Reload the chart data to show the new data
      await this.reloadData(startTime, endTime);
      
    } catch (error) {
      console.error('❌ Database population failed:', error);
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
      
      console.log(`🔍 Checking for recent data gaps in last 6 hours...`);
      
      const response = await fetch(`/api/coinbase/products/BTC-USD/candles?granularity=${granularitySeconds}&start=${startTime}&end=${endTime}`);
      
      if (response.ok) {
        const candles = await response.json();
        if (candles.length > 0) {
          console.log(`📥 Fetched ${candles.length} recent candles to fill gaps`);
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

  // Data management
  async loadData(
    pair: string,
    granularity: string,
    startTime: number,
    endTime: number,
    maxCandles?: number
  ): Promise<void> {
    const loadStartTime = performance.now();
    
    console.log(`🔄 [DataStore] Loading data: ${pair}/${granularity} from ${new Date(startTime * 1000).toISOString()} to ${new Date(endTime * 1000).toISOString()}`);
    
    try {
      if (granularity === '1d' || granularity === '1D') {
        ChartDebug.critical(`[PERF] dataStore.loadData started`);
      }
      
      await this.dataService.initialize(pair, granularity);
      
      if (granularity === '1d' || granularity === '1D') {
        ChartDebug.critical(`[PERF] About to fetch historical data`);
      }
      
      const fetchStart = performance.now();
      const data = await this.dataService.fetchCandles({
        pair,
        granularity,
        start: startTime,
        end: endTime,
        limit: maxCandles || 10000 // Support 5 years of data (5 years ≈ 2.6M 1m candles, but start with 10k for performance)
      });
      const fetchEnd = performance.now();
      
      if (granularity === '1d' || granularity === '1D') {
        ChartDebug.critical(`[PERF] fetchHistoricalData took ${fetchEnd - fetchStart}ms`);
      }
      
      console.log(`✅ [DataStore] Data loaded successfully: ${data.length} candles for ${pair}/${granularity}`);
      this.setCandles(data);
      this.updateStats();
      
      // Get initial DB count
      this.updateDatabaseCount();
      
      // Special debug for 1d/3M combination
      if (granularity === '1d' || granularity === '1D') {
        const timeRange = endTime - startTime;
        const expectedCandles = Math.ceil(timeRange / 86400); // 86400 seconds = 1 day
        ChartDebug.critical(`1d granularity debug: Expected ${expectedCandles} candles, Got ${data.length} candles`);
        ChartDebug.critical(`Time range: ${new Date(startTime * 1000).toISOString()} to ${new Date(endTime * 1000).toISOString()}`);
      }
      
      ChartDebug.log(`Data loaded: ${data.length} candles for ${pair} ${granularity}`);
      
      // ⚠️ DISABLED: Auto-load historical data
      // This was causing 18M+ candles to be stored for 1m granularity (5 years = 2.6M candles)
      // TODO: Implement proper multi-granularity storage strategy:
      // - 1m: Store last 1-2 days only (~2,880 candles)
      // - 5m: Store last 1-2 weeks (~4,032 candles)
      // - 15m: Store last month (~2,880 candles)
      // - 1h: Store last 3-6 months (~4,320-8,640 candles)
      // - 6h: Store last 1-2 years (~2,920 candles)
      // - 1d: Store 5+ years (~1,825 candles)
      //
      // The backend MultiGranularityAggregator already generates all timeframes,
      // we just need to configure appropriate retention policies per granularity
      console.log(`📊 Historical data auto-load disabled to prevent excessive storage`);
      
      if (granularity === '1d' || granularity === '1D') {
        ChartDebug.critical(`[PERF] dataStore.loadData completed in ${performance.now() - loadStartTime}ms`);
      }
    } catch (error) {
      console.error(`❌ [DataStore] Error loading data for ${pair}/${granularity}:`, error);
      ChartDebug.error('Error loading data:', error);
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
    console.log(`📊 [DataStore] Setting ${candles.length} candles`);
    if (candles.length > 0) {
      console.log(`📊 [DataStore] First candle:`, candles[0]);
      console.log(`📊 [DataStore] Last candle:`, candles[candles.length - 1]);
      console.log(`📊 [DataStore] Volume check - last candle volume:`, candles[candles.length - 1].volume);
      
      // Check if any candles have volume data
      const candlesWithVolume = candles.filter(c => c.volume && c.volume > 0);
      console.log(`📊 [DataStore] Candles with volume data: ${candlesWithVolume.length}/${candles.length}`);
    }
    
    this._candles = candles;
    this._visibleCandles = candles; // Initially all candles are visible
    
    // Update latest price
    if (candles.length > 0) {
      const lastCandle = candles[candles.length - 1];
      this._latestPrice = lastCandle.close;
    }
    
    // Update stats to trigger UI updates
    this.updateStats();
    
    // Debug the state after setting candles
    this.debug();
    
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
        
        console.log(`📈 Added ${historicalData.length} historical candles. Total: ${mergedCandles.length}`);
        return historicalData.length;
      }
      
      return 0;
    } catch (error) {
      console.error('❌ Error fetching historical data:', error);
      return 0;
    }
  }

  updateVisibleRange(from: number, to: number) {
    // Debug visible range calculation
    if (this._candles.length > 0) {
      const granularity = this.getCurrentConfig().granularity;
      if (granularity === '1d' || granularity === '1D') {
        ChartDebug.critical(`[dataStore] updateVisibleRange called for 1d granularity:`);
        ChartDebug.critical(`- From: ${new Date(from * 1000).toISOString()}`);
        ChartDebug.critical(`- To: ${new Date(to * 1000).toISOString()}`);
        ChartDebug.critical(`- Time range: ${(to - from) / 86400} days`);
        ChartDebug.critical(`- Total candles available: ${this._candles.length}`);
        
        // Show first and last candle times
        if (this._candles.length > 0) {
          ChartDebug.critical(`- First available candle: ${new Date((this._candles[0].time as number) * 1000).toISOString()}`);
          ChartDebug.critical(`- Last available candle: ${new Date((this._candles[this._candles.length - 1].time as number) * 1000).toISOString()}`);
        }
      }
    }
    
    this._visibleCandles = this._candles.filter(
      candle => candle.time >= from && candle.time <= to
    );
    
    this._dataStats.visibleCount = this._visibleCandles.length;
    
    // Debug result for 1d granularity
    const granularity = this.getCurrentConfig().granularity;
    if (granularity === '1d') {
      ChartDebug.critical(`Visible candles after filter: ${this._visibleCandles.length}`);
      if (this._visibleCandles.length > 0) {
        ChartDebug.critical(`- First visible: ${new Date((this._visibleCandles[0].time as number) * 1000).toISOString()}`);
        ChartDebug.critical(`- Last visible: ${new Date((this._visibleCandles[this._visibleCandles.length - 1].time as number) * 1000).toISOString()}`);
      }
    }
  }

  // Realtime updates
  subscribeToRealtime(
    pair: string,
    granularity: string,
    onUpdate?: (candle: CandlestickData) => void,
    onReconnect?: () => void
  ) {
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
        console.log(`🔄 [DataStore] Received real-time update:`, {
          time: update.time,
          close: update.close,
          volume: update.volume,
          hasVolume: !!update.volume
        });
        
        const candleData: CandlestickData = {
          time: update.time,
          open: update.open,
          high: update.high,
          low: update.low,
          close: update.close,
          volume: update.volume || 0
        };

        console.log(`🔄 [DataStore] Formatted candle data with volume:`, {
          time: candleData.time,
          close: candleData.close,
          volume: candleData.volume
        });

        // Update or add candle IN-PLACE without triggering Svelte reactivity on historical candles
        const existingIndex = this._candles.findIndex(c => c.time === update.time);

        if (existingIndex >= 0) {
          // Update existing candle IN-PLACE (last candle only)
          // This is safe because it's always the most recent candle
          const lastIndex = this._candles.length - 1;
          if (existingIndex === lastIndex) {
            // Update the last candle directly - this won't trigger historical candle re-renders
            this._candles[lastIndex] = candleData;
            console.log(`🔄 [DataStore] Updated live candle at index ${lastIndex}`);
          }
        } else {
          // New candle - append without replacing the entire array
          this._candles.push(candleData);
          console.log(`🆕 [DataStore] Added new candle, total: ${this._candles.length}`);
        }

        // Update latest price for status display
        this._latestPrice = update.close;

        // Update stats timestamp only
        this._dataStats.lastUpdate = Date.now();

        console.log(`🔄 [DataStore] Real-time update processed (candle updated, no plugin notifications)`);

        // DO NOT call notifyDataUpdate() - it triggers plugin refreshes which call setData()
        // The candle is already updated in the array, chart will get it via the callback

        // Notify callback if provided
        if (onUpdate) {
          onUpdate(candleData);
        }
      },
      onReconnect
    );
  }

  unsubscribeFromRealtime() {
    if (this.realtimeUnsubscribe) {
      this.realtimeUnsubscribe();
      this.realtimeUnsubscribe = null;
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

      // Get total count across ALL granularities
      const totalResponse = await fetch(`http://localhost:4828/api/trading/total-candles?pair=${config.pair}`);
      if (totalResponse.ok) {
        const totalData = await totalResponse.json();
        if (totalData.success) {
          this._dataStats.totalDatabaseCount = totalData.data.totalCandles;
          console.log(`📊 Updated TOTAL DB count: ${totalData.data.totalCandles} candles across all granularities`);
          console.log(`📊 Breakdown:`, totalData.data.breakdown);
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
        console.log(`📊 Updated current granularity DB count: ${dbCount} candles`);
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
    console.log('🐛 [DataStore Debug]', {
      totalCandles: this._candles.length,
      visibleCandles: this._visibleCandles.length,
      latestPrice: this._latestPrice,
      stats: this._dataStats,
      firstCandle: this._candles[0],
      lastCandle: this._candles[this._candles.length - 1]
    });
    
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

  private notifyDataUpdate() {
    console.log(`🔔 [DataStore] notifyDataUpdate called, callbacks: ${this.dataUpdateCallbacks.size}`);
    this.dataUpdateCallbacks.forEach((callback, index) => {
      try {
        console.log(`🔔 [DataStore] Calling data update callback ${index + 1}/${this.dataUpdateCallbacks.size}`);
        callback();
        console.log(`✅ [DataStore] Callback ${index + 1} completed successfully`);
      } catch (error) {
        console.error(`❌ [DataStore] Error in data update callback ${index + 1}:`, error);
      }
    });
    console.log(`🔔 [DataStore] All data update callbacks completed`);
  }
}

// Create and export singleton
export const dataStore = new DataStore();