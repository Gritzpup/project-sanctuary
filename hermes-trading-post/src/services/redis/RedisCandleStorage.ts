/**
 * Redis Candle Storage Service
 * 
 * High-performance candle storage system with 5-year deep storage,
 * seamless granularity switching, and real-time updates
 */

import Redis from 'ioredis';
import type { CandlestickData } from 'lightweight-charts';
import { 
  REDIS_CONFIG, 
  CANDLE_STORAGE_CONFIG, 
  GRANULARITY_SECONDS,
  generateCandleKey,
  generateMetadataKey,
  generateCheckpointKey,
  generateLockKey
} from './RedisConfig';
import { logger } from '../logging';

export interface StoredCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface CandleMetadata {
  pair: string;
  granularity: string;
  firstTimestamp: number;
  lastTimestamp: number;
  totalCandles: number;
  lastUpdated: number;
}

export interface CandleRange {
  start: number;
  end: number;
  granularity: string;
  pair: string;
}

export class RedisCandleStorage {
  private redis: Redis;
  private isConnected: boolean = false;
  private connectionPromise: Promise<void> | null = null;

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

  private setupEventHandlers(): void {
    this.redis.on('connect', () => {
      logger.info( 'Connected to Redis on port 6379');
      this.isConnected = true;
    });

    this.redis.on('error', (error) => {
      logger.error( 'Redis connection error', { error: error.message });
      this.isConnected = false;
    });

    this.redis.on('close', () => {
      logger.warn( 'Redis connection closed');
      this.isConnected = false;
    });
  }

  async connect(): Promise<void> {
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    this.connectionPromise = this.redis.connect().then(() => {
      this.isConnected = true;
      logger.info( 'Redis candle storage initialized');
    });

    return this.connectionPromise;
  }

