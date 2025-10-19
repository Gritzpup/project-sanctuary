/**
 * @file RedisCandleStorage.ts
 * @description Redis candle storage coordinator
 *
 * High-performance candle storage system with 5-year deep storage,
 * seamless granularity switching, and real-time updates.
 *
 * Acts as a facade coordinating specialized services:
 * - CandleStorageWriter: Write and delete operations
 * - CandleDataFetcher: Read and query operations
 * - CandleMetadataManager: Metadata and checkpoint handling
 * - CandleDataSerializer: Data transformation and utilities
 */

import Redis from 'ioredis';
import type { CandlestickData } from 'lightweight-charts';
import {
  REDIS_CONFIG,
  CANDLE_STORAGE_CONFIG
} from './RedisConfig';
import { logger } from '../logging';

// Re-export types for backward compatibility
export type {
  StoredCandle,
  CandleMetadata,
  CandleRange,
  Checkpoint,
  CompactCandleData
} from './types';

import type { StoredCandle, CandleMetadata } from './types';
import { CandleStorageWriter } from './writers/CandleStorageWriter';
import { CandleDataFetcher } from './fetchers/CandleDataFetcher';
import { CandleMetadataManager } from './metadata/CandleMetadataManager';

/**
 * Redis Candle Storage - Coordinator Pattern
 * Manages connection and delegates operations to specialized services
 */
export class RedisCandleStorage {
  private redis: Redis;
  private isConnected: boolean = false;
  private connectionPromise: Promise<void> | null = null;

  // Specialized service instances
  private writer: CandleStorageWriter | null = null;
  private fetcher: CandleDataFetcher | null = null;
  private metadataManager: CandleMetadataManager | null = null;

  constructor() {
    this.redis = new Redis({
      host: REDIS_CONFIG.host,
      port: REDIS_CONFIG.port,
      password: REDIS_CONFIG.password,
      db: REDIS_CONFIG.db,
      retryDelayOnFailover: REDIS_CONFIG.retryDelayOnFailover,
      maxRetriesPerRequest: REDIS_CONFIG.maxRetriesPerRequest,
      lazyConnect: true
    });

    this.setupEventHandlers();
  }

  /**
   * Setup connection event handlers
   */
  private setupEventHandlers(): void {
    this.redis.on('connect', () => {
      logger.info('Connected to Redis on port 6379');
      this.isConnected = true;
    });

    this.redis.on('error', (error) => {
      logger.error('Redis connection error', { error: error.message });
      this.isConnected = false;
    });

    this.redis.on('close', () => {
      logger.warn('Redis connection closed');
      this.isConnected = false;
    });
  }

  /**
   * Connect to Redis and initialize services
   */
  async connect(): Promise<void> {
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    this.connectionPromise = this.redis.connect().then(() => {
      this.isConnected = true;

      // Initialize services after successful connection
      this.metadataManager = new CandleMetadataManager(this.redis);
      this.writer = new CandleStorageWriter(this.redis, this.metadataManager);
      this.fetcher = new CandleDataFetcher(this.redis, this.metadataManager);

      logger.info('Redis candle storage initialized');
    });

    return this.connectionPromise;
  }

  /**
   * Disconnect from Redis
   */
  async disconnect(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
      this.isConnected = false;
    }
    this.writer = null;
    this.fetcher = null;
    this.metadataManager = null;
  }

  /**
   * Store candles for a specific granularity with efficient batching
   * Delegates to CandleStorageWriter service
   */
  async storeCandles(
    pair: string,
    granularity: string,
    candles: StoredCandle[]
  ): Promise<void> {
    if (!this.isConnected) {
      await this.connect();
    }

    if (!this.writer) {
      throw new Error('Storage writer not initialized');
    }

    await this.writer.storeCandles(pair, granularity, candles);
  }

  /**
   * Retrieve candles for a specific range with optimized fetching
   * Delegates to CandleDataFetcher service
   */
  async getCandles(
    pair: string,
    granularity: string,
    startTime: number,
    endTime: number
  ): Promise<StoredCandle[]> {
    if (!this.isConnected) {
      await this.connect();
    }

    if (!this.fetcher) {
      throw new Error('Data fetcher not initialized');
    }

    return this.fetcher.getCandles(pair, granularity, startTime, endTime);
  }

  /**
   * Get latest candles for quick chart initialization
   * Delegates to CandleDataFetcher service
   */
  async getLatestCandles(
    pair: string,
    granularity: string,
    count: number = 1000
  ): Promise<StoredCandle[]> {
    if (!this.isConnected) {
      await this.connect();
    }

    if (!this.fetcher) {
      throw new Error('Data fetcher not initialized');
    }

    return this.fetcher.getLatestCandles(pair, granularity, count);
  }

  /**
   * Get metadata for a pair/granularity combination
   * Delegates to CandleMetadataManager service
   */
  async getMetadata(pair: string, granularity: string): Promise<CandleMetadata | null> {
    if (!this.isConnected) {
      await this.connect();
    }

    if (!this.metadataManager) {
      throw new Error('Metadata manager not initialized');
    }

    return this.metadataManager.getMetadata(pair, granularity);
  }

  /**
   * Clean up old data beyond 5-year retention
   * Delegates to CandleStorageWriter service
   */
  async cleanupOldData(pair: string, granularity: string): Promise<void> {
    if (!this.isConnected) {
      await this.connect();
    }

    if (!this.writer) {
      throw new Error('Storage writer not initialized');
    }

    await this.writer.cleanupOldData(pair, granularity);
  }

  /**
   * Get storage statistics
   * Returns memory usage and key count information
   */
  async getStorageStats(): Promise<{
    totalKeys: number;
    memoryUsage: string;
    pairs: string[];
    granularities: string[];
  }> {
    if (!this.isConnected) {
      await this.connect();
    }

    const info = await this.redis.info('memory');
    const memoryMatch = info.match(/used_memory_human:(.+)/);
    const memoryUsage = memoryMatch ? memoryMatch[1].trim() : 'unknown';

    const { generateCandleKey, CANDLE_STORAGE_CONFIG } = await import('./RedisConfig');
    const keys = await this.redis.keys(`${CANDLE_STORAGE_CONFIG.keyPrefixes.candles}:*`);
    const pairs = new Set<string>();
    const granularities = new Set<string>();

    keys.forEach(key => {
      const parts = key.split(':');
      if (parts.length >= 3) {
        pairs.add(parts[1]);
        granularities.add(parts[2]);
      }
    });

    return {
      totalKeys: keys.length,
      memoryUsage,
      pairs: Array.from(pairs),
      granularities: Array.from(granularities)
    };
  }
}

// Export singleton instance
export const redisCandleStorage = new RedisCandleStorage();
