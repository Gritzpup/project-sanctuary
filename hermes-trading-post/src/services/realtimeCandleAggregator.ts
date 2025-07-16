import type { CandlestickData } from 'lightweight-charts';
import { coinbaseWebSocket } from './coinbaseWebSocket';
import { indexedDBCache } from './indexedDBCache';
import { CoinbaseAPI } from './coinbaseApi';
import { redisService } from './redisService';

export interface CandleUpdate {
  symbol: string;
  candle: CandlestickData;
  isNewCandle: boolean;
}

class RealtimeCandleAggregator {
  private currentCandles: Map<string, CandlestickData> = new Map();
  private listeners: Set<(update: CandleUpdate) => void> = new Set();
  private intervals: Map<string, NodeJS.Timeout> = new Map();
  private lastPrices: Map<string, number> = new Map();
  private api: CoinbaseAPI;

  constructor() {
    this.api = new CoinbaseAPI();
    this.initializeRedis();
  }

  private async initializeRedis() {
    try {
      await redisService.connect();
      console.log('RealtimeCandleAggregator: Redis initialized');
    } catch (error) {
      console.error('RealtimeCandleAggregator: Failed to initialize Redis:', error);
    }
  }

  private processTick(symbol: string, price: number, timestamp: number) {
    // Calculate the current minute boundary (in seconds for lightweight-charts)
    const minuteTime = Math.floor(timestamp / 60000) * 60;
    const currentCandle = this.currentCandles.get(symbol);
    
    // Debug logging
    const debugTime = new Date(timestamp);
    const debugMinute = new Date(minuteTime * 1000);
    console.log(`Process tick: ${debugTime.toISOString()} -> Minute boundary: ${debugMinute.toISOString()} (${minuteTime}s)`);
    
    if (!currentCandle || currentCandle.time !== minuteTime) {
      // Need to create a new candle
      console.log(`Creating new candle at ${new Date(minuteTime * 1000).toISOString()} (${minuteTime}s)`);
      this.createNewCandle(symbol, price, minuteTime);
    } else {
      // Update existing candle
      console.log(`Updating existing candle at ${new Date(minuteTime * 1000).toISOString()}`);
      this.updateCandle(symbol, price);
    }
    
    // Store last price for next candle open
    this.lastPrices.set(symbol, price);
  }

  private createNewCandle(symbol: string, price: number, time: number) {
    // If there's a previous candle, finalize it
    const previousCandle = this.currentCandles.get(symbol);
    if (previousCandle) {
      // Save to cache
      this.saveCandle(symbol, previousCandle);
    }

    // Create new candle
    const newCandle: CandlestickData = {
      time: time,
      open: this.lastPrices.get(symbol) || price,
      high: price,
      low: price,
      close: price
    };

    this.currentCandles.set(symbol, newCandle);
    
    // Notify listeners about new candle
    this.notifyListeners({
      symbol,
      candle: newCandle,
      isNewCandle: true
    });

    // Set up timer for next candle
    this.scheduleNextCandle(symbol);
  }

  private updateCandle(symbol: string, price: number) {
    const candle = this.currentCandles.get(symbol);
    if (!candle) return;

    // Update OHLC values
    candle.high = Math.max(candle.high, price);
    candle.low = Math.min(candle.low, price);
    candle.close = price;

    // Notify listeners about candle update
    this.notifyListeners({
      symbol,
      candle: { ...candle },
      isNewCandle: false
    });
  }

  private scheduleNextCandle(symbol: string) {
    // Clear existing timer
    const existingTimer = this.intervals.get(symbol);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Calculate time until next minute
    const now = Date.now();
    const nextMinute = Math.ceil(now / 60000) * 60000;
    const timeUntilNext = nextMinute - now;

    console.log(`Scheduling next candle in ${timeUntilNext}ms at ${new Date(nextMinute).toISOString()}`);
    
    // Schedule candle creation with small buffer to ensure we're past boundary
    const timer = setTimeout(() => {
      const currentPrice = this.lastPrices.get(symbol);
      console.log(`Timer fired for new candle at ${new Date(nextMinute).toISOString()}, price: ${currentPrice}`);
      if (currentPrice) {
        // Force create new candle at exact minute boundary
        this.processTick(symbol, currentPrice, nextMinute);
      }
      // Sync with API for accuracy
      this.syncWithAPI(symbol);
    }, timeUntilNext + 100); // Add 100ms buffer

    this.intervals.set(symbol, timer);
  }

