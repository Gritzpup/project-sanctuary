/**
 * @file realtimeCandleAggregator.ts
 * @description Builds live candles from streaming price data
 */

import type { CandlestickData, Time } from 'lightweight-charts';
import { webSocketManager } from '../webSocketManager';
import { indexedDBCache } from '../indexedDBCache';
import { CoinbaseAPI } from '../api/coinbaseApi';
import type { TickerData } from '../../types/coinbase';

export interface CandleUpdate {
  symbol: string;
  candle: CandlestickData;
  isNewCandle: boolean;
}

class RealtimeCandleAggregator {
  private currentCandles: Map<string, CandlestickData> = new Map();
  private listeners: Set<(update: CandleUpdate) => void> = new Set();
  private intervals: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private lastPrices: Map<string, number> = new Map();
  private api: CoinbaseAPI;
  private unregisterWebSocket: (() => void) | null = null;

  constructor() {
    this.api = new CoinbaseAPI();
    
    // Register as a WebSocket data consumer
    // console.log('RealtimeCandleAggregator: Registering as WebSocket consumer');
    this.unregisterWebSocket = webSocketManager.registerConsumer({
      id: 'realtime-candle-aggregator',
      onTicker: async (data: TickerData) => {
        if (data.price && data.time) {
          // console.log(`RealtimeCandleAggregator: Received ticker for ${data.product_id} - price: ${data.price}`);
          await this.processTick(data.product_id, parseFloat(data.price), new Date(data.time).getTime());
        }
      }
    });
  }

  private async processTick(symbol: string, price: number, timestamp: number) {
    // Calculate the current minute boundary (in seconds for lightweight-charts)
    // timestamp is in milliseconds, we need seconds for lightweight-charts
    const minuteTimeMs = Math.floor(timestamp / 60000) * 60000; // Round down to minute in ms
    const minuteTime = minuteTimeMs / 1000; // Convert to seconds
    const currentCandle = this.currentCandles.get(symbol);
    
    // Debug logging
    const debugTime = new Date(timestamp);
    const debugMinute = new Date(minuteTimeMs);
    // console.log(`Process tick: ${debugTime.toISOString()} -> Minute boundary: ${debugMinute.toISOString()} (${minuteTime}s)`);
    
    if (!currentCandle || currentCandle.time !== minuteTime) {
      // Need to create a new candle
      // console.log(`Creating new candle at ${new Date(minuteTimeMs).toISOString()} (${minuteTime}s)`);
      await this.createNewCandle(symbol, price, minuteTime);
    } else {
      // Update existing candle
      // console.log(`Updating existing candle at ${new Date(minuteTimeMs).toISOString()}`);
      this.updateCandle(symbol, price);
    }
    
    // Store last price for next candle open
    this.lastPrices.set(symbol, price);
  }

