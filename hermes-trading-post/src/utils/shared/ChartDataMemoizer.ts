/**
 * @file ChartDataMemoizer.ts
 * @description Memoized chart data formatting to reduce conversion overhead
 * Caches formatted candles by time to avoid re-conversion on repeated calls
 */

export interface FormattedCandle {
  time: any;
  open: number;
  high: number;
  low: number;
  close: number;
}

export class ChartDataMemoizer {
  private cache: Map<number, FormattedCandle> = new Map();
  private maxCacheSize = 500; // Keep last 500 formatted candles

  /**
   * Format a single candle with caching
   */
  formatCandle(candle: any): FormattedCandle {
    const time = typeof candle.time === 'number' ? candle.time : Number(candle.time);

    // Check cache first
    if (this.cache.has(time)) {
      return this.cache.get(time)!;
    }

    // Format and cache
    const formatted: FormattedCandle = {
      time,
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
    };

    // Maintain cache size
    if (this.cache.size >= this.maxCacheSize) {
      // Remove oldest entry
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(time, formatted);
    return formatted;
  }

  /**
   * Format multiple candles efficiently
   * Reuses cached formatting for known times
   */
  formatCandles(candles: any[]): FormattedCandle[] {
    return candles.map(candle => this.formatCandle(candle));
  }

  /**
   * Get cache statistics for debugging
   */
  getStats(): { size: number; maxSize: number } {
    return {
      size: this.cache.size,
      maxSize: this.maxCacheSize,
    };
  }

  /**
   * Clear cache when switching charts/symbols
   */
  clear(): void {
    this.cache.clear();
  }
}

export const chartDataMemoizer = new ChartDataMemoizer();
