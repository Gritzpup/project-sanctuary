/**
 * @file CandleMetadataManager.ts
 * @description Manages metadata and checkpoint operations for candle storage
 */

import Redis from 'ioredis';
import type { StoredCandle, CandleMetadata, Checkpoint } from '../types';
import {
  generateMetadataKey,
  generateCheckpointKey,
  CANDLE_STORAGE_CONFIG
} from '../RedisConfig';
import { calculateChecksum } from '../serializers/CandleDataSerializer';
import { logger } from '../../logging';

/**
 * Manages metadata and validation checkpoints for candles
 */
export class CandleMetadataManager {
  private redis: Redis;

  constructor(redis: Redis) {
    this.redis = redis;
  }

  /**
   * Update metadata after storing candles
   * Tracks first/last timestamps, total count, and last update time
   */
  async updateMetadata(
    pair: string,
    granularity: string,
    candles: StoredCandle[]
  ): Promise<void> {
    if (candles.length === 0) return;

    const metadataKey = generateMetadataKey(pair, granularity);
    const existing = await this.getMetadata(pair, granularity);

    const firstTimestamp = Math.min(...candles.map(c => c.time));
    const lastTimestamp = Math.max(...candles.map(c => c.time));

    const metadata: CandleMetadata = {
      pair,
      granularity,
      firstTimestamp: existing
        ? Math.min(existing.firstTimestamp, firstTimestamp)
        : firstTimestamp,
      lastTimestamp: existing
        ? Math.max(existing.lastTimestamp, lastTimestamp)
        : lastTimestamp,
      totalCandles: (existing?.totalCandles || 0) + candles.length,
      lastUpdated: Date.now()
    };

    await this.redis.hset(metadataKey, {
      pair: metadata.pair,
      granularity: metadata.granularity,
      firstTimestamp: metadata.firstTimestamp.toString(),
      lastTimestamp: metadata.lastTimestamp.toString(),
      totalCandles: metadata.totalCandles.toString(),
      lastUpdated: metadata.lastUpdated.toString()
    });

    await this.redis.expire(metadataKey, CANDLE_STORAGE_CONFIG.ttl.metadata);

    logger.debug('Updated metadata', {
      pair,
      granularity,
      totalCandles: metadata.totalCandles,
      coverage: {
        from: new Date(metadata.firstTimestamp * 1000).toISOString(),
        to: new Date(metadata.lastTimestamp * 1000).toISOString()
      }
    });
  }

  /**
   * Retrieve metadata for a pair/granularity combination
   * @returns Metadata object or null if not found
   */
  async getMetadata(pair: string, granularity: string): Promise<CandleMetadata | null> {
    const metadataKey = generateMetadataKey(pair, granularity);
    const data = await this.redis.hgetall(metadataKey);

    if (!data.pair) {
      return null;
    }

    return {
      pair: data.pair,
      granularity: data.granularity,
      firstTimestamp: parseInt(data.firstTimestamp),
      lastTimestamp: parseInt(data.lastTimestamp),
      totalCandles: parseInt(data.totalCandles),
      lastUpdated: parseInt(data.lastUpdated)
    };
  }

  /**
   * Create a checkpoint for data validation
   * Stores last candle info and checksum of recent candles
   */
  async createCheckpoint(
    pair: string,
    granularity: string,
    candles: StoredCandle[]
  ): Promise<void> {
    if (candles.length === 0) return;

    const latestCandle = candles[candles.length - 1];
    const checkpointKey = generateCheckpointKey(pair, granularity, latestCandle.time);

    // Checksum based on last 10 candles for quick validation
    const recentCandles = candles.slice(Math.max(0, candles.length - 10));
    const checksum = calculateChecksum(recentCandles);

    const checkpoint: Checkpoint = {
      timestamp: latestCandle.time,
      candleCount: candles.length,
      lastPrice: latestCandle.close,
      checksum
    };

    await this.redis.hset(checkpointKey, {
      timestamp: checkpoint.timestamp.toString(),
      candleCount: checkpoint.candleCount.toString(),
      lastPrice: checkpoint.lastPrice.toString(),
      checksum: checkpoint.checksum
    });

    await this.redis.expire(checkpointKey, CANDLE_STORAGE_CONFIG.ttl.checkpoints);

    logger.debug('Created checkpoint', {
      pair,
      granularity,
      timestamp: new Date(latestCandle.time * 1000).toISOString(),
      price: latestCandle.close
    });
  }

  /**
   * Validate a checkpoint for data integrity
   * Recalculates checksum and compares with stored value
   */
  async validateCheckpoint(
    pair: string,
    granularity: string,
    timestamp: number,
    candles: StoredCandle[]
  ): Promise<boolean> {
    const checkpointKey = generateCheckpointKey(pair, granularity, timestamp);
    const data = await this.redis.hgetall(checkpointKey);

    if (!data.checksum) {
      logger.warn('Checkpoint not found for validation', { pair, granularity, timestamp });
      return false;
    }

    const recentCandles = candles.slice(Math.max(0, candles.length - 10));
    const calculatedChecksum = calculateChecksum(recentCandles);
    const storedChecksum = data.checksum;

    const valid = calculatedChecksum === storedChecksum;

    if (!valid) {
      logger.warn('Checkpoint validation failed', {
        pair,
        granularity,
        timestamp,
        expected: storedChecksum,
        calculated: calculatedChecksum
      });
    }

    return valid;
  }

  /**
   * Delete metadata for a pair/granularity
   * Used during cleanup or reset operations
   */
  async deleteMetadata(pair: string, granularity: string): Promise<void> {
    const metadataKey = generateMetadataKey(pair, granularity);
    await this.redis.del(metadataKey);

    logger.debug('Deleted metadata', { pair, granularity });
  }

  /**
   * Delete checkpoint for a specific timestamp
   * Used during cleanup operations
   */
  async deleteCheckpoint(
    pair: string,
    granularity: string,
    timestamp: number
  ): Promise<void> {
    const checkpointKey = generateCheckpointKey(pair, granularity, timestamp);
    await this.redis.del(checkpointKey);
  }
}
