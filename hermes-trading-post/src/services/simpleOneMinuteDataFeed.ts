import type { CandleData } from '../types/coinbase';
import { CoinbaseAPI } from './coinbaseApi';
import { CoinbaseWebSocket } from './coinbaseWebSocket';
import { OneMinuteCache } from './oneMinuteCache';
import { CandleAggregator } from './candleAggregator';

export class SimpleOneMinuteDataFeed {
  private api: CoinbaseAPI;
  private ws: CoinbaseWebSocket;
  private cache: OneMinuteCache;
  private symbol = 'BTC-USD';
  
  // Real-time state
  private subscribers: Map<string, (data: CandleData[], granularity: string) => void> = new Map();
  private currentMinuteCandle: CandleData | null = null;
  private updateTimer: number | null = null;
  
  // Demo mode to generate test data
  private demoMode = false;
  private demoCandles: CandleData[] = [];

  constructor() {
    this.api = new CoinbaseAPI();
    this.ws = new CoinbaseWebSocket();
    this.cache = new OneMinuteCache();
    
    this.initialize();
  }

  private async initialize() {
    // Check if we can load from API
    try {
      const now = Math.floor(Date.now() / 1000);
      const testCandles = await this.api.getCandles(this.symbol, 60, now - 300, now);
      if (testCandles.length === 0) {
        throw new Error('No candles returned');
      }
    } catch (error) {
      console.log('API not working, using demo mode with generated data');
      this.demoMode = true;
      this.generateDemoData();
    }

    this.setupWebSocket();
    this.startMinuteTimer();
    
    if (!this.demoMode) {
      this.loadInitialData();
    }
  }

  private generateDemoData() {
    // Generate realistic-looking demo data for the last 7 days
    const now = Math.floor(Date.now() / 1000);
    const currentMinute = Math.floor(now / 60) * 60;
    const basePrice = 100000; // Starting at $100k
    let price = basePrice;
    
    // Generate 7 days of 1-minute data (10,080 candles)
    const totalMinutes = 7 * 24 * 60;
    
    for (let i = totalMinutes; i > 0; i--) {
      const time = currentMinute - (i * 60); // Each candle is exactly 1 minute before the previous
      
      // Random walk with trend
      const change = (Math.random() - 0.48) * 100; // Slight upward bias
      price = Math.max(price + change, basePrice * 0.95); // Don't go below 95k
      price = Math.min(price, basePrice * 1.05); // Don't go above 105k
      
      const volatility = Math.random() * 50;
      const high = price + volatility;
      const low = price - volatility;
      const open = price + (Math.random() - 0.5) * volatility;
      const close = price + (Math.random() - 0.5) * volatility;
      
      this.demoCandles.push({
        time,
        open,
        high: Math.max(open, close, high),
        low: Math.min(open, close, low),
        close,
        volume: Math.random() * 100
      });
      
      price = close; // Next candle starts where this one closed
    }
    
    console.log(`Generated ${this.demoCandles.length} demo candles from ${new Date(this.demoCandles[0].time * 1000).toISOString()} to ${new Date(this.demoCandles[this.demoCandles.length - 1].time * 1000).toISOString()}`);
    
    // Store in cache
    this.cache.storeCandles(this.symbol, this.demoCandles);
  }

  private setupWebSocket() {
    this.ws.onPrice(async (price) => {
      await this.updateCurrentMinute(price);
    });
  }

  private startMinuteTimer() {
    // Check every second for new minute
    this.updateTimer = window.setInterval(() => {
      const now = Math.floor(Date.now() / 1000);
      const currentMinute = Math.floor(now / 60) * 60;
      
      if (!this.currentMinuteCandle || this.currentMinuteCandle.time < currentMinute) {
        // New minute started
        if (this.currentMinuteCandle) {
          // Save previous minute
          this.cache.updateCandle(this.symbol, this.currentMinuteCandle);
          if (this.demoMode) {
            this.demoCandles.push(this.currentMinuteCandle);
          }
        }
        
        // Start new minute
        const price = this.demoMode ? 
          (this.demoCandles[this.demoCandles.length - 1]?.close || 100000) :
          (this.ws.getLastPrice() || this.currentMinuteCandle?.close || 100000);
          
        this.currentMinuteCandle = {
          time: currentMinute,
          open: price,
          high: price,
          low: price,
          close: price,
          volume: 0
        };
        
        // Notify all subscribers with their requested granularity
        this.notifyAllSubscribers();
      }
    }, 1000);
  }

