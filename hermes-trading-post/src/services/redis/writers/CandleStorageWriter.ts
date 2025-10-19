/**
 * @file CandleStorageWriter.ts
 * @description Handles storage and deletion of candle data in Redis
 */

import Redis from 'ioredis';
import type { StoredCandle } from '../types';
import {
  generateCandleKey,
  generateLockKey,
  CANDLE_STORAGE_CONFIG
} from '../RedisConfig';
import {
  formatCandleForRedis,
  groupCandlesByDay,
  getDaysInRange
} from '../serializers/CandleDataSerializer';
import { CandleMetadataManager } from '../metadata/CandleMetadataManager';
import { logger } from '../../logging';

/**
 * Handles all write operations for storing and deleting candles
 */
export class CandleStorageWriter {
  private redis: Redis;
  private metadataManager: CandleMetadataManager;

  constructor(redis: Redis, metadataManager: CandleMetadataManager) {
    this.redis = redis;
    this.metadataManager = metadataManager;
  }

  /**
   * Store candles with distributed locking and batch processing
   * Groups candles by day for efficient storage
   */
  async storeCandles(
    pair: string,
    granularity: string,
    candles: StoredCandle[]
  ): Promise<void> {
    if (candles.length === 0) {
      return;
    }

    const lockKey = generateLockKey('store', pair, granularity);

    try {
      // Acquire distributed lock to prevent concurrent writes
      const lockAcquired = await this.acquireLock(lockKey);
      if (!lockAcquired) {
        logger.warn('Could not acquire lock for storing candles', { pair, granularity });
        return;
      }

      // Group candles by day for efficient storage
      const candlesByDay = groupCandlesByDay(candles);
      const pipeline = this.redis.pipeline();
      let operationCount = 0;

      // Process each day's candles
      for (const [dayTimestamp, dayCandles] of candlesByDay.entries()) {
        const key = generateCandleKey(pair, granularity, dayTimestamp);

        // Add each candle to the sorted set
        // Score is timestamp, value is the formatted candle data
        for (const candle of dayCandles) {
          const formattedData = formatCandleForRedis(candle);
          pipeline.zadd(key, candle.time, formattedData);
          pipeline.expire(key, CANDLE_STORAGE_CONFIG.ttl.candles);
        }

        operationCount += dayCandles.length;

        // Execute pipeline in batches to avoid memory issues
        if (operationCount >= CANDLE_STORAGE_CONFIG.batchSizes.insert) {
          await pipeline.exec();
          pipeline.clear();
          operationCount = 0;
        }
      }

      // Execute remaining operations
      if (operationCount > 0) {
        await pipeline.exec();
      }

      // Update metadata with new candle info
      await this.metadataManager.updateMetadata(pair, granularity, candles);

      // Create checkpoint for data validation
      await this.metadataManager.createCheckpoint(pair, granularity, candles);

      logger.info('Stored candles successfully', {
        pair,
        granularity,
        candleCount: candles.length,
        dayBuckets: candlesByDay.size
      });
    } finally {
      // Always release the lock
      await this.releaseLock(lockKey);
    }
  }

  /**
   * Clean up old candles beyond the retention period
   * Deletes data older than maxStorageDuration
   */
  async cleanupOldData(pair: string, granularity: string): Promise<void> {
    const cutoffTime = Date.now() / 1000 - CANDLE_STORAGE_CONFIG.maxStorageDuration;
    const lockKey = generateLockKey('cleanup', pair, granularity);

    try {
      // Acquire lock for cleanup operation
      const lockAcquired = await this.acquireLock(lockKey, 300); // 5-minute lock for cleanup
      if (!lockAcquired) {
        logger.debug('Cleanup already in progress', { pair, granularity });
        return;
      }

      let cleanedDays = 0;

      // Calculate which days to clean
      const cutoffDay = Math.floor(cutoffTime / 86400) * 86400;
      const lookbackStart = cutoffDay - 30 * 86400; // Look back 30 days to be safe

      // Delete data day by day
      for (let dayTimestamp = lookbackStart; dayTimestamp < cutoffDay; dayTimestamp += 86400) {
        const key = generateCandleKey(pair, granularity, dayTimestamp);
        const deleted = await this.redis.del(key);

        if (deleted > 0) {
          cleanedDays++;
        }
      }

      if (cleanedDays > 0) {
        logger.info('Cleaned up old candle data', {
          pair,
          granularity,
          cleanedDays,
          cutoffTime: new Date(cutoffTime * 1000).toISOString()
        });
      }
    } finally {
      await this.releaseLock(lockKey);
    }
  }

  /**
   * Delete all candles for a pair/granularity (nuclear option)
   * Used for resetting or migrating data
   */
  async deleteAllCandles(pair: string, granularity: string): Promise<number> {
    const metadata = await this.metadataManager.getMetadata(pair, granularity);

    if (!metadata) {
      return 0;
    }

    const dayTimestamps = getDaysInRange(metadata.firstTimestamp, metadata.lastTimestamp);
    let deletedDays = 0;

    for (const dayTimestamp of dayTimestamps) {
      const key = generateCandleKey(pair, granularity, dayTimestamp);
      const deleted = await this.redis.del(key);

      if (deleted > 0) {
        deletedDays++;
      }
    }

    // Delete metadata
    await this.metadataManager.deleteMetadata(pair, granularity);

    logger.info('Deleted all candles', {
      pair,
      granularity,
      dayBucketsDeleted: deletedDays,
      candlesDeleted: metadata.totalCandles
    });

    return metadata.totalCandles;
  }

  /**
   * Acquire a distributed lock for write operations
   * Prevents concurrent modifications from multiple processes
   */
  private async acquireLock(lockKey: string, ttl: number = 30): Promise<boolean> {
    try {
      // Use SET NX EX for atomic lock acquisition with expiration
      const result = await this.redis.set(lockKey, '1', 'EX', ttl, 'NX');
      return result !== null;
    } catch (error) {
      logger.error('Error acquiring lock', {
        error: error instanceof Error ? error.message : String(error),
        lockKey
      });
      return false;
    }
  }

  /**
   * Release a distributed lock
   */
  private async releaseLock(lockKey: string): Promise<void> {
    try {
      await this.redis.del(lockKey);
    } catch (error) {
      logger.error('Error releasing lock', {
        error: error instanceof Error ? error.message : String(error),
        lockKey
      });
    }
  }
}
