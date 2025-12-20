/**
 * @file ChartAnimationService.ts
 * @description Handles chart animation and positioning logic
 */

import type { IChartApi } from 'lightweight-charts';
import type { CandlestickDataWithVolume } from '../stores/services/DataTransformations';

/**
 * Manages chart animation and positioning for different timeframes
 */
export class ChartAnimationService {
  /**
   * Animate chart to show the latest data with proper padding
   * Extracts time conversion and validation logic from component
   * @param chart Chart API instance
   * @param candles Array of candles to display
   */
  static animateToLatestData(chart: IChartApi, candles: CandlestickDataWithVolume[]): void {
    try {
      if (!chart || candles.length === 0) return;

      // Get the newest candle time
      let newestTime = candles[candles.length - 1].time;

      // Normalize time if it's an object or string
      newestTime = this.normalizeTime(newestTime);
      if (!newestTime || newestTime <= 0) return;

      // Get visible candles
      const visibleCandles = this.calculateVisibleCandles(candles, 60);
      if (visibleCandles.length <= 1) return;

      // Get first visible time
      let firstVisibleTime = visibleCandles[0].time;
      firstVisibleTime = this.normalizeTime(firstVisibleTime);
      if (!firstVisibleTime || firstVisibleTime <= 0) return;

      // Calculate time span
      const timeSpan = newestTime - firstVisibleTime;
      if (timeSpan <= 0) return;

      // Calculate padding (1% left, 2% right)
      const leftBuffer = timeSpan * 0.01;
      const rightBuffer = timeSpan * 0.02;

      // Validate range before setting
      const fromTime = Math.floor(firstVisibleTime - leftBuffer);
      const toTime = Math.ceil(newestTime + rightBuffer);

      // Only set range if values are valid
      if (this.isValidTimeRange(fromTime, toTime)) {
        chart.timeScale().setVisibleRange({
          from: fromTime as any,
          to: toTime as any
        });
      }
    } catch (error) {
      // Silently handle animation errors - they're expected during chart initialization
    }
  }

  /**
   * Position chart for a specific time period
   * @param chart Chart API instance
   * @param period Time period (e.g., '1H', '1D', '1W')
   * @param candles Array of candles
   */
  static positionChartForPeriod(
    chart: IChartApi,
    period: string,
    candles: CandlestickDataWithVolume[]
  ): void {
    try {
      if (!chart || candles.length === 0) return;

      const maxCandles = this.getMaxCandlesForPeriod(period);
      const visibleCandles = this.calculateVisibleCandles(candles, maxCandles);

      if (visibleCandles.length < 2) return;

      // Get time range from visible candles
      const firstTime = this.normalizeTime(visibleCandles[0].time);
      const lastTime = this.normalizeTime(visibleCandles[visibleCandles.length - 1].time);

      if (!firstTime || !lastTime || firstTime >= lastTime) return;

      // Calculate padding based on time span
      const timeSpan = lastTime - firstTime;
      const leftBuffer = timeSpan * 0.01;
      const rightBuffer = timeSpan * 0.02;

      const fromTime = Math.floor(firstTime - leftBuffer);
      const toTime = Math.ceil(lastTime + rightBuffer);

      if (this.isValidTimeRange(fromTime, toTime)) {
        chart.timeScale().setVisibleRange({
          from: fromTime as any,
          to: toTime as any
        });
      }
    } catch (error) {
      // Silently handle positioning errors
    }
  }

  /**
   * Set visible range explicitly
   * @param chart Chart API instance
   * @param fromTime Start time (seconds)
   * @param toTime End time (seconds)
   */
  static setVisibleRange(chart: IChartApi, fromTime: number, toTime: number): void {
    try {
      if (this.isValidTimeRange(fromTime, toTime)) {
        chart.timeScale().setVisibleRange({
          from: fromTime as any,
          to: toTime as any
        });
      }
    } catch (error) {
      // Silently handle range errors
    }
  }

  /**
   * Show exactly 60 candles
   * @param chart Chart API instance
   * @param candles Array of candles
   */
  static show60Candles(chart: IChartApi, candles: CandlestickDataWithVolume[]): void {
    try {
      const visibleCandles = this.calculateVisibleCandles(candles, 60);
      if (visibleCandles.length < 2) return;

      const firstTime = this.normalizeTime(visibleCandles[0].time);
      const lastTime = this.normalizeTime(visibleCandles[visibleCandles.length - 1].time);

      if (!firstTime || !lastTime || firstTime >= lastTime) return;

      const timeSpan = lastTime - firstTime;
      const buffer = timeSpan * 0.01;

      this.setVisibleRange(
        chart,
        Math.floor(firstTime - buffer),
        Math.ceil(lastTime + buffer)
      );
    } catch (error) {
      // Silently handle show60 errors
    }
  }

  /**
   * Normalize time value to seconds (handles number, string, object)
   * @param time Time value in various formats
   * @returns Normalized time in seconds or null if invalid
   */
  static normalizeTime(time: any): number | null {
    if (typeof time === 'number') {
      return isFinite(time) && time > 0 ? time : null;
    }

    if (typeof time === 'string') {
      const parsed = parseInt(time, 10);
      return isFinite(parsed) && parsed > 0 ? parsed : null;
    }

    // Handle objects (shouldn't happen but be defensive)
    if (typeof time === 'object' && time !== null) {
      if ('getTime' in time) {
        // Date object - convert to seconds
        const ms = (time as Date).getTime();
        return isFinite(ms) && ms > 0 ? Math.floor(ms / 1000) : null;
      }
    }

    return null;
  }

  /**
   * Calculate visible candles slice
   * Returns the last N candles from the array
   * @param candles Array of candles
   * @param maxCount Maximum number of candles to return
   * @returns Sliced candles array
   */
  static calculateVisibleCandles(
    candles: CandlestickDataWithVolume[],
    maxCount: number
  ): CandlestickDataWithVolume[] {
    if (!candles || candles.length === 0) return [];
    if (candles.length <= maxCount) return candles;
    return candles.slice(candles.length - maxCount);
  }

  /**
   * Get maximum candles for a given period
   * @param period Time period string
   * @returns Maximum number of candles to display
   */
  static getMaxCandlesForPeriod(period: string): number {
    const periodMap: Record<string, number> = {
      '1m': 120,
      '5m': 100,
      '15m': 96,
      '1H': 72,
      '4H': 60,
      '1D': 365,
      '1W': 52,
      '1M': 12
    };

    return periodMap[period] || 60; // Default to 60 candles
  }

  /**
   * Validate time range values
   * @param fromTime Start time
   * @param toTime End time
   * @returns True if range is valid
   */
  static isValidTimeRange(fromTime: number, toTime: number): boolean {
    return (
      Number.isFinite(fromTime) &&
      Number.isFinite(toTime) &&
      fromTime > 0 &&
      toTime > fromTime &&
      toTime - fromTime > 0
    );
  }
}