  async disconnect(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
      this.isConnected = false;
    }
  }

  /**
   * Store candles for a specific granularity with efficient batching
   */
  async storeCandles(
    pair: string, 
    granularity: string, 
    candles: StoredCandle[]
  ): Promise<void> {
    if (!this.isConnected) {
      await this.connect();
    }

    const lockKey = generateLockKey('store', pair, granularity);
    
    try {
      // Acquire lock for this operation
      const lockAcquired = await this.redis.set(lockKey, '1', 'EX', 30, 'NX');
      if (!lockAcquired) {
        logger.warn( 'Could not acquire lock for storing candles', { pair, granularity });
        return;
      }

      // Group candles by day for efficient storage
      const candlesByDay = this.groupCandlesByDay(candles);
      
      const pipeline = this.redis.pipeline();
      let operationCount = 0;

      for (const [dayTimestamp, dayCandles] of candlesByDay.entries()) {
        const key = generateCandleKey(pair, granularity, dayTimestamp);
        
        // Store candles as sorted set with timestamp as score
        for (const candle of dayCandles) {
          const candleData = JSON.stringify({
            o: candle.open,
            h: candle.high,
            l: candle.low,
            c: candle.close,
            v: candle.volume
          });
          
          pipeline.zadd(key, candle.time, `${candle.time}:${candleData}`);
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

      // Update metadata
      await this.updateMetadata(pair, granularity, candles);
      
      // Create checkpoint for data validation
      await this.createCheckpoint(pair, granularity, candles);

      logger.info( 'Stored candles successfully', {
        pair,
        granularity,
        candleCount: candles.length,
        dayBuckets: candlesByDay.size
      });

    } finally {
      // Release lock
      await this.redis.del(lockKey);
    }
  }

  /**
   * Retrieve candles for a specific range with optimized fetching
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

    const startDay = Math.floor(startTime / 86400) * 86400;
    const endDay = Math.floor(endTime / 86400) * 86400;
    
    const allCandles: StoredCandle[] = [];
    
    // Fetch data day by day for efficient retrieval
    for (let dayTimestamp = startDay; dayTimestamp <= endDay; dayTimestamp += 86400) {
      const key = generateCandleKey(pair, granularity, dayTimestamp);
      
      // Get candles within the time range for this day
      const candleData = await this.redis.zrangebyscore(
        key,
        startTime,
        endTime,
        'WITHSCORES'
      );
      
      // Parse candle data
      for (let i = 0; i < candleData.length; i += 2) {
        const [dataStr, timestampStr] = [candleData[i], candleData[i + 1]];
        const timestamp = parseInt(timestampStr);
        
        try {
          const [timeStr, candleJson] = dataStr.split(':', 2);
          const candleData = JSON.parse(candleJson);
          
          allCandles.push({
            time: timestamp,
            open: candleData.o,
            high: candleData.h,
            low: candleData.l,
            close: candleData.c,
            volume: candleData.v || 0
          });
        } catch (error) {
          logger.error( 'Error parsing candle data', { error: error.message, dataStr });
        }
      }
    }

    // Sort by timestamp to ensure proper order
    allCandles.sort((a, b) => a.time - b.time);

    logger.debug( 'Retrieved candles', {
      pair,
      granularity,
      requestedRange: { startTime, endTime },
      retrievedCount: allCandles.length
    });

    return allCandles;
  }

  /**
   * Get latest candles for quick chart initialization
   */
  async getLatestCandles(
    pair: string,
    granularity: string,
    count: number = 1000
  ): Promise<StoredCandle[]> {
    const metadata = await this.getMetadata(pair, granularity);
    if (!metadata) {
      return [];
    }

    const granularitySeconds = GRANULARITY_SECONDS[granularity];
    const startTime = metadata.lastTimestamp - (count * granularitySeconds);
    
    return this.getCandles(pair, granularity, startTime, metadata.lastTimestamp);
  }

  /**
   * Update metadata for efficient range queries
   */
  private async updateMetadata(
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
      firstTimestamp: existing ? Math.min(existing.firstTimestamp, firstTimestamp) : firstTimestamp,
      lastTimestamp: existing ? Math.max(existing.lastTimestamp, lastTimestamp) : lastTimestamp,
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
  }

  /**
   * Get metadata for a pair/granularity combination
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
   * Create checkpoint for data validation
   */
  private async createCheckpoint(
    pair: string,
    granularity: string,
    candles: StoredCandle[]
  ): Promise<void> {
    if (candles.length === 0) return;

    const latestCandle = candles[candles.length - 1];
    const checkpointKey = generateCheckpointKey(pair, granularity, latestCandle.time);
    
    const checkpoint = {
      timestamp: latestCandle.time,
      candleCount: candles.length,
      lastPrice: latestCandle.close,
      checksum: this.calculateChecksum(candles.slice(-10)) // Checksum of last 10 candles
    };

    await this.redis.hset(checkpointKey, checkpoint);
    await this.redis.expire(checkpointKey, CANDLE_STORAGE_CONFIG.ttl.checkpoints);
  }

  /**
   * Group candles by day for efficient storage
   */
  private groupCandlesByDay(candles: StoredCandle[]): Map<number, StoredCandle[]> {
    const candlesByDay = new Map<number, StoredCandle[]>();
    
    for (const candle of candles) {
      const dayTimestamp = Math.floor(candle.time / 86400) * 86400;
      
      if (!candlesByDay.has(dayTimestamp)) {
        candlesByDay.set(dayTimestamp, []);
      }
      
      candlesByDay.get(dayTimestamp)!.push(candle);
    }
    
    return candlesByDay;
  }

  /**
   * Calculate checksum for data validation
   */
  private calculateChecksum(candles: StoredCandle[]): string {
    const data = candles.map(c => `${c.time}:${c.close}`).join('|');
    // Simple hash function - in production, use crypto.createHash
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }

  /**
   * Clean up old data beyond 5-year retention
   */
  async cleanupOldData(pair: string, granularity: string): Promise<void> {
    const cutoffTime = Date.now() / 1000 - CANDLE_STORAGE_CONFIG.maxStorageDuration;
    const cutoffDay = Math.floor(cutoffTime / 86400) * 86400;
    
    const lockKey = generateLockKey('cleanup', pair, granularity);
    
    try {
      const lockAcquired = await this.redis.set(lockKey, '1', 'EX', 300, 'NX');
      if (!lockAcquired) return;

      let cleanedDays = 0;
      
      // Clean up day by day
      for (let dayTimestamp = cutoffDay - (30 * 86400); dayTimestamp < cutoffDay; dayTimestamp += 86400) {
        const key = generateCandleKey(pair, granularity, dayTimestamp);
        const deleted = await this.redis.del(key);
        if (deleted > 0) {
          cleanedDays++;
        }
      }

      if (cleanedDays > 0) {
        logger.info( 'Cleaned up old candle data', {
          pair,
          granularity,
          cleanedDays,
          cutoffTime: new Date(cutoffTime * 1000).toISOString()
        });
      }

    } finally {
      await this.redis.del(lockKey);
    }
  }

  /**
   * Get storage statistics
   */
  async getStorageStats(): Promise<{
    totalKeys: number;
    memoryUsage: string;
    pairs: string[];
    granularities: string[];
  }> {
    const info = await this.redis.info('memory');
    const memoryMatch = info.match(/used_memory_human:(.+)/);
    const memoryUsage = memoryMatch ? memoryMatch[1].trim() : 'unknown';

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