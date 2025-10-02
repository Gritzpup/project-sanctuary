/**
 * @file cacheStrategies.ts
 * @description Cache management strategies and cleanup logic
 */

import type { CandleData } from '../../../types/coinbase';
import type { DataChunk, DataMetadata, CacheConfig } from './schema';
import { IndexedDBOperations } from './operations';

export class CacheStrategies {
  constructor(
    private operations: IndexedDBOperations,
    private config: CacheConfig
  ) {}

  /**
   * Create a chunk ID for data organization
   */
  createChunkId(symbol: string, granularity: string, startTime: number): string {
    return `${symbol}_${granularity}_${Math.floor(startTime / 86400)}`;
  }

  /**
   * Organize candles into chunks
   */
  organizeIntoChunks(
    symbol: string,
    granularity: string,
    candles: CandleData[],
    chunkSize: number = this.config.CHUNK_SIZE
  ): DataChunk[] {
    const chunks: DataChunk[] = [];
    const sortedCandles = [...candles].sort((a, b) => a.time - b.time);

    for (let i = 0; i < sortedCandles.length; i += chunkSize) {
      const chunkCandles = sortedCandles.slice(i, i + chunkSize);
      const startTime = chunkCandles[0].time;
      const endTime = chunkCandles[chunkCandles.length - 1].time;

      chunks.push({
        chunkId: this.createChunkId(symbol, granularity, startTime),
        symbol,
        granularity,
        startTime,
        endTime,
        candles: chunkCandles,
        lastUpdated: Date.now(),
        isComplete: chunkCandles.length === chunkSize
      });
    }

    return chunks;
  }

  /**
   * Merge chunks back into continuous candle data
   */
  mergeChunks(chunks: DataChunk[]): CandleData[] {
    const allCandles: CandleData[] = [];
    
    chunks
      .sort((a, b) => a.startTime - b.startTime)
      .forEach(chunk => {
        allCandles.push(...chunk.candles);
      });

    // Remove duplicates based on timestamp
    const uniqueCandles = new Map<number, CandleData>();
    allCandles.forEach(candle => {
      uniqueCandles.set(candle.time, candle);
    });

    return Array.from(uniqueCandles.values()).sort((a, b) => a.time - b.time);
  }

  /**
   * Apply cache limits for a specific granularity
   */
  async applyCacheLimits(symbol: string, granularity: string): Promise<void> {
    const maxCandles = this.config.MAX_CANDLES_PER_GRANULARITY[granularity];
    if (!maxCandles) return;

    const chunks = await this.operations.getChunksBySymbolAndGranularity(symbol, granularity);
    const allCandles = this.mergeChunks(chunks);

    if (allCandles.length <= maxCandles) return;

    // Keep the most recent candles
    const candlesToKeep = allCandles.slice(-maxCandles);
    const newChunks = this.organizeIntoChunks(symbol, granularity, candlesToKeep);

    // Delete old chunks
    for (const chunk of chunks) {
      await this.operations.deleteChunk(chunk.chunkId);
    }

    // Store new chunks
    for (const chunk of newChunks) {
      await this.operations.putChunk(chunk);
    }
  }

  /**
   * Clean up expired data based on TTL
   */
  async cleanupExpiredData(): Promise<void> {
    const now = Date.now();
    const allChunks = await this.operations.getAllChunks();

    for (const chunk of allChunks) {
      const age = now - chunk.lastUpdated;
      const ttl = this.isRecentData(chunk) ? this.config.TTL_RECENT : this.config.TTL_OLD;

      if (age > ttl) {
        await this.operations.deleteChunk(chunk.chunkId);
      }
    }
  }

  /**
   * Determine if data is considered recent
   */
  private isRecentData(chunk: DataChunk): boolean {
    const now = Date.now() / 1000;
    const dataAge = now - chunk.endTime;
    
    // Consider data recent if it's less than 24 hours old
    return dataAge < 86400;
  }

  /**
   * Update metadata for a symbol
   */
  async updateMetadata(symbol: string, granularity: string, candles: CandleData[]): Promise<void> {
    if (candles.length === 0) return;

    const existing = await this.operations.getMetadata(symbol) || {
      symbol,
      earliestData: Infinity,
      latestData: 0,
      totalCandles: 0,
      lastSync: Date.now(),
      granularityRanges: {}
    };

    const sortedCandles = [...candles].sort((a, b) => a.time - b.time);
    const startTime = sortedCandles[0].time;
    const endTime = sortedCandles[sortedCandles.length - 1].time;

    // Update global ranges
    existing.earliestData = Math.min(existing.earliestData, startTime);
    existing.latestData = Math.max(existing.latestData, endTime);
    existing.lastSync = Date.now();

    // Update granularity-specific ranges
    if (!existing.granularityRanges[granularity]) {
      existing.granularityRanges[granularity] = {
        startTime,
        endTime,
        candleCount: candles.length
      };
    } else {
      const range = existing.granularityRanges[granularity];
      range.startTime = Math.min(range.startTime, startTime);
      range.endTime = Math.max(range.endTime, endTime);
      range.candleCount = Math.max(range.candleCount, candles.length);
    }

    await this.operations.putMetadata(existing);
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<{
    totalChunks: number;
    totalSize: number;
    symbols: string[];
    granularities: string[];
    oldestData: number;
    newestData: number;
  }> {
    const chunks = await this.operations.getAllChunks();
    const symbols = new Set<string>();
    const granularities = new Set<string>();
    let totalSize = 0;
    let oldestData = Infinity;
    let newestData = 0;

    chunks.forEach(chunk => {
      symbols.add(chunk.symbol);
      granularities.add(chunk.granularity);
      totalSize += chunk.candles.length;
      oldestData = Math.min(oldestData, chunk.startTime);
      newestData = Math.max(newestData, chunk.endTime);
    });

    return {
      totalChunks: chunks.length,
      totalSize,
      symbols: Array.from(symbols),
      granularities: Array.from(granularities),
      oldestData: oldestData === Infinity ? 0 : oldestData,
      newestData
    };
  }
}