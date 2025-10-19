/**
 * @file DataTransformations.ts
 * @description Data transformation utilities for chart data
 * Handles candle transformations, normalization, and volume calculations
 */

import type { WebSocketCandle } from '../../types/data.types';

/**
 * Candle data with volume
 */
export interface CandlestickDataWithVolume {
  time: number | string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

/**
 * Transforms raw candle data from WebSocket to chart format
 */
export class DataTransformations {
  /**
   * Timestamp validation range (Jan 2020 - Jan 2030)
   */
  private readonly VALID_TIME_START = 1577836800;
  private readonly VALID_TIME_END = 1893456000;

  /**
   * Transform WebSocket candles to chart format
   * @param candles Raw candle data from API/WebSocket
   * @returns Transformed candles ready for chart
   */
  transformCandles(candles: any[]): CandlestickDataWithVolume[] {
    return candles
      .map(c => this.transformCandle(c))
      .filter((c): c is CandlestickDataWithVolume => c !== null)
      .sort((a, b) => {
        const aTime = typeof a.time === 'string' ? parseInt(a.time) : a.time;
        const bTime = typeof b.time === 'string' ? parseInt(b.time) : b.time;
        return aTime - bTime;
      });
  }

  /**
   * Transform a single candle
   * @param candle Raw candle data
   * @returns Transformed candle or null if invalid
   */
  private transformCandle(candle: any): CandlestickDataWithVolume | null {
    try {
      const normalized = this.normalizeCandle(candle);
      if (!normalized) return null;

      return {
        time: normalized.time,
        open: this.normalizePrice(candle.open),
        high: this.normalizePrice(candle.high),
        low: this.normalizePrice(candle.low),
        close: this.normalizePrice(candle.close),
        volume: this.normalizeVolume(candle.volume)
      };
    } catch {
      return null;
    }
  }

  /**
   * Normalize and validate a candle's timestamp
   * @param candle Raw candle data
   * @returns Normalized candle or null if timestamp is invalid
   */
  private normalizeCandle(candle: any): { time: number } | null {
    let normalizedTime = candle.time;

    // Convert to seconds if in milliseconds
    if (normalizedTime > 10000000000) {
      normalizedTime = Math.floor(normalizedTime / 1000);
    }

    // Validate timestamp is within reasonable range
    if (
      normalizedTime < this.VALID_TIME_START ||
      normalizedTime > this.VALID_TIME_END
    ) {
      return null;
    }

    return { time: normalizedTime };
  }

  /**
   * Normalize price value
   * @param price Raw price
   * @returns Normalized price or 0 if invalid
   */
  private normalizePrice(price: any): number {
    const normalized = parseFloat(price);
    return isFinite(normalized) && normalized > 0 ? normalized : 0;
  }

  /**
   * Normalize volume value
   * @param volume Raw volume
   * @returns Normalized volume or 0 if invalid
   */
  private normalizeVolume(volume: any): number {
    if (volume === undefined || volume === null) return 0;
    const normalized = parseFloat(volume);
    return isFinite(normalized) && normalized >= 0 ? normalized : 0;
  }

  /**
   * Merge candle data (for delta sync)
   * @param existing Existing candle array
   * @param incoming Incoming candle data
   * @returns Merged candles with duplicates removed
   */
  mergeCandles(
    existing: CandlestickDataWithVolume[],
    incoming: CandlestickDataWithVolume[]
  ): CandlestickDataWithVolume[] {
    const existingTimes = new Set(
      existing.map(c => (typeof c.time === 'string' ? parseInt(c.time) : c.time))
    );

    // Filter out candles that already exist
    const newCandles = incoming.filter(c => {
      const candleTime =
        typeof c.time === 'string' ? parseInt(c.time) : c.time;
      return !existingTimes.has(candleTime);
    });

    // Merge and sort
    const merged = [...existing, ...newCandles];
    return merged.sort((a, b) => {
      const aTime = typeof a.time === 'string' ? parseInt(a.time) : a.time;
      const bTime = typeof b.time === 'string' ? parseInt(b.time) : b.time;
      return aTime - bTime;
    });
  }

  /**
   * Calculate volume statistics
   * @param candles Candle data
   * @returns Volume stats
   */
  calculateVolumeStats(
    candles: CandlestickDataWithVolume[]
  ): {
    totalVolume: number;
    avgVolume: number;
    maxVolume: number;
    minVolume: number;
  } {
    if (!candles || candles.length === 0) {
      return {
        totalVolume: 0,
        avgVolume: 0,
        maxVolume: 0,
        minVolume: 0
      };
    }

    const volumes = candles
      .map(c => c.volume || 0)
      .filter(v => v >= 0);

    if (volumes.length === 0) {
      return {
        totalVolume: 0,
        avgVolume: 0,
        maxVolume: 0,
        minVolume: 0
      };
    }

    const totalVolume = volumes.reduce((a, b) => a + b, 0);
    const avgVolume = totalVolume / volumes.length;
    const maxVolume = Math.max(...volumes);
    const minVolume = Math.min(...volumes);

    return { totalVolume, avgVolume, maxVolume, minVolume };
  }

  /**
   * Filter candles by time range
   * @param candles Candle data
   * @param startTime Start timestamp (seconds)
   * @param endTime End timestamp (seconds)
   * @returns Filtered candles
   */
  filterByTimeRange(
    candles: CandlestickDataWithVolume[],
    startTime: number,
    endTime: number
  ): CandlestickDataWithVolume[] {
    return candles.filter(c => {
      const time = typeof c.time === 'string' ? parseInt(c.time) : c.time;
      return time >= startTime && time <= endTime;
    });
  }

  /**
   * Get visible candles slice
   * @param candles All candles
   * @param visibleCount Number of visible candles to return
   * @returns Last N candles (most recent)
   */
  getVisibleCandles(
    candles: CandlestickDataWithVolume[],
    visibleCount: number
  ): CandlestickDataWithVolume[] {
    if (candles.length <= visibleCount) {
      return candles;
    }
    return candles.slice(-visibleCount);
  }
}

// Export singleton instance
export const dataTransformations = new DataTransformations();
