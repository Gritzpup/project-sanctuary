/**
 * ChunkManager - Manages data chunking for efficient storage
 * Extracted from indexedDBCache.ts
 */

import type { CandleData } from '../../types/coinbase';

export interface DataChunk {
  chunkId: string;
  symbol: string;
  granularity: string;
  startTime: number;
  endTime: number;
  candles: CandleData[];
  lastUpdated: number;
  isComplete: boolean;
}

export class ChunkManager {
  // Cache limits to prevent excessive storage
  private readonly MAX_CANDLES_PER_GRANULARITY: { [key: string]: number } = {
    '1m': 2628000,  // 5 years of 1-minute candles (5 * 365 * 24 * 60)
    '5m': 525600,   // 5 years of 5-minute candles (5 * 365 * 24 * 12)
    '15m': 175200,  // 5 years of 15-minute candles (5 * 365 * 24 * 4)
    '1h': 43800,    // 5 years of hourly candles (5 * 365 * 24)
    '6h': 7300,     // 5 years of 6-hour candles (5 * 365 * 4)
    '1d': 1825,     // 5 years of daily candles (5 * 365)
    '1D': 1825      // 5 years of daily candles (5 * 365)
  };

  /**
   * Generate unique chunk ID
   */
  getChunkId(symbol: string, granularity: string, startTime: number, endTime: number): string {
    return `${symbol}_${granularity}_${startTime}_${endTime}`;
  }

  /**
   * Get granularity in seconds
   */
  getGranularitySeconds(granularity: string): number {
    const granularityMap: { [key: string]: number } = {
      '1m': 60,
      '5m': 300,
      '15m': 900,
      '1h': 3600,
      '6h': 21600,
      '1d': 86400,
      '1D': 86400
    };
    return granularityMap[granularity] || 60;
  }

  /**
   * Get maximum candles per chunk for a granularity
   */
  getMaxCandlesPerChunk(granularity: string): number {
    return this.MAX_CANDLES_PER_GRANULARITY[granularity] || 1440;
  }

  /**
   * Split candles into optimal chunks
   */
  splitIntoChunks(
    symbol: string,
    granularity: string,
    candles: CandleData[]
  ): DataChunk[] {
    if (candles.length === 0) return [];

    const chunks: DataChunk[] = [];
    const maxPerChunk = Math.min(500, this.getMaxCandlesPerChunk(granularity));
    const sortedCandles = [...candles].sort((a, b) => a.time - b.time);

    for (let i = 0; i < sortedCandles.length; i += maxPerChunk) {
      const chunkCandles = sortedCandles.slice(i, i + maxPerChunk);
      const startTime = chunkCandles[0].time * 1000;
      const endTime = chunkCandles[chunkCandles.length - 1].time * 1000;

      chunks.push({
        chunkId: this.getChunkId(symbol, granularity, startTime, endTime),
        symbol,
        granularity,
        startTime,
        endTime,
        candles: chunkCandles,
        lastUpdated: Date.now(),
        isComplete: true
      });
    }

    return chunks;
  }

  /**
   * Merge overlapping chunks
   */
  mergeChunks(chunks: DataChunk[]): DataChunk[] {
    if (chunks.length <= 1) return chunks;

    // Sort by start time
    const sorted = [...chunks].sort((a, b) => a.startTime - b.startTime);
    const merged: DataChunk[] = [];
    let current = sorted[0];

    for (let i = 1; i < sorted.length; i++) {
      const next = sorted[i];
      
      // Check if chunks overlap or are adjacent
      if (current.endTime >= next.startTime - 1000) {
        // Merge chunks
        const allCandles = [...current.candles, ...next.candles];
        const uniqueCandles = this.deduplicateCandles(allCandles);
        
        current = {
          ...current,
          endTime: Math.max(current.endTime, next.endTime),
          candles: uniqueCandles,
          lastUpdated: Date.now()
        };
      } else {
        // No overlap, save current and move to next
        merged.push(current);
        current = next;
      }
    }
    
    merged.push(current);
    return merged;
  }

  /**
   * Remove duplicate candles
   */
  private deduplicateCandles(candles: CandleData[]): CandleData[] {
    const seen = new Map<number, CandleData>();
    
    for (const candle of candles) {
      if (!seen.has(candle.time)) {
        seen.set(candle.time, candle);
      }
    }
    
    return Array.from(seen.values()).sort((a, b) => a.time - b.time);
  }

  /**
   * Find gaps in time range
   */
  findGaps(
    chunks: DataChunk[],
    requestedStart: number,
    requestedEnd: number,
    granularitySeconds: number
  ): Array<{ start: number; end: number }> {
    if (chunks.length === 0) {
      return [{ start: requestedStart, end: requestedEnd }];
    }

    const gaps: Array<{ start: number; end: number }> = [];
    const sorted = [...chunks].sort((a, b) => a.startTime - b.startTime);

    // Check for gap at the beginning
    if (sorted[0].startTime > requestedStart) {
      gaps.push({ start: requestedStart, end: sorted[0].startTime });
    }

    // Check for gaps between chunks
    for (let i = 0; i < sorted.length - 1; i++) {
      const current = sorted[i];
      const next = sorted[i + 1];
      
      // Allow for small gaps (up to 2 candle periods)
      const gapThreshold = granularitySeconds * 1000 * 2;
      
      if (next.startTime - current.endTime > gapThreshold) {
        gaps.push({ start: current.endTime, end: next.startTime });
      }
    }

    // Check for gap at the end
    const lastChunk = sorted[sorted.length - 1];
    if (lastChunk.endTime < requestedEnd) {
      gaps.push({ start: lastChunk.endTime, end: requestedEnd });
    }

    return gaps;
  }

  /**
   * Validate chunk integrity
   */
  validateChunk(chunk: DataChunk): boolean {
    if (!chunk.candles || chunk.candles.length === 0) {
      return false;
    }

    // Check if candles are within chunk time range
    for (const candle of chunk.candles) {
      const candleTime = candle.time * 1000;
      if (candleTime < chunk.startTime || candleTime > chunk.endTime) {
        return false;
      }
    }

    return true;
  }

  /**
   * Calculate chunk size in bytes (estimate)
   */
  estimateChunkSize(chunk: DataChunk): number {
    // Rough estimate: 100 bytes per candle
    return chunk.candles.length * 100;
  }
}