/**
 * @file candleAggregator.ts
 * @description Aggregates price ticks into candle data
 */

import type { CandleData } from '../../types/coinbase';

/**
 * Aggregates 1-minute candles into larger timeframes
 * This provides a single source of truth for all chart data
 */
export class CandleAggregator {
  // Map granularity to minutes
  private static readonly granularityMinutes: Record<string, number> = {
    '1m': 1,
    '5m': 5,
    '15m': 15,
    '1h': 60,
    '6h': 360,
    '1d': 1440
  };

  /**
   * Aggregate 1-minute candles into the requested granularity
   */
  static aggregate(oneMinCandles: CandleData[], targetGranularity: string): CandleData[] {
    const minutes = this.granularityMinutes[targetGranularity];
    if (!minutes || minutes === 1) {
      return oneMinCandles; // Return as-is for 1m
    }

    // Sort candles by time
    const sorted = [...oneMinCandles].sort((a, b) => a.time - b.time);
    if (sorted.length === 0) return [];

    const aggregated: CandleData[] = [];
    let currentBucket: CandleData | null = null;
    let bucketCandles: CandleData[] = [];

    for (const candle of sorted) {
      // Calculate bucket time (aligned to granularity boundaries)
      const bucketTime = Math.floor(candle.time / (minutes * 60)) * (minutes * 60);

      // Start new bucket if needed
      if (!currentBucket || currentBucket.time !== bucketTime) {
        // Finalize previous bucket
        if (currentBucket && bucketCandles.length > 0) {
          aggregated.push(this.finalizeCandle(currentBucket, bucketCandles));
        }

        // Start new bucket
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

      // Add to current bucket
      bucketCandles.push(candle);
      currentBucket.high = Math.max(currentBucket.high, candle.high);
      currentBucket.low = Math.min(currentBucket.low, candle.low);
      currentBucket.close = candle.close;
      currentBucket.volume += candle.volume;
    }

    // Finalize last bucket
    if (currentBucket && bucketCandles.length > 0) {
      aggregated.push(this.finalizeCandle(currentBucket, bucketCandles));
    }

    return aggregated;
  }

  /**
   * Get the time range needed in 1m candles to display a given range at a granularity
   */
  static getRequiredOneMinuteRange(
    startTime: number, 
    endTime: number, 
    granularity: string
  ): { start: number; end: number } {
    const minutes = this.granularityMinutes[granularity] || 1;
    
    // Align to granularity boundaries
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
    
    // Create a map of existing minutes
    const existingMinutes = new Set(oneMinCandles.map(c => c.time));
    
    // Find missing minutes
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

  private static finalizeCandle(candle: CandleData, bucketCandles: CandleData[]): CandleData {
    // Ensure open is from first candle and close is from last
    if (bucketCandles.length > 0) {
      candle.open = bucketCandles[0].open;
      candle.close = bucketCandles[bucketCandles.length - 1].close;
    }
    return candle;
  }
}