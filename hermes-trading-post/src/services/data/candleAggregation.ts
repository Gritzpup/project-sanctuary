/**
 * Unified Candle Aggregation Service
 * Combines historical candle aggregation and real-time candle building
 * Eliminates duplication between candleAggregator.ts and realtimeCandleAggregator.ts
 */

import type { CandlestickData, Time } from 'lightweight-charts';
import type { CandleData, TickerData } from '../../types/coinbase';
import { webSocketManager } from '../api/webSocketManager';
import { indexedDBCache } from '../cache/indexedDB';
import { CoinbaseAPI } from '../api/coinbaseApi';

export interface CandleUpdate {
  symbol: string;
  candle: CandlestickData;
  isNewCandle: boolean;
}

/**
 * Unified Candle Aggregation Service
 * Handles both historical aggregation and real-time candle building
 */
export class CandleAggregationService {
  // Real-time state
  private currentCandles: Map<string, CandlestickData> = new Map();
  private listeners: Set<(update: CandleUpdate) => void> = new Set();
  private intervals: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private lastPrices: Map<string, number> = new Map();
  private api: CoinbaseAPI;
  private unregisterWebSocket: (() => void) | null = null;

  // Static granularity mapping
  private static readonly granularityMinutes: Record<string, number> = {
    '1m': 1,
    '5m': 5,
    '15m': 15,
    '30m': 30,
    '1h': 60,
    '4h': 240,
    '6h': 360,
    '1d': 1440
  };

  constructor() {
    this.api = new CoinbaseAPI();
    this.initializeWebSocket();
  }

  // ============================================================================
  // HISTORICAL AGGREGATION METHODS
  // ============================================================================

  /**
   * Aggregate 1-minute candles into larger timeframes
   */
  static aggregateCandles(oneMinCandles: CandleData[], targetGranularity: string): CandleData[] {
    const minutes = this.granularityMinutes[targetGranularity];
    if (!minutes || minutes === 1) {
      return oneMinCandles;
    }

    const sorted = [...oneMinCandles].sort((a, b) => a.time - b.time);
    if (sorted.length === 0) return [];

    const aggregated: CandleData[] = [];
    let currentBucket: CandleData | null = null;
    let bucketCandles: CandleData[] = [];

    for (const candle of sorted) {
      const bucketTime = Math.floor(candle.time / (minutes * 60)) * (minutes * 60);

      if (!currentBucket || currentBucket.time !== bucketTime) {
        if (currentBucket && bucketCandles.length > 0) {
          aggregated.push(this.finalizeHistoricalCandle(currentBucket, bucketCandles));
        }

        currentBucket = {
          time: bucketTime,
          open: candle.open,
          high: candle.high,
          low: candle.low,
          close: candle.close,
          volume: 0
        };
        bucketCandles = [];
      }

      bucketCandles.push(candle);
      currentBucket.high = Math.max(currentBucket.high, candle.high);
      currentBucket.low = Math.min(currentBucket.low, candle.low);
      currentBucket.close = candle.close;
      currentBucket.volume += candle.volume;
    }

    if (currentBucket && bucketCandles.length > 0) {
      aggregated.push(this.finalizeHistoricalCandle(currentBucket, bucketCandles));
    }

    return aggregated;
  }

  /**
   * Get the time range needed in 1m candles for a given range at a granularity
   */
  static getRequiredOneMinuteRange(
    startTime: number, 
    endTime: number, 
    granularity: string
  ): { start: number; end: number } {
    const minutes = this.granularityMinutes[granularity] || 1;
    const alignedStart = Math.floor(startTime / (minutes * 60)) * (minutes * 60);
    const alignedEnd = Math.ceil(endTime / (minutes * 60)) * (minutes * 60);
    return { start: alignedStart, end: alignedEnd };
  }

  /**
   * Check if we have enough 1m candles to generate the requested range
   */
  static canGenerateRange(
    oneMinCandles: CandleData[],
    startTime: number,
    endTime: number,
    granularity: string
  ): { canGenerate: boolean; missingRanges: Array<{ start: number; end: number }> } {
    const required = this.getRequiredOneMinuteRange(startTime, endTime, granularity);
    const existingMinutes = new Set(oneMinCandles.map(c => c.time));
    const missingRanges: Array<{ start: number; end: number }> = [];
    let missingStart: number | null = null;
    
    for (let time = required.start; time < required.end; time += 60) {
      if (!existingMinutes.has(time)) {
        if (missingStart === null) {
          missingStart = time;
        }
      } else if (missingStart !== null) {
        missingRanges.push({ start: missingStart, end: time });
        missingStart = null;
      }
    }
    
    if (missingStart !== null) {
      missingRanges.push({ start: missingStart, end: required.end });
    }
    
    return {
      canGenerate: missingRanges.length === 0,
      missingRanges
    };
  }

