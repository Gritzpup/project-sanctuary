/**
 * @file indexedDBService.ts
 * @description Main IndexedDB service combining all modules
 */

import type { CandleData } from '../../../types/coinbase';
import { DEFAULT_CONFIG, type CacheConfig } from './schema';
import { IndexedDBOperations } from './operations';
import { CacheStrategies } from './cacheStrategies';

export class IndexedDBService {
  private operations: IndexedDBOperations;
  private strategies: CacheStrategies;
  private config: CacheConfig;

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.operations = new IndexedDBOperations();
    this.strategies = new CacheStrategies(this.operations, this.config);
  }

  /**
   * Store candles in the cache
   */
  async storeCandles(symbol: string, granularity: string, candles: CandleData[]): Promise<void> {
    if (!candles || candles.length === 0) return;

    try {
      // Organize data into chunks
      const chunks = this.strategies.organizeIntoChunks(symbol, granularity, candles);

      // Store chunks
      for (const chunk of chunks) {
        await this.operations.putChunk(chunk);
      }

      // Update metadata
      await this.strategies.updateMetadata(symbol, granularity, candles);

      // Apply cache limits
      await this.strategies.applyCacheLimits(symbol, granularity);

    } catch (error) {
      console.error('Error storing candles:', error);
      throw error;
    }
  }

  /**
   * Retrieve candles from cache
   */
  async getCandles(
    symbol: string,
    granularity: string,
    startTime?: number,
    endTime?: number
  ): Promise<CandleData[]> {
    try {
      const chunks = await this.operations.getChunksBySymbolAndGranularity(symbol, granularity);
      let candles = this.strategies.mergeChunks(chunks);

      // Filter by time range if specified
      if (startTime !== undefined) {
        candles = candles.filter(candle => candle.time >= startTime);
      }
      if (endTime !== undefined) {
        candles = candles.filter(candle => candle.time <= endTime);
      }

      return candles;

    } catch (error) {
      console.error('Error retrieving candles:', error);
      return [];
    }
  }

  /**
   * Check if data exists for the given parameters
   */
  async hasData(symbol: string, granularity: string, startTime?: number, endTime?: number): Promise<boolean> {
    try {
      const metadata = await this.operations.getMetadata(symbol);
      if (!metadata) return false;

      const range = metadata.granularityRanges[granularity];
      if (!range) return false;

      // Check if requested time range is covered
      if (startTime !== undefined && range.startTime > startTime) return false;
      if (endTime !== undefined && range.endTime < endTime) return false;

      return true;

    } catch (error) {
      console.error('Error checking data existence:', error);
      return false;
    }
  }

  /**
   * Get available data range for symbol and granularity
   */
  async getDataRange(symbol: string, granularity: string): Promise<{ start: number; end: number } | null> {
    try {
      const metadata = await this.operations.getMetadata(symbol);
      if (!metadata) return null;

      const range = metadata.granularityRanges[granularity];
      if (!range) return null;

      return {
        start: range.startTime,
        end: range.endTime
      };

    } catch (error) {
      console.error('Error getting data range:', error);
      return null;
    }
  }

  /**
   * Clear all cached data
   */
  async clearAll(): Promise<void> {
    try {
      await this.operations.clearAll();
    } catch (error) {
      console.error('Error clearing cache:', error);
      throw error;
    }
  }

  /**
   * Clear data for specific symbol and granularity
   */
  async clearSymbolData(symbol: string, granularity?: string): Promise<void> {
    try {
      const chunks = await this.operations.getChunksBySymbolAndGranularity(symbol, granularity || '');
      
      for (const chunk of chunks) {
        if (!granularity || chunk.granularity === granularity) {
          await this.operations.deleteChunk(chunk.chunkId);
        }
      }

      // Update metadata if clearing all granularities
      if (!granularity) {
        const metadata = await this.operations.getMetadata(symbol);
        if (metadata) {
          metadata.granularityRanges = {};
          metadata.totalCandles = 0;
          metadata.lastSync = Date.now();
          await this.operations.putMetadata(metadata);
        }
      }

    } catch (error) {
      console.error('Error clearing symbol data:', error);
      throw error;
    }
  }

  /**
   * Perform cleanup of expired data
   */
  async cleanup(): Promise<void> {
    try {
      await this.strategies.cleanupExpiredData();
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    totalChunks: number;
    totalSize: number;
    symbols: string[];
    granularities: string[];
    oldestData: number;
    newestData: number;
  }> {
    try {
      return await this.strategies.getCacheStats();
    } catch (error) {
      console.error('Error getting cache stats:', error);
      return {
        totalChunks: 0,
        totalSize: 0,
        symbols: [],
        granularities: [],
        oldestData: 0,
        newestData: 0
      };
    }
  }

  /**
   * Close the database connection
   */
  async close(): Promise<void> {
    await this.operations.close();
  }
}

// Export singleton instance
export const indexedDBService = new IndexedDBService();