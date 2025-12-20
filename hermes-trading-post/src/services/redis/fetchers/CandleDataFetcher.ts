/**
 * @file CandleDataFetcher.ts
 * @description Handles retrieval and parsing of candle data from Redis
 */

import Redis from 'ioredis';
import type { StoredCandle } from '../types';
import {
  generateCandleKey,
  CANDLE_STORAGE_CONFIG,
  GRANULARITY_SECONDS
} from '../RedisConfig';
import {
  parseCandleFromRedis,
  getDaysInRange,
  filterCandlesByTimeRange,
  sortCandlesByTime,
  getGranularitySeconds
} from '../serializers/CandleDataSerializer';
import { CandleMetadataManager } from '../metadata/CandleMetadataManager';
import { logger } from '../../logging';

/**
 * Handles all read operations for retrieving candles from Redis
 */
export class CandleDataFetcher {
  private redis: Redis;
  private metadataManager: CandleMetadataManager;

  constructor(redis: Redis, metadataManager: CandleMetadataManager) {
    this.redis = redis;
    this.metadataManager = metadataManager;
  }

  /**
   * Retrieve candles for a specific time range
   * Efficiently fetches data by iterating through day buckets
   */
  async getCandles(
    pair: string,
    granularity: string,
    startTime: number,
    endTime: number
  ): Promise<StoredCandle[]> {
    const allCandles: StoredCandle[] = [];
    const dayTimestamps = getDaysInRange(startTime, endTime);

    // Fetch candles day by day
    for (const dayTimestamp of dayTimestamps) {
      const dayCandles = await this.getCandlesForDay(
        pair,
        granularity,
        dayTimestamp,
        startTime,
        endTime
      );
      allCandles.push(...dayCandles);
    }

    // Sort and filter to ensure proper order and range
    const sorted = sortCandlesByTime(allCandles);
    const filtered = filterCandlesByTimeRange(sorted, startTime, endTime);


    return filtered;
  }

  /**
   * Retrieve latest N candles for quick chart initialization
   */
  async getLatestCandles(
    pair: string,
    granularity: string,
    count: number = 1000
  ): Promise<StoredCandle[]> {
    const metadata = await this.metadataManager.getMetadata(pair, granularity);

    if (!metadata) {
      return [];
    }

    const granularitySeconds = getGranularitySeconds(granularity);
    const startTime = metadata.lastTimestamp - count * granularitySeconds;
    const endTime = metadata.lastTimestamp;

    return this.getCandles(pair, granularity, startTime, endTime);
  }

  /**
   * Retrieve candles for a specific day
   * @param dayTimestamp Start of the day (unix timestamp, seconds)
   * @param startTime Actual start time (may be mid-day)
   * @param endTime Actual end time (may be mid-day)
   * @returns Array of candles for this day within the time range
   */
  private async getCandlesForDay(
    pair: string,
    granularity: string,
    dayTimestamp: number,
    startTime: number,
    endTime: number
  ): Promise<StoredCandle[]> {
    const key = generateCandleKey(pair, granularity, dayTimestamp);

    try {
      // Fetch all candles for this day from sorted set
      // The sorted set scores are timestamps, so we query by time range
      const candleData = await this.redis.zrangebyscore(
        key,
        startTime,
        endTime,
        'WITHSCORES'
      );

      const dayCandles: StoredCandle[] = [];

      // Parse results (alternating: data, score, data, score, ...)
      for (let i = 0; i < candleData.length; i += 2) {
        const dataStr = candleData[i];
        const timestampStr = candleData[i + 1];

        try {
          const timestamp = parseInt(timestampStr);
          const candle = parseCandleFromRedis(dataStr);

          // Verify timestamp consistency
          if (candle.time === timestamp) {
            dayCandles.push(candle);
          } else {
          }
        } catch (error) {
        }
      }

      return dayCandles;
    } catch (error) {
      return [];
    }
  }

  /**
   * Check if candles exist for a time range
   * Useful for determining if data needs to be fetched
   */
  async hasCandles(
    pair: string,
    granularity: string,
    startTime: number,
    endTime: number
  ): Promise<boolean> {
    const metadata = await this.metadataManager.getMetadata(pair, granularity);

    if (!metadata) {
      return false;
    }

    // Check if requested range overlaps with stored range
    return !(endTime < metadata.firstTimestamp || startTime > metadata.lastTimestamp);
  }

  /**
   * Get candle count for a time range (without fetching actual data)
   */
  async getCandleCount(
    pair: string,
    granularity: string,
    startTime: number,
    endTime: number
  ): Promise<number> {
    let count = 0;
    const dayTimestamps = getDaysInRange(startTime, endTime);

    for (const dayTimestamp of dayTimestamps) {
      const key = generateCandleKey(pair, granularity, dayTimestamp);
      const dayCount = await this.redis.zcount(key, startTime, endTime);
      count += dayCount;
    }

    return count;
  }

  /**
   * Get the first available candle timestamp
   */
  async getFirstCandleTime(pair: string, granularity: string): Promise<number | null> {
    const metadata = await this.metadataManager.getMetadata(pair, granularity);
    return metadata?.firstTimestamp ?? null;
  }

  /**
   * Get the last available candle timestamp
   */
  async getLastCandleTime(pair: string, granularity: string): Promise<number | null> {
    const metadata = await this.metadataManager.getMetadata(pair, granularity);
    return metadata?.lastTimestamp ?? null;
  }
}
