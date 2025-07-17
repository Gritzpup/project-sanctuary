import type { CandlestickData } from 'lightweight-charts';
import type { WebSocketCandle } from '../types/data.types';
import { ChartDataService } from '../services/ChartDataService';

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
    try {
      await this.dataService.initialize(pair, granularity);
      const data = await this.dataService.fetchHistoricalData(startTime, endTime);
      
      this.setCandles(data);
      this.updateStats();
    } catch (error) {
      console.error('DataStore: Error loading data:', error);
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

  setCandles(candles: CandlestickData[]) {
    this._candles = candles;
    this._visibleCandles = candles; // Initially all candles are visible
    
    // Update latest price
    if (candles.length > 0) {
      const lastCandle = candles[candles.length - 1];
      this._latestPrice = lastCandle.close;
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
    onUpdate?: (candle: CandlestickData) => void
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
      }
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