  private async syncWithAPI(symbol: string) {
    try {
      // Fetch last 2 minutes from API to ensure accuracy
      const endTime = new Date();
      const startTime = new Date(endTime.getTime() - 120000); // 2 minutes ago
      
      const candles = await this.api.getCandles(
        symbol,
        '60', // 1 minute granularity
        startTime.toISOString(),
        endTime.toISOString()
      );
      
      if (candles && candles.length > 0) {
        // Update the current candle with accurate data from API
        const latestApiCandle = candles[candles.length - 1];
        const currentCandle = this.currentCandles.get(symbol);
        
        if (currentCandle && currentCandle.time === latestApiCandle.time) {
          // Update with accurate OHLC from API
          currentCandle.open = latestApiCandle.open;
          currentCandle.high = latestApiCandle.high;
          currentCandle.low = latestApiCandle.low;
          currentCandle.close = latestApiCandle.close;
          
          // Notify listeners of the update
          this.notifyListeners({
            symbol,
            candle: { ...currentCandle },
            isNewCandle: false
          });
          
          // Save to cache
          await this.saveCandle(symbol, currentCandle);
          console.log(`Synced candle with API for ${new Date(currentCandle.time * 1000).toISOString()}`);
        }
      }
    } catch (error) {
      console.error('API sync failed:', error);
    }
  }

  private async saveCandle(symbol: string, candle: CandlestickData) {
    try {
      // Convert CandlestickData to CandleData (add volume field)
      const candleData = {
        ...candle,
        volume: 0 // Default volume since real-time ticker doesn't provide it
      };
      
      // Update Redis with current candle
      await redisService.updateCurrentCandle(symbol, '1m', candleData);
      
      // Get existing candles from cache (cache expects timestamps in seconds, not milliseconds)
      const cached = await indexedDBCache.getCachedCandles(symbol, '1m', candle.time - 86400, candle.time + 86400);
      if (cached && cached.candles) {
        const candles = [...cached.candles];
        // Check if candle already exists
        const existingIndex = candles.findIndex(c => c.time === candle.time);
        if (existingIndex >= 0) {
          // Update existing candle
          candles[existingIndex] = candleData;
        } else {
          // Add new candle in correct position
          candles.push(candleData);
          candles.sort((a, b) => a.time - b.time);
        }
        
        // Save back to cache
        await indexedDBCache.setCachedCandles(symbol, '1m', candles);
      }
    } catch (error) {
      console.error('Error saving candle to cache:', error);
    }
  }

  private notifyListeners(update: CandleUpdate) {
    this.listeners.forEach(listener => {
      try {
        listener(update);
      } catch (error) {
        console.error('Error notifying listener:', error);
      }
    });
  }

  subscribe(listener: (update: CandleUpdate) => void): () => void {
    this.listeners.add(listener);
    
    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }

  async startAggregating(symbol: string) {
    console.log(`RealtimeCandleAggregator: Starting aggregation for ${symbol}`);
    
    // Subscribe to Redis ticker updates for this symbol
    const unsubscribe = await redisService.subscribeTicker(symbol, (ticker) => {
      console.log(`RealtimeCandleAggregator: Received ticker from Redis for ${ticker.product_id} - price: ${ticker.price}`);
      this.processTick(ticker.product_id, ticker.price, ticker.time);
    });
    
    // Store unsubscribe function
    this.intervals.set(`${symbol}-unsub`, unsubscribe as any);
    
    // Subscribe to ticker channel for this symbol in WebSocket
    console.log(`RealtimeCandleAggregator: Subscribing to ticker for ${symbol}`);
    await coinbaseWebSocket.subscribeTicker(symbol);
    
    // Connect WebSocket if not already connected
    if (!coinbaseWebSocket.isConnected()) {
      console.log('RealtimeCandleAggregator: WebSocket not connected, connecting...');
      coinbaseWebSocket.connect();
    } else {
      console.log('RealtimeCandleAggregator: WebSocket already connected');
    }
    
    // Initialize with current price from Redis if available
    const latestPrice = await redisService.getLatestPrice(symbol);
    if (latestPrice) {
      console.log(`RealtimeCandleAggregator: Current price from Redis for ${symbol}: ${latestPrice.price}`);
      const now = Date.now();
      const minuteTime = Math.floor(now / 60000) * 60;
      this.createNewCandle(symbol, latestPrice.price, minuteTime);
    } else {
      console.log('RealtimeCandleAggregator: No current price available, waiting for first tick');
    }
  }

  async stopAggregating(symbol: string) {
    // Clear timer
    const timer = this.intervals.get(symbol);
    if (timer) {
      clearTimeout(timer);
      this.intervals.delete(symbol);
    }
    
    // Unsubscribe from Redis
    const unsubscribe = this.intervals.get(`${symbol}-unsub`);
    if (unsubscribe && typeof unsubscribe === 'function') {
      unsubscribe();
      this.intervals.delete(`${symbol}-unsub`);
    }
    
    // Clear current candle
    this.currentCandles.delete(symbol);
    this.lastPrices.delete(symbol);
    
    // Unsubscribe from ticker
    await coinbaseWebSocket.unsubscribeTicker(symbol);
  }

  getCurrentCandle(symbol: string): CandlestickData | undefined {
    return this.currentCandles.get(symbol);
  }

  cleanup() {
    // Clear all intervals
    this.intervals.forEach(timer => clearTimeout(timer));
    this.intervals.clear();
    
    // Clear all data
    this.currentCandles.clear();
    this.lastPrices.clear();
    this.listeners.clear();
  }
}

export const realtimeCandleAggregator = new RealtimeCandleAggregator();