  private async updateCurrentMinute(price: number) {
    const now = Math.floor(Date.now() / 1000);
    const currentMinute = Math.floor(now / 60) * 60;
    
    if (!this.currentMinuteCandle || this.currentMinuteCandle.time !== currentMinute) {
      this.currentMinuteCandle = {
        time: currentMinute,
        open: price,
        high: price,
        low: price,
        close: price,
        volume: 0
      };
    } else {
      this.currentMinuteCandle.high = Math.max(this.currentMinuteCandle.high, price);
      this.currentMinuteCandle.low = Math.min(this.currentMinuteCandle.low, price);
      this.currentMinuteCandle.close = price;
    }
    
    // In demo mode, update the price randomly
    if (this.demoMode && this.currentMinuteCandle) {
      const change = (Math.random() - 0.5) * 10;
      const newPrice = this.currentMinuteCandle.close + change;
      this.currentMinuteCandle.high = Math.max(this.currentMinuteCandle.high, newPrice);
      this.currentMinuteCandle.low = Math.min(this.currentMinuteCandle.low, newPrice);
      this.currentMinuteCandle.close = newPrice;
    }
    
    // Notify subscribers with just the current candle for real-time updates
    this.notifyRealtimeUpdate();
  }

  private async loadInitialData() {
    const now = Math.floor(Date.now() / 1000);
    
    // Load last 24 hours
    try {
      const dayAgo = now - 86400;
      const missing = await this.cache.getMissingRanges(this.symbol, dayAgo, now);
      
      for (const range of missing) {
        const candles = await this.api.getCandles(this.symbol, 60, range.start, range.end);
        if (candles.length > 0) {
          await this.cache.storeCandles(this.symbol, candles);
        }
      }
    } catch (error) {
      console.error('Failed to load initial data:', error);
    }
  }

  async getData(startTime: number, endTime: number, granularity: string): Promise<CandleData[]> {
    if (this.demoMode) {
      // Use demo data
      const relevantCandles = this.demoCandles.filter(c => c.time >= startTime && c.time <= endTime);
      
      // Add current minute if in range
      if (this.currentMinuteCandle && 
          this.currentMinuteCandle.time >= startTime && 
          this.currentMinuteCandle.time <= endTime) {
        relevantCandles.push(this.currentMinuteCandle);
      }
      
      // Aggregate to requested granularity
      return CandleAggregator.aggregate(relevantCandles, granularity);
    }
    
    // Load from cache
    const candles = await this.cache.getCandles(this.symbol, startTime, endTime);
    
    // Add current minute if in range
    if (this.currentMinuteCandle && 
        this.currentMinuteCandle.time >= startTime && 
        this.currentMinuteCandle.time <= endTime) {
      const existing = candles.findIndex(c => c.time === this.currentMinuteCandle!.time);
      if (existing >= 0) {
        candles[existing] = this.currentMinuteCandle;
      } else {
        candles.push(this.currentMinuteCandle);
        candles.sort((a, b) => a.time - b.time);
      }
    }
    
    // Aggregate to requested granularity
    return CandleAggregator.aggregate(candles, granularity);
  }

  subscribe(id: string, granularity: string, callback: (data: CandleData[], granularity: string) => void): void {
    this.subscribers.set(`${id}-${granularity}`, callback);
  }

  unsubscribe(id: string): void {
    // Remove all subscriptions for this id
    for (const key of this.subscribers.keys()) {
      if (key.startsWith(`${id}-`)) {
        this.subscribers.delete(key);
      }
    }
  }

  private async notifyAllSubscribers() {
    // Don't auto-notify with arbitrary data
    // Let the chart request the specific range it needs
  }
  
  private async notifyRealtimeUpdate() {
    if (!this.currentMinuteCandle) return;
    
    // Notify each subscriber with the current candle in their requested granularity
    for (const [key, callback] of this.subscribers) {
      const [id, granularity] = key.split('-');
      
      // For 1m granularity, send the current minute candle
      if (granularity === '1m') {
        callback([this.currentMinuteCandle], granularity);
      }
      // For other granularities, only send if it's part of their candle
      // (e.g., for 5m, only send if current minute is 0, 5, 10, 15, etc.)
    }
  }

  private getGranularitySeconds(granularity: string): number {
    const map: Record<string, number> = {
      '1m': 60,
      '5m': 300,
      '15m': 900,
      '1h': 3600,
      '6h': 21600,
      '1d': 86400
    };
    return map[granularity] || 60;
  }

  async getTotalCandleCount(): Promise<number> {
    if (this.demoMode) {
      return this.demoCandles.length;
    }
    const meta = await this.cache.getMetadata(this.symbol);
    return meta?.totalCandles || 0;
  }

  disconnect() {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
    }
    this.ws.disconnect();
  }
}