  private static finalizeHistoricalCandle(candle: CandleData, bucketCandles: CandleData[]): CandleData {
    if (bucketCandles.length > 0) {
      candle.open = bucketCandles[0].open;
      candle.close = bucketCandles[bucketCandles.length - 1].close;
    }
    return candle;
  }

  // ============================================================================
  // REAL-TIME AGGREGATION METHODS
  // ============================================================================

  private initializeWebSocket() {
    this.unregisterWebSocket = webSocketManager.registerConsumer({
      id: 'unified-candle-aggregator',
      onTicker: async (data: TickerData) => {
        if (data.price && data.time) {
          await this.processTick(data.product_id, parseFloat(data.price), new Date(data.time).getTime());
        }
      }
    });
  }

  private async processTick(symbol: string, price: number, timestamp: number) {
    const minuteTimeMs = Math.floor(timestamp / 60000) * 60000;
    const minuteTime = minuteTimeMs / 1000;
    const currentCandle = this.currentCandles.get(symbol);
    
    if (!currentCandle || currentCandle.time !== minuteTime) {
      await this.createNewCandle(symbol, price, minuteTime);
    } else {
      this.updateCandle(symbol, price);
    }
    
    this.lastPrices.set(symbol, price);
  }

  private async createNewCandle(symbol: string, price: number, time: number) {
    const previousCandle = this.currentCandles.get(symbol);
    if (previousCandle) {
      await this.saveCandle(symbol, previousCandle);
    }

    const newCandle: CandlestickData = {
      time: time as Time,
      open: this.lastPrices.get(symbol) || price,
      high: price,
      low: price,
      close: price
    };

    this.currentCandles.set(symbol, newCandle);
    
    this.notifyListeners({
      symbol,
      candle: newCandle,
      isNewCandle: true
    });

    this.scheduleNextCandle(symbol);
    await this.syncNewCandleWithAPI(symbol, time);
  }

  private updateCandle(symbol: string, price: number) {
    const candle = this.currentCandles.get(symbol);
    if (!candle) return;

    candle.high = Math.max(candle.high, price);
    candle.low = Math.min(candle.low, price);
    candle.close = price;

    this.notifyListeners({
      symbol,
      candle: { ...candle },
      isNewCandle: false
    });

    if (!this.intervals.has(symbol)) {
      console.warn(`No timer found for ${symbol} during update, scheduling one now`);
      this.scheduleNextCandle(symbol);
    }
  }

  private scheduleNextCandle(symbol: string) {
    const existingTimer = this.intervals.get(symbol);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const now = Date.now();
    const nextMinute = Math.ceil(now / 60000) * 60000;
    const timeUntilNext = nextMinute - now;
    
    const timer = setTimeout(async () => {
      this.intervals.delete(symbol);
      const currentPrice = this.lastPrices.get(symbol);
      
      if (currentPrice) {
        await this.processTick(symbol, currentPrice, nextMinute);
      }
      this.syncWithAPI(symbol);
    }, timeUntilNext + 100);

    this.intervals.set(symbol, timer);
  }

