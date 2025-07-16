import type { CandlestickData } from 'lightweight-charts';
import { coinbaseWebSocket } from './coinbaseWebSocket';
import { indexedDBCache } from './indexedDBCache';

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

  constructor() {
    // Subscribe to WebSocket ticker updates
    coinbaseWebSocket.subscribe((data) => {
      if (data.type === 'ticker' && data.price) {
        this.processTick(data.product_id, parseFloat(data.price), new Date(data.time).getTime());
      }
    });
  }

  private processTick(symbol: string, price: number, timestamp: number) {
    // Calculate the current minute boundary
    const minuteTime = Math.floor(timestamp / 60000) * 60;
    const currentCandle = this.currentCandles.get(symbol);
    
    if (!currentCandle || currentCandle.time !== minuteTime) {
      // Need to create a new candle
      this.createNewCandle(symbol, price, minuteTime);
    } else {
      // Update existing candle
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

    // Schedule candle creation
    const timer = setTimeout(() => {
      const currentPrice = this.lastPrices.get(symbol);
      if (currentPrice) {
        this.processTick(symbol, currentPrice, nextMinute);
      }
    }, timeUntilNext);

    this.intervals.set(symbol, timer);
  }

  private async saveCandle(symbol: string, candle: CandlestickData) {
    try {
      // Get existing candles from cache
      const cached = await indexedDBCache.getCachedData(symbol, '1m');
      if (cached) {
        // Check if candle already exists
        const existingIndex = cached.candles.findIndex(c => c.time === candle.time);
        if (existingIndex >= 0) {
          // Update existing candle
          cached.candles[existingIndex] = candle;
        } else {
          // Add new candle in correct position
          cached.candles.push(candle);
          cached.candles.sort((a, b) => a.time - b.time);
        }
        
        // Save back to cache
        await indexedDBCache.setCachedData(symbol, '1m', cached.candles);
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

  startAggregating(symbol: string) {
    // Connect WebSocket if not already connected
    if (!coinbaseWebSocket.isConnected()) {
      coinbaseWebSocket.connect();
    }
    
    // Subscribe to ticker channel for this symbol
    coinbaseWebSocket.subscribeTicker(symbol);
    
    // Initialize with current price if available
    const currentPrice = this.lastPrices.get(symbol);
    if (currentPrice) {
      const now = Date.now();
      const minuteTime = Math.floor(now / 60000) * 60;
      this.createNewCandle(symbol, currentPrice, minuteTime);
    }
  }

  stopAggregating(symbol: string) {
    // Clear timer
    const timer = this.intervals.get(symbol);
    if (timer) {
      clearTimeout(timer);
      this.intervals.delete(symbol);
    }
    
    // Clear current candle
    this.currentCandles.delete(symbol);
    this.lastPrices.delete(symbol);
    
    // Unsubscribe from ticker
    coinbaseWebSocket.unsubscribeTicker(symbol);
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