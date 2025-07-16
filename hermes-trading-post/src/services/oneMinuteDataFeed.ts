import type { CandleData } from '../types/coinbase';
import { CoinbaseAPI } from './coinbaseApi';
import { CoinbaseWebSocket } from './coinbaseWebSocket';
import { OneMinuteCache } from './oneMinuteCache';
import { CandleAggregator } from './candleAggregator';

export class OneMinuteDataFeed {
  private api: CoinbaseAPI;
  private ws: CoinbaseWebSocket;
  private cache: OneMinuteCache;
  private symbol = 'BTC-USD';
  
  // Real-time update management
  private subscribers: Map<string, (data: CandleData, isNew?: boolean) => void> = new Map();
  private currentMinuteCandle: CandleData | null = null;
  private updateInterval: number | null = null;
  
  // Loading state
  private isLoading = false;
  private loadedRanges: Map<string, boolean> = new Map();

  constructor() {
    this.api = new CoinbaseAPI();
    this.ws = new CoinbaseWebSocket();
    this.cache = new OneMinuteCache();
    
    this.setupWebSocket();
    this.startMinuteTimer();
    this.startBackgroundLoading();
  }

  private setupWebSocket() {
    // Subscribe to real-time price updates
    this.ws.onPrice(async (price) => {
      await this.updateCurrentMinute(price);
    });
    
    this.ws.onStatus((status) => {
      console.log(`WebSocket status: ${status}`);
    });
  }

  private startMinuteTimer() {
    // Update every second to check for new minute
    this.updateInterval = window.setInterval(async () => {
      const now = Math.floor(Date.now() / 1000);
      const currentMinute = Math.floor(now / 60) * 60;
      
      // Check if we've moved to a new minute
      if (!this.currentMinuteCandle || this.currentMinuteCandle.time < currentMinute) {
        // Finalize previous minute if exists
        if (this.currentMinuteCandle) {
          await this.cache.updateCandle(this.symbol, this.currentMinuteCandle);
        }
        
        // Start new minute
        const price = this.ws.getLastPrice();
        if (price) {
          this.currentMinuteCandle = {
            time: currentMinute,
            open: price,
            high: price,
            low: price,
            close: price,
            volume: 0
          };
          
          // Notify subscribers about new candle
          this.notifySubscribers(this.currentMinuteCandle, true);
        }
      }
    }, 1000);
  }

  private async updateCurrentMinute(price: number) {
    const now = Math.floor(Date.now() / 1000);
    const currentMinute = Math.floor(now / 60) * 60;
    
    if (!this.currentMinuteCandle || this.currentMinuteCandle.time !== currentMinute) {
      // Create new minute candle
      this.currentMinuteCandle = {
        time: currentMinute,
        open: price,
        high: price,
        low: price,
        close: price,
        volume: 0
      };
    } else {
      // Update existing minute candle
      this.currentMinuteCandle.high = Math.max(this.currentMinuteCandle.high, price);
      this.currentMinuteCandle.low = Math.min(this.currentMinuteCandle.low, price);
      this.currentMinuteCandle.close = price;
    }
    
    // Notify subscribers about update
    this.notifySubscribers(this.currentMinuteCandle, false);
  }

  private async startBackgroundLoading() {
    // Load last 24 hours of 1m data immediately
    const now = Math.floor(Date.now() / 1000);
    const yesterday = now - 86400;
    await this.loadRange(yesterday, now);
    
    // Then progressively load older data
    setTimeout(async () => {
      await this.loadRange(now - 7 * 86400, yesterday); // Last week
      await this.loadRange(now - 30 * 86400, now - 7 * 86400); // Last month
      await this.loadRange(now - 365 * 86400, now - 30 * 86400); // Last year
    }, 5000);
  }

  private async loadRange(startTime: number, endTime: number): Promise<void> {
    const rangeKey = `${startTime}-${endTime}`;
    if (this.loadedRanges.has(rangeKey) || this.isLoading) return;
    
    this.isLoading = true;
    this.loadedRanges.set(rangeKey, true);
    
    try {
      // Check what we're missing
      const missing = await this.cache.getMissingRanges(this.symbol, startTime, endTime);
      
      // Load missing ranges from API
      for (const range of missing) {
        // Coinbase limits to 300 candles per request
        const chunkSize = 300 * 60; // 300 minutes in seconds
        
        for (let chunkStart = range.start; chunkStart < range.end; chunkStart += chunkSize) {
          const chunkEnd = Math.min(chunkStart + chunkSize, range.end);
          
          try {
            const candles = await this.api.getCandles(
              this.symbol,
              60, // 1-minute granularity
              chunkStart,
              chunkEnd
            );
            
            if (candles.length > 0) {
              await this.cache.storeCandles(this.symbol, candles);
            }
          } catch (error) {
            console.error(`Failed to load candles for range ${chunkStart}-${chunkEnd}:`, error);
          }
          
          // Small delay between requests
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Get data for a specific time range and granularity
   */
  async getData(startTime: number, endTime: number, granularity: string): Promise<CandleData[]> {
    // Ensure we have the data loaded
    await this.loadRange(startTime, endTime);
    
    // Get 1-minute candles from cache
    const oneMinCandles = await this.cache.getCandles(this.symbol, startTime, endTime);
    
    // Add current minute if in range
    if (this.currentMinuteCandle && 
        this.currentMinuteCandle.time >= startTime && 
        this.currentMinuteCandle.time <= endTime) {
      // Insert or update current minute
      const existing = oneMinCandles.findIndex(c => c.time === this.currentMinuteCandle!.time);
      if (existing >= 0) {
        oneMinCandles[existing] = this.currentMinuteCandle;
      } else {
        oneMinCandles.push(this.currentMinuteCandle);
        oneMinCandles.sort((a, b) => a.time - b.time);
      }
    }
    
    // Aggregate to requested granularity
    return CandleAggregator.aggregate(oneMinCandles, granularity);
  }

  /**
   * Subscribe to real-time updates
   */
  subscribe(id: string, callback: (data: CandleData, isNew?: boolean) => void): void {
    this.subscribers.set(id, callback);
  }

  /**
   * Unsubscribe from updates
   */
  unsubscribe(id: string): void {
    this.subscribers.delete(id);
  }

  private notifySubscribers(candle: CandleData, isNew: boolean) {
    this.subscribers.forEach(callback => {
      callback(candle, isNew);
    });
  }

  /**
   * Get total cached candle count
   */
  async getTotalCandleCount(): Promise<number> {
    const meta = await this.cache.getMetadata(this.symbol);
    return meta?.totalCandles || 0;
  }

  /**
   * Clean up resources
   */
  disconnect() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
    this.ws.disconnect();
  }
}