  private async syncNewCandleWithAPI(symbol: string, candleTime: number, retryCount = 0) {
    try {
      const currentMinute = Math.floor(Date.now() / 60000) * 60000 / 1000;
      if (candleTime === currentMinute) {
        return;
      }
      
      const delay = retryCount === 0 ? 1000 : Math.min(5000, 1000 * Math.pow(2, retryCount));
      await new Promise(resolve => setTimeout(resolve, delay));
      
      const targetTime = new Date(candleTime * 1000);
      const endTime = new Date(targetTime.getTime() + 60000);
      const startTime = new Date(targetTime.getTime() - 60000);
      
      const candles = await this.api.getCandles(
        symbol,
        60,
        startTime.toISOString(),
        endTime.toISOString()
      );
      
      if (candles && candles.length > 0) {
        const targetCandle = candles.find(c => c.time === candleTime);
        if (targetCandle) {
          const currentCandle = this.currentCandles.get(symbol);
          
          if (currentCandle && currentCandle.time === candleTime) {
            currentCandle.open = targetCandle.open;
            currentCandle.high = targetCandle.high;
            currentCandle.low = targetCandle.low;
            currentCandle.close = targetCandle.close;
            
            this.notifyListeners({
              symbol,
              candle: { ...currentCandle },
              isNewCandle: false
            });
          }
        } else if (retryCount < 2) {
          setTimeout(() => {
            this.syncNewCandleWithAPI(symbol, candleTime, retryCount + 1);
          }, 2000);
        }
      }
    } catch (error: any) {
      if (error.response?.status === 429 || error.message?.includes('429')) {
        if (retryCount < 2) {
          setTimeout(() => {
            this.syncNewCandleWithAPI(symbol, candleTime, retryCount + 1);
          }, 10000);
        }
      } else {
        console.error('API sync failed:', error.message || error);
      }
    }
  }

  private async syncWithAPI(symbol: string) {
    try {
      const endTime = new Date();
      const startTime = new Date(endTime.getTime() - 120000);
      
      const candles = await this.api.getCandles(
        symbol,
        60,
        startTime.toISOString(),
        endTime.toISOString()
      );
      
      if (candles && candles.length > 0) {
        const latestApiCandle = candles[candles.length - 1];
        const currentCandle = this.currentCandles.get(symbol);
        
        if (currentCandle && currentCandle.time === latestApiCandle.time) {
          currentCandle.open = latestApiCandle.open;
          currentCandle.high = latestApiCandle.high;
          currentCandle.low = latestApiCandle.low;
          currentCandle.close = latestApiCandle.close;
          
          this.notifyListeners({
            symbol,
            candle: { ...currentCandle },
            isNewCandle: false
          });
          
          await this.saveCandle(symbol, currentCandle);
        }
      }
    } catch (error) {
      console.error('API sync failed:', error);
    }
  }

  private async saveCandle(symbol: string, candle: CandlestickData) {
    try {
      const candleData = {
        time: candle.time as number,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        volume: 0
      };
      
      const cached = await indexedDBCache.getCachedCandles(symbol, '1m', (candle.time as number) - 86400, (candle.time as number) + 86400);
      if (cached && cached.candles) {
        const candles = [...cached.candles];
        const existingIndex = candles.findIndex(c => c.time === candle.time);
        if (existingIndex >= 0) {
          candles[existingIndex] = candleData;
        } else {
          candles.push(candleData);
          candles.sort((a, b) => a.time - b.time);
        }
        
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

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  subscribe(listener: (update: CandleUpdate) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async startAggregating(symbol: string) {
    await webSocketManager.connect();
    await webSocketManager.subscribeSymbol(symbol);
    
    const currentPrice = webSocketManager.getLastPrice(symbol) || this.lastPrices.get(symbol);
    if (currentPrice) {
      const now = Date.now();
      const minuteTimeMs = Math.floor(now / 60000) * 60000;
      const minuteTime = minuteTimeMs / 1000;
      
      const existingCandle = this.currentCandles.get(symbol);
      if (!existingCandle || existingCandle.time !== minuteTime) {
        await this.createNewCandle(symbol, currentPrice, minuteTime);
      }
    }
  }

  async stopAggregating(symbol: string) {
    const timer = this.intervals.get(symbol);
    if (timer) {
      clearTimeout(timer);
      this.intervals.delete(symbol);
    }
    
    this.currentCandles.delete(symbol);
    this.lastPrices.delete(symbol);
    await webSocketManager.unsubscribeSymbol(symbol);
  }

  getCurrentCandle(symbol: string): CandlestickData | undefined {
    return this.currentCandles.get(symbol);
  }

  cleanup() {
    this.intervals.forEach(timer => clearTimeout(timer));
    this.intervals.clear();
    this.currentCandles.clear();
    this.lastPrices.clear();
    this.listeners.clear();
    
    if (this.unregisterWebSocket) {
      this.unregisterWebSocket();
      this.unregisterWebSocket = null;
    }
  }
}

// Export singleton instance and static methods
export const candleAggregationService = new CandleAggregationService();

// Export legacy names for compatibility
export const CandleAggregator = CandleAggregationService;
export const realtimeCandleAggregator = candleAggregationService;