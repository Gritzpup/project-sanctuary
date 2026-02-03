import { EventEmitter } from 'events';

/**
 * Multi-Granularity Candle Aggregator
 *
 * Aggregates incoming trades into candles for ALL granularities simultaneously.
 * This ensures all timeframes (1m, 5m, 15m, 1h, 6h, 1d) are always up-to-date.
 */
export class MultiGranularityAggregator extends EventEmitter {
  constructor(productId) {
    super();
    this.productId = productId;

    // Define all granularities we want to track (in seconds)
    this.granularities = {
      '1m': 60,
      '5m': 300,
      '15m': 900,
      '1h': 3600,
      '6h': 21600,
      '1d': 86400
    };

    // Current candles for each granularity
    this.currentCandles = {};
    this.lastEmittedTimes = {};

    // Initialize current candles
    Object.keys(this.granularities).forEach(gran => {
      this.currentCandles[gran] = null;
      this.lastEmittedTimes[gran] = null;
    });

  }

  /**
   * Add a trade and update ALL granularity candles
   */
  addTrade(trade) {
    const results = [];

    // Update each granularity
    Object.entries(this.granularities).forEach(([granKey, granSeconds]) => {
      const candle = this.updateGranularity(granKey, granSeconds, trade);
      if (candle) {
        results.push({
          granularity: granKey,
          granularitySeconds: granSeconds,
          ...candle
        });
      }
    });

    return results;
  }

  /**
   * Update a specific granularity with a trade
   */
  updateGranularity(granKey, granSeconds, trade) {
    const candleTime = this.getCandleTime(trade.time, granSeconds);
    const currentCandle = this.currentCandles[granKey];

    // Check if we need to start a new candle
    if (!currentCandle || currentCandle.time !== candleTime) {
      // Complete the previous candle
      const completedCandle = currentCandle && currentCandle.time < candleTime ? {...currentCandle} : null;

      // Check for gaps
      if (completedCandle) {
        const expectedNextCandleTime = completedCandle.time + granSeconds;
        const gapSize = candleTime - expectedNextCandleTime;

        if (gapSize > 0) {
          const missedCandles = Math.floor(gapSize / granSeconds);

          this.emit('gap_detected', {
            productId: this.productId,
            granularity: granKey,
            granularitySeconds: granSeconds,
            lastCandleTime: completedCandle.time,
            newCandleTime: candleTime,
            missedCandles,
            gapSeconds: gapSize
          });
        }
      }

      // Start new candle
      this.currentCandles[granKey] = {
        time: candleTime,
        open: trade.price,
        high: trade.price,
        low: trade.price,
        close: trade.price,
        volume: trade.size
      };

      // Return completed candle if we have one
      if (completedCandle && completedCandle.time !== this.lastEmittedTimes[granKey]) {
        this.lastEmittedTimes[granKey] = completedCandle.time;
        return {
          ...completedCandle,
          type: 'complete'
        };
      }
    } else {
      // Update existing candle
      currentCandle.high = Math.max(currentCandle.high, trade.price);
      currentCandle.low = Math.min(currentCandle.low, trade.price);
      currentCandle.close = trade.price;
      currentCandle.volume += trade.size;
    }

    // Return current candle as update
    return {
      ...this.currentCandles[granKey],
      type: 'update'
    };
  }

  /**
   * Calculate candle time based on granularity
   */
  getCandleTime(tradeTime, granularitySeconds) {
    return Math.floor(tradeTime / granularitySeconds) * granularitySeconds;
  }

  /**
   * Get current candle for a specific granularity
   */
  getCurrentCandle(granKey) {
    return this.currentCandles[granKey];
  }

  /**
   * Get all current candles
   */
  getAllCurrentCandles() {
    return { ...this.currentCandles };
  }

  /**
   * 🔥 MEMORY LEAK FIX: Clean up aggregator and remove all listeners
   */
  destroy() {
    this.currentCandles = {};
    this.lastEmittedTimes = {};
    this.removeAllListeners();
  }
}
