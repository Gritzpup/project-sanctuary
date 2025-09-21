import type { CandlestickData } from 'lightweight-charts';
import type { WebSocketCandle } from '../types/data.types';
import { ChartDataService } from '../services/ChartDataService';
import { ChartDebug } from '../utils/debug';

class DataStore {
  private dataService = new ChartDataService();
  private _candles = $state<CandlestickData[]>([]);
  private _visibleCandles = $state<CandlestickData[]>([]);
  private _latestPrice = $state<number | null>(null);
  private _isNewCandle = $state<boolean>(false);
  private _dataStats = $state({
    totalCount: 0,
    visibleCount: 0,
    oldestTime: null as number | null,
    newestTime: null as number | null,
    lastUpdate: null as number | null
  });
  
  private realtimeUnsubscribe: (() => void) | null = null;
  private newCandleTimeout: NodeJS.Timeout | null = null;

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

  // Data management
  async loadData(
    pair: string,
    granularity: string,
    startTime: number,
    endTime: number
  ): Promise<void> {
    const loadStartTime = performance.now();
    
    try {
      if (granularity === '1d' || granularity === '1D') {
        ChartDebug.critical(`[PERF] dataStore.loadData started`);
      }
      
      await this.dataService.initialize(pair, granularity);
      
      if (granularity === '1d' || granularity === '1D') {
        ChartDebug.critical(`[PERF] About to fetch historical data`);
      }
      
      const fetchStart = performance.now();
      const data = await this.dataService.fetchHistoricalData(startTime, endTime);
      const fetchEnd = performance.now();
      
      if (granularity === '1d' || granularity === '1D') {
        ChartDebug.critical(`[PERF] fetchHistoricalData took ${fetchEnd - fetchStart}ms`);
      }
      
      this.setCandles(data);
      this.updateStats();
      
      // Special debug for 1d/3M combination
      if (granularity === '1d' || granularity === '1D') {
        const timeRange = endTime - startTime;
        const expectedCandles = Math.ceil(timeRange / 86400); // 86400 seconds = 1 day
        ChartDebug.critical(`1d granularity debug: Expected ${expectedCandles} candles, Got ${data.length} candles`);
        ChartDebug.critical(`Time range: ${new Date(startTime * 1000).toISOString()} to ${new Date(endTime * 1000).toISOString()}`);
      }
      
      ChartDebug.log(`Data loaded: ${data.length} candles for ${pair} ${granularity}`);
      
      if (granularity === '1d' || granularity === '1D') {
        ChartDebug.critical(`[PERF] dataStore.loadData completed in ${performance.now() - loadStartTime}ms`);
      }
    } catch (error) {
      console.error('[DataStore] Error loading data:', error);
      ChartDebug.error('Error loading data:', error);
      throw error;
    }
  }

  async reloadData(startTime: number, endTime: number): Promise<void> {
    const data = await this.dataService.reloadData({
      from: startTime,
      to: endTime
    });
    
    this.setCandles(data);
    this.updateStats();
  }

  async fetchGapData(fromTime: number, toTime: number): Promise<CandlestickData[]> {
    ChartDebug.log(`Fetching gap data from ${new Date(fromTime * 1000).toISOString()} to ${new Date(toTime * 1000).toISOString()}`);
    
    try {
      // Fetch data for the gap period without using cache
      const gapData = await this.dataService.fetchHistoricalData(fromTime, toTime, false);
      
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

  setCandles(candles: CandlestickData[]) {
    this._candles = candles;
    this._visibleCandles = candles; // Initially all candles are visible
    
    // Update latest price
    if (candles.length > 0) {
      const lastCandle = candles[candles.length - 1];
      this._latestPrice = lastCandle.close;
    }
    
    // Update stats to trigger UI updates
    this.updateStats();
  }

  updateVisibleRange(from: number, to: number) {
    // Debug visible range calculation
    if (this._candles.length > 0) {
      const granularity = this.dataService.currentGranularity;
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
    if (this.dataService.currentGranularity === '1d') {
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
    // Unsubscribe from previous
    this.unsubscribeFromRealtime();

    this.realtimeUnsubscribe = this.dataService.subscribeToRealtime(
      (update: WebSocketCandle) => {
        const candleData: CandlestickData = {
          time: update.time,
          open: update.open,
          high: update.high,
          low: update.low,
          close: update.close,
          volume: update.volume
        };

        // Update or add candle
        const existingIndex = this._candles.findIndex(c => c.time === update.time);
        
        if (existingIndex >= 0) {
          // Update existing candle
          this._candles[existingIndex] = candleData;
        } else {
          // New candle
          this._candles = [...this._candles, candleData].sort(
            (a, b) => (a.time as number) - (b.time as number)
          );
          this.triggerNewCandle();
        }

        // Update latest price
        this._latestPrice = update.close;
        
        // Update stats
        this._dataStats.lastUpdate = Date.now();

        // Notify callback if provided
        if (onUpdate) {
          onUpdate(candleData);
        }
      },
      undefined, // onError
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
    
    this._dataStats = {
      totalCount: count,
      visibleCount: this._visibleCandles.length,
      oldestTime: count > 0 ? this._candles[0].time as number : null,
      newestTime: count > 0 ? this._candles[count - 1].time as number : null,
      lastUpdate: Date.now()
    };
    
  }

  // Cache management
  async clearCache() {
    await this.dataService.clearCache();
  }

  getCacheStatus() {
    return this.dataService.getCacheStatus();
  }

  // Cleanup
  destroy() {
    this.unsubscribeFromRealtime();
    
    if (this.newCandleTimeout) {
      clearTimeout(this.newCandleTimeout);
    }
    
    this.dataService.destroy();
  }

  reset() {
    this._candles = [];
    this._visibleCandles = [];
    this._latestPrice = null;
    this._isNewCandle = false;
    this._dataStats = {
      totalCount: 0,
      visibleCount: 0,
      oldestTime: null,
      newestTime: null,
      lastUpdate: null
    };
  }
}

// Create and export singleton
export const dataStore = new DataStore();