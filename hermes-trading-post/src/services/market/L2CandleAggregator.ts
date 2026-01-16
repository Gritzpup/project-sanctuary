/**
 * ✅ L2 CONSOLIDATION - Week 2
 * Single canonical L2-based candle aggregator
 *
 * Replaces 3 duplicate implementations:
 * - /src/services/chart/aggregation/CandleAggregator.ts (frontend)
 * - /backend/src/services/redis/CandleAggregator.ts (backend)
 * - /src/services/data/candleAggregator.ts (legacy)
 *
 * Key improvements:
 * - Built on real-time L2 mid-price (10-30 Hz)
 * - Includes spread data in every candle
 * - Real-time candles (<100ms vs 1000ms)
 * - Single source of truth
 *
 * Data flow:
 * L2 mid-price updates → Real-time candle building → Redis → UI
 */

import { l2PriceProvider } from './L2PriceProvider';

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
  spread?: number;  // NEW: bid-ask spread at close
}

export interface CandleMetrics {
  candlesGenerated: number;
  lastUpdateTime: number;
  upCandles: number;
  downCandles: number;
}

export class L2CandleAggregator {
  private granularitySeconds: number;
  private currentCandle: Candle | null = null;
  private currentCandleStartTime: number = 0;
  private subscribers: Set<(candle: Candle) => void> = new Set();
  private metrics: CandleMetrics = {
    candlesGenerated: 0,
    lastUpdateTime: 0,
    upCandles: 0,
    downCandles: 0,
  };

  // ✅ PHASE 8 FIX: Destroyed flag for lifecycle safety
  // Prevents callbacks from executing after aggregator is destroyed
  private destroyed = false;

  constructor(granularitySeconds: number) {
    this.granularitySeconds = granularitySeconds;
    this.initializeCandle();
    this.setupPriceListener();
  }

  /**
   * Initialize current candle
   */
  private initializeCandle() {
    const now = Date.now();
    this.currentCandleStartTime = this.getCandleStartTime(now);
    const midPrice = l2PriceProvider.getMidPrice();

    this.currentCandle = {
      time: this.currentCandleStartTime,
      open: midPrice,
      high: midPrice,
      low: midPrice,
      close: midPrice,
      volume: 0,
      spread: l2PriceProvider.getSpread().percent,
    };
  }

  /**
   * Get start time of candle for given timestamp
   */
  private getCandleStartTime(timestamp: number): number {
    const seconds = Math.floor(timestamp / 1000);
    return Math.floor(seconds / this.granularitySeconds) * this.granularitySeconds * 1000;
  }

  /**
   * Setup listener on price provider
   */
  private setupPriceListener() {
    l2PriceProvider.subscribeToPrice((priceUpdate) => {
      this.updateCandle(priceUpdate.midPrice, priceUpdate.spread.percent);
    });
  }

  /**
   * Update current candle with new price
   */
  private updateCandle(midPrice: number, spread: number) {
    // ✅ PHASE 8 FIX: Check destroyed flag before processing
    if (this.destroyed) return;

    if (!this.currentCandle) {
      this.initializeCandle();
      return;
    }

    const now = Date.now();
    const candleStartTime = this.getCandleStartTime(now);

    // Check if we've moved to a new candle
    if (candleStartTime > this.currentCandleStartTime) {
      // Emit completed candle
      this.notifySubscribers(this.currentCandle);
      this.metrics.candlesGenerated++;
      this.metrics.lastUpdateTime = now;

      // Initialize new candle
      this.currentCandleStartTime = candleStartTime;
      this.currentCandle = {
        time: candleStartTime,
        open: midPrice,
        high: midPrice,
        low: midPrice,
        close: midPrice,
        volume: 0,
        spread: spread,
      };
    } else {
      // Update current candle - ONLY update close and spread
      // DON'T expand high/low from L2 mid-price - that's the backend's job via trade aggregation
      // L2 mid-price fluctuates with orderbook spread, not actual trades, causing artificially tall candles
      this.currentCandle.close = midPrice;
      this.currentCandle.spread = spread;
    }

    // Track metrics
    if (this.currentCandle.close > this.currentCandle.open) {
      this.metrics.upCandles++;
    } else if (this.currentCandle.close < this.currentCandle.open) {
      this.metrics.downCandles++;
    }
  }

  /**
   * Get current candle
   */
  getCurrentCandle(): Candle | null {
    return this.currentCandle ? { ...this.currentCandle } : null;
  }

  /**
   * Subscribe to completed candles
   */
  subscribeToCandles(callback: (candle: Candle) => void): () => void {
    this.subscribers.add(callback);

    // Return unsubscribe function
    return () => {
      this.subscribers.delete(callback);
    };
  }

  /**
   * Notify all subscribers
   */
  private notifySubscribers(candle: Candle) {
    this.subscribers.forEach((callback) => {
      try {
        callback(candle);
      } catch (error) {
      }
    });
  }

  /**
   * Get aggregator metrics
   */
  getMetrics(): CandleMetrics {
    return { ...this.metrics };
  }

  /**
   * Cleanup
   */
  destroy() {
    // ✅ PHASE 8 FIX: Set destroyed flag to prevent callbacks
    this.destroyed = true;

    this.subscribers.clear();
  }
}

/**
 * Factory to create aggregators for multiple granularities
 */
export class L2CandleAggregatorFactory {
  private aggregators: Map<number, L2CandleAggregator> = new Map();

  /**
   * Get or create aggregator for granularity
   */
  getAggregator(granularitySeconds: number): L2CandleAggregator {
    if (!this.aggregators.has(granularitySeconds)) {
      this.aggregators.set(granularitySeconds, new L2CandleAggregator(granularitySeconds));
    }
    return this.aggregators.get(granularitySeconds)!;
  }

  /**
   * Get aggregators for multiple granularities
   */
  getAggregators(granularitiesSeconds: number[]): Map<number, L2CandleAggregator> {
    const result = new Map<number, L2CandleAggregator>();
    for (const granularitySeconds of granularitiesSeconds) {
      result.set(granularitySeconds, this.getAggregator(granularitySeconds));
    }
    return result;
  }

  /**
   * Cleanup all aggregators
   */
  destroyAll() {
    for (const aggregator of this.aggregators.values()) {
      aggregator.destroy();
    }
    this.aggregators.clear();
  }
}

// Export singleton factory
export const l2CandleFactory = new L2CandleAggregatorFactory();