  private async createNewCandle(symbol: string, price: number, time: number) {
    // If there's a previous candle, finalize it
    const previousCandle = this.currentCandles.get(symbol);
    if (previousCandle) {
      // Save to cache
      this.saveCandle(symbol, previousCandle);
    }

    // Create new candle
    const newCandle: CandlestickData = {
      time: time as Time,
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
    
    // Immediately sync with API to get accurate OHLC values
    await this.syncNewCandleWithAPI(symbol, time);
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

    // Safety check: ensure we have a timer scheduled
    if (!this.intervals.has(symbol)) {
      console.warn(`No timer found for ${symbol} during update, scheduling one now`);
      this.scheduleNextCandle(symbol);
    }
  }

  private scheduleNextCandle(symbol: string) {
    // Clear existing timer
    const existingTimer = this.intervals.get(symbol);
    if (existingTimer) {
      // console.log(`Clearing existing timer for ${symbol}`);
      clearTimeout(existingTimer);
    }

    // Calculate time until next minute
    const now = Date.now();
    const nextMinute = Math.ceil(now / 60000) * 60000;
    const timeUntilNext = nextMinute - now;

    // console.log(`Current time: ${new Date(now).toISOString()}, Next minute: ${new Date(nextMinute).toISOString()}, Wait: ${timeUntilNext}ms`);
    
    // Schedule candle creation with small buffer to ensure we're past boundary
    const timer = setTimeout(async () => {
      // console.log(`Timer fired for ${symbol} at ${new Date().toISOString()}`);
      const currentPrice = this.lastPrices.get(symbol);
      // console.log(`Creating new candle at ${new Date(nextMinute).toISOString()}, current price: ${currentPrice}`);
      
      // Remove timer from map since it fired
      this.intervals.delete(symbol);
      
      if (currentPrice) {
        // Force create new candle at exact minute boundary
        await this.processTick(symbol, currentPrice, nextMinute);
      }
      // Sync with API for accuracy
      this.syncWithAPI(symbol);
    }, timeUntilNext + 100); // Add 100ms buffer

    // console.log(`Created timer for ${symbol}, will fire in ${timeUntilNext + 100}ms`);
    this.intervals.set(symbol, timer);
  }

  private async syncNewCandleWithAPI(symbol: string, candleTime: number, retryCount = 0) {
    try {
      // Check if this is the current minute - if so, skip sync
      const currentMinute = Math.floor(Date.now() / 60000) * 60000 / 1000;
      if (candleTime === currentMinute) {
        // console.log(`Skipping API sync for current minute candle at ${new Date(candleTime * 1000).toISOString()}`);
        return;
      }
      
      // Add a small delay to ensure API has the candle
      const delay = retryCount === 0 ? 1000 : Math.min(5000, 1000 * Math.pow(2, retryCount));
      await new Promise(resolve => setTimeout(resolve, delay));
      
      // Fetch candles around the specific time
      const targetTime = new Date(candleTime * 1000);
      const endTime = new Date(targetTime.getTime() + 60000); // 1 minute after
      const startTime = new Date(targetTime.getTime() - 60000); // 1 minute before
      
      // console.log(`Syncing candle at ${targetTime.toISOString()} with API (attempt ${retryCount + 1}`);
      
      const candles = await this.api.getCandles(
        symbol,
        60, // 1 minute granularity
        startTime.toISOString(),
        endTime.toISOString()
      );
      
      if (candles && candles.length > 0) {
        // Find the candle that matches our target time
        const targetCandle = candles.find(c => c.time === candleTime);
        if (targetCandle) {
          const currentCandle = this.currentCandles.get(symbol);
          
          if (currentCandle && currentCandle.time === candleTime) {
            // Update with accurate OHLC from API
            currentCandle.open = targetCandle.open;
            currentCandle.high = targetCandle.high;
            currentCandle.low = targetCandle.low;
            currentCandle.close = targetCandle.close;
            
            // Notify listeners of the update
            this.notifyListeners({
              symbol,
              candle: { ...currentCandle },
              isNewCandle: false
            });
            
            // console.log(`Successfully synced new candle with API for ${targetTime.toISOString()}`);
          }
        } else if (retryCount < 2) {
          // API might not have the candle yet, retry
          console.log(`API candle not found for ${targetTime.toISOString()}, retrying...`);
          setTimeout(() => {
            this.syncNewCandleWithAPI(symbol, candleTime, retryCount + 1);
          }, 2000);
        } else {
          console.log(`API candle not found after ${retryCount + 1} attempts, keeping WebSocket values`);
        }
      }
    } catch (error: any) {
      // Handle rate limiting gracefully
      if (error.response?.status === 429 || error.message?.includes('429')) {
        console.warn('API rate limit hit during sync, will retry later');
        if (retryCount < 2) {
          // Retry after longer delay for rate limits
          setTimeout(() => {
            this.syncNewCandleWithAPI(symbol, candleTime, retryCount + 1);
          }, 10000); // 10 second delay for rate limits
        }
      } else {
        console.error('API sync failed:', error.message || error);
      }
    }
  }

  private async syncWithAPI(symbol: string) {
    try {
      // Fetch last 2 minutes from API to ensure accuracy
      const endTime = new Date();
      const startTime = new Date(endTime.getTime() - 120000); // 2 minutes ago
      
      const candles = await this.api.getCandles(
        symbol,
        60, // 1 minute granularity
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
          // console.log(`Synced candle with API for ${new Date(currentCandle.time * 1000).toISOString()}`);
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
        time: candle.time as number,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        volume: 0 // Default volume since real-time ticker doesn't provide it
      };
      
      // Get existing candles from cache (cache expects timestamps in seconds, not milliseconds)
      const cached = await indexedDBCache.getCachedCandles(symbol, '1m', (candle.time as number) - 86400, (candle.time as number) + 86400);
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
    // console.log(`RealtimeCandleAggregator: Starting aggregation for ${symbol}`);
    
    // Connect WebSocket FIRST if not already connected
    await webSocketManager.connect();
    
    // Subscribe to ticker channel for this symbol
    // console.log(`RealtimeCandleAggregator: Subscribing to ticker for ${symbol}`);
    await webSocketManager.subscribeSymbol(symbol);
    
    // Initialize with current price if available
    const currentPrice = webSocketManager.getLastPrice(symbol) || this.lastPrices.get(symbol);
    // console.log(`RealtimeCandleAggregator: Current price for ${symbol}: ${currentPrice}`);
    if (currentPrice) {
      const now = Date.now();
      const minuteTimeMs = Math.floor(now / 60000) * 60000;
      const minuteTime = minuteTimeMs / 1000; // Convert to seconds
      
      // Check if we already have a candle for this minute
      const existingCandle = this.currentCandles.get(symbol);
      if (existingCandle && existingCandle.time === minuteTime) {
        // console.log(`RealtimeCandleAggregator: Already have candle for ${new Date(minuteTimeMs).toISOString()}, skipping creation`);
      } else {
        await this.createNewCandle(symbol, currentPrice, minuteTime);
      }
    } else {
      // console.log('RealtimeCandleAggregator: No current price available, waiting for first tick');
    }
  }

  async stopAggregating(symbol: string) {
    // console.log(`Stopping aggregation for ${symbol}`);
    // Clear timer
    const timer = this.intervals.get(symbol);
    if (timer) {
      // console.log(`Clearing timer for ${symbol} in stopAggregating`);
      clearTimeout(timer);
      this.intervals.delete(symbol);
    }
    
    // Clear current candle
    this.currentCandles.delete(symbol);
    this.lastPrices.delete(symbol);
    
    // Unsubscribe from ticker
    await webSocketManager.unsubscribeSymbol(symbol);
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
    
    // Unregister from WebSocket manager
    if (this.unregisterWebSocket) {
      this.unregisterWebSocket();
      this.unregisterWebSocket = null;
    }
  }
}

export const realtimeCandleAggregator = new RealtimeCandleAggregator();