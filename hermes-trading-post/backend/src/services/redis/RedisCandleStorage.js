/**
 * Redis Candle Storage Service
 * 
 * High-performance candle storage system with 5-year deep storage,
 * seamless granularity switching, and real-time updates
 */

import Redis from 'ioredis';
import { 
  REDIS_CONFIG, 
  CANDLE_STORAGE_CONFIG, 
  GRANULARITY_SECONDS,
  generateCandleKey,
  generateMetadataKey,
  generateCheckpointKey,
  generateLockKey
} from './RedisConfig.js';

class RedisCandleStorage {
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

    this.isConnected = false;
    this.connectionPromise = null;

    // 🔥 PERFORMANCE FIX: Cache candle counts to avoid expensive KEYS operations
    this.candleCountCache = new Map(); // key: "pair:granularity", value: {count, timestamp}
    this.CACHE_TTL = 60000; // Cache for 1 minute

    this.setupEventHandlers();
  }

  setupEventHandlers() {
    this.redis.on('connect', () => {
      this.isConnected = true;
    });

    this.redis.on('error', (error) => {
      this.isConnected = false;
    });

    this.redis.on('close', () => {
      this.isConnected = false;
    });
  }

  async connect() {
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    this.connectionPromise = this.redis.connect().then(() => {
      this.isConnected = true;
    });

    return this.connectionPromise;
  }

  async disconnect() {
    if (this.redis) {
      await this.redis.quit();
      this.isConnected = false;
    }
  }

  /**
   * Store candles for a specific granularity with efficient batching
   */
  async storeCandles(pair, granularity, candles) {
    if (!this.isConnected) {
      await this.connect();
    }

    const lockKey = generateLockKey('store', pair, granularity);
    
    try {
      // Acquire lock for this operation (reduced to 5 seconds to minimize blocking)
      const lockAcquired = await this.redis.set(lockKey, '1', 'EX', 5, 'NX');
      if (!lockAcquired) {
        // Don't fail silently - wait briefly and retry once
        await new Promise(resolve => setTimeout(resolve, 500));
        const retryLock = await this.redis.set(lockKey, '1', 'EX', 5, 'NX');
        if (!retryLock) {
          return;
        }
      }

      // Group candles by day for efficient storage
      const candlesByDay = this.groupCandlesByDay(candles);
      
      const pipeline = this.redis.pipeline();
      let operationCount = 0;

      for (const [dayTimestamp, dayCandles] of candlesByDay.entries()) {
        const key = generateCandleKey(pair, granularity, dayTimestamp);
        
        // Store candles as sorted set with timestamp as score
        // Use timestamp as member key to ensure only ONE candle per timestamp
        for (const candle of dayCandles) {
          const candleData = JSON.stringify({
            o: candle.open,
            h: candle.high,
            l: candle.low,
            c: candle.close,
            v: candle.volume
          });

          // CRITICAL: Use timestamp as member to prevent duplicates!
          // Redis ZADD will UPDATE the existing member if timestamp already exists
          const member = `${candle.time}`;
          pipeline.zadd(key, candle.time, member);
          // Store the actual candle data in a hash using the timestamp as key
          pipeline.hset(`${key}:data`, member, candleData);
          pipeline.expire(key, CANDLE_STORAGE_CONFIG.ttl.candles);
          pipeline.expire(`${key}:data`, CANDLE_STORAGE_CONFIG.ttl.candles);
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

      // Invalidate cache before updating metadata to get fresh count
      const cacheKey = `${pair}:${granularity}`;
      this.candleCountCache.delete(cacheKey);

      // Update metadata
      await this.updateMetadata(pair, granularity, candles);

      // Create checkpoint for data validation
      await this.createCheckpoint(pair, granularity, candles);

      //   pair,
      //   granularity,
      //   candleCount: candles.length,
      //   dayBuckets: candlesByDay.size
      // });

    } finally {
      // Release lock
      await this.redis.del(lockKey);
    }
  }

  /**
   * Retrieve candles for a specific range with optimized fetching
   */
  async getCandles(pair, granularity, startTime, endTime) {
    if (!this.isConnected) {
      await this.connect();
    }

    const lockKey = generateLockKey('store', pair, granularity);

    // Check if write is in progress - if so, wait briefly for it to complete
    const writeInProgress = await this.redis.exists(lockKey);
    if (writeInProgress) {
      // Wait up to 2 seconds for write to complete
      for (let i = 0; i < 20; i++) {
        await new Promise(resolve => setTimeout(resolve, 100));
        const stillLocked = await this.redis.exists(lockKey);
        if (!stillLocked) {
          break;
        }
      }
    }

    const startDay = Math.floor(startTime / 86400) * 86400;
    const endDay = Math.floor(endTime / 86400) * 86400;
    
    const allCandles = [];
    
    // Fetch data day by day for efficient retrieval
    for (let dayTimestamp = startDay; dayTimestamp <= endDay; dayTimestamp += 86400) {
      const key = generateCandleKey(pair, granularity, dayTimestamp);

      // Get timestamps within the time range for this day
      const timestamps = await this.redis.zrangebyscore(
        key,
        startTime,
        endTime
      );

      if (timestamps.length === 0) continue;

      // Fetch actual candle data from hash
      const candleDataArray = await this.redis.hmget(`${key}:data`, ...timestamps);

      // Parse candle data
      for (let i = 0; i < timestamps.length; i++) {
        const timestamp = parseInt(timestamps[i]);
        const dataStr = candleDataArray[i];

        if (!dataStr) {
          // Fallback: try old format from sorted set
          const oldData = await this.redis.zrangebyscore(key, timestamp, timestamp);
          if (oldData && oldData.length > 0) {
            try {
              const parsed = JSON.parse(oldData[0].indexOf(':') > -1 ? oldData[0].substring(oldData[0].indexOf(':') + 1) : oldData[0]);
              allCandles.push({
                time: timestamp,
                open: parsed.o,
                high: parsed.h,
                low: parsed.l,
                close: parsed.c,
                volume: parsed.v || 0
              });
            } catch (e) {
            }
          }
          continue;
        }

        try {
          const parsed = JSON.parse(dataStr);
          allCandles.push({
            time: timestamp,
            open: parsed.o,
            high: parsed.h,
            low: parsed.l,
            close: parsed.c,
            volume: parsed.v || 0
          });
        } catch (error) {
        }
      }
    }

    // Sort by timestamp to ensure proper order
    allCandles.sort((a, b) => a.time - b.time);

    //   pair,
    //   granularity,
    //   requestedRange: { startTime, endTime },
    //   retrievedCount: allCandles.length
    // });

    return allCandles;
  }

  /**
   * Update metadata for efficient range queries
   */
  async updateMetadata(pair, granularity, candles) {
    if (candles.length === 0) return;

    const metadataKey = generateMetadataKey(pair, granularity);
    const existing = await this.getMetadata(pair, granularity);

    const firstTimestamp = Math.min(...candles.map(c => c.time));
    const lastTimestamp = Math.max(...candles.map(c => c.time));

    // 🔥 FIX: Count actual unique candles in Redis instead of accumulating writes
    // This prevents the metadata counter from inflating due to overwrites
    const actualCandleCount = await this.getActualCandleCount(pair, granularity);

    const metadata = {
      pair,
      granularity,
      firstTimestamp: existing ? Math.min(existing.firstTimestamp, firstTimestamp) : firstTimestamp,
      lastTimestamp: existing ? Math.max(existing.lastTimestamp, lastTimestamp) : lastTimestamp,
      totalCandles: actualCandleCount, // Use actual count from Redis
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
   * Get the actual count of unique candles stored in Redis
   * Uses caching to avoid expensive KEYS operations on every write
   */
  async getActualCandleCount(pair, granularity, forceRefresh = false) {
    const cacheKey = `${pair}:${granularity}`;
    const now = Date.now();

    // Check cache first (unless force refresh)
    if (!forceRefresh) {
      const cached = this.candleCountCache.get(cacheKey);
      if (cached && (now - cached.timestamp) < this.CACHE_TTL) {
        return cached.count;
      }
    }

    // 🔥 PERFORMANCE: Use SCAN instead of KEYS to avoid blocking
    const pattern = `${CANDLE_STORAGE_CONFIG.keyPrefixes.candles}:${pair}:${granularity}:*:data`;
    const keys = [];

    // Use SCAN for non-blocking key retrieval
    let cursor = '0';
    do {
      const result = await this.redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = result[0];
      keys.push(...result[1]);
    } while (cursor !== '0');

    let totalCount = 0;

    // Count candles in each day bucket
    for (const key of keys) {
      const count = await this.redis.hlen(key);
      totalCount += count;
    }

    // Cache the result
    this.candleCountCache.set(cacheKey, {
      count: totalCount,
      timestamp: now
    });

    return totalCount;
  }

  /**
   * Get metadata for a pair/granularity combination
   */
  async getMetadata(pair, granularity) {
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
  async createCheckpoint(pair, granularity, candles) {
    if (candles.length === 0) return;

    const latestCandle = candles[candles.length - 1];
    const checkpointKey = generateCheckpointKey(pair, granularity, latestCandle.time);

    // 🔥 MEMORY LEAK FIX: Only create checkpoint if it doesn't exist
    // This prevents creating duplicate checkpoints every 5 seconds
    const exists = await this.redis.exists(checkpointKey);
    if (exists) {
      // Checkpoint already exists for this week, skip creation
      return;
    }

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
  groupCandlesByDay(candles) {
    const candlesByDay = new Map();
    
    for (const candle of candles) {
      const dayTimestamp = Math.floor(candle.time / 86400) * 86400;
      
      if (!candlesByDay.has(dayTimestamp)) {
        candlesByDay.set(dayTimestamp, []);
      }
      
      candlesByDay.get(dayTimestamp).push(candle);
    }
    
    return candlesByDay;
  }

  /**
   * Calculate checksum for data validation
   */
  calculateChecksum(candles) {
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
   * Populate historical data if missing
   */
  async populateHistoricalData(pair, granularity, hours = 24) {
    try {
      
      const now = Math.floor(Date.now() / 1000);
      const startTime = now - (hours * 3600); // Convert hours to seconds
      
      // Check if we already have recent data
      const existingCandles = await this.getCandles(pair, granularity, startTime, now);
      const granularitySeconds = {
        '1m': 60, '5m': 300, '15m': 900, '30m': 1800, '1h': 3600
      }[granularity] || 60;
      
      const expectedCandles = Math.floor((now - startTime) / granularitySeconds);
      const dataCompleteness = existingCandles.length / expectedCandles;
      
      
      if (dataCompleteness < 0.8) { // Less than 80% complete
        
        // Fetch from Coinbase API
        const response = await fetch(`https://api.exchange.coinbase.com/products/${pair}/candles?start=${new Date(startTime * 1000).toISOString()}&end=${new Date(now * 1000).toISOString()}&granularity=${granularitySeconds}`);
        
        if (!response.ok) {
          throw new Error(`Coinbase API error: ${response.status}`);
        }
        
        const apiData = await response.json();
        
        // Convert Coinbase format to our format
        const candles = apiData.map(([time, low, high, open, close, volume]) => ({
          time,
          open,
          high,
          low,
          close,
          volume
        }));
        
        // Store in Redis
        if (candles.length > 0) {
          await this.storeCandles(pair, granularity, candles);
        }
        
        return candles.length;
      } else {
        return 0;
      }
      
    } catch (error) {
      return 0;
    }
  }

  /**
   * Delete old candles beyond a cutoff time
   */
  async deleteOldCandles(pair, granularity, cutoffTime) {
    if (!this.isConnected) {
      await this.connect();
    }

    const lockKey = generateLockKey('cleanup', pair, granularity);

    try {
      // Acquire lock for cleanup operation
      const lockAcquired = await this.redis.set(lockKey, '1', 'EX', 30, 'NX');
      if (!lockAcquired) {
        return 0;
      }

      let totalDeleted = 0;
      const startDay = Math.floor(cutoffTime / 86400) * 86400;
      const cutoffDay = startDay;

      // Delete all days before the cutoff
      // Go back 10 years from cutoff to ensure we catch all old data
      const oldestDay = cutoffDay - (10 * 365 * 86400);


      for (let dayTimestamp = oldestDay; dayTimestamp < cutoffDay; dayTimestamp += 86400) {
        const key = generateCandleKey(pair, granularity, dayTimestamp);
        const dataKey = `${key}:data`;

        // Check if key exists before deleting
        const exists = await this.redis.exists(key);
        if (exists) {
          // Delete both the sorted set and the hash
          await this.redis.del(key);
          await this.redis.del(dataKey);
          totalDeleted++;
        }
      }

      // Also clean up old candles within the cutoff day
      const cutoffDayKey = generateCandleKey(pair, granularity, cutoffDay);
      const oldTimestamps = await this.redis.zrangebyscore(cutoffDayKey, '-inf', cutoffTime);

      if (oldTimestamps.length > 0) {
        // Delete old timestamps from the sorted set
        await this.redis.zremrangebyscore(cutoffDayKey, '-inf', cutoffTime);

        // Delete old data from the hash
        const dataKey = `${cutoffDayKey}:data`;
        await this.redis.hdel(dataKey, ...oldTimestamps);

      }

      // Update metadata after cleanup
      const remainingCandles = await this.redis.zcard(cutoffDayKey);
      if (remainingCandles > 0) {
        const firstTimestamp = await this.redis.zrange(cutoffDayKey, 0, 0, 'WITHSCORES');
        if (firstTimestamp.length > 0) {
          await this.updateMetadataAfterCleanup(pair, granularity, parseInt(firstTimestamp[1]));
        }
      }


      return totalDeleted;

    } finally {
      // Release lock
      await this.redis.del(lockKey);
    }
  }

  /**
   * Update metadata after cleanup operation
   */
  async updateMetadataAfterCleanup(pair, granularity, newFirstTimestamp) {
    const metadataKey = generateMetadataKey(pair, granularity);
    const existing = await this.getMetadata(pair, granularity);

    if (existing) {
      await this.redis.hset(metadataKey, {
        firstTimestamp: newFirstTimestamp.toString(),
        lastUpdated: Date.now().toString()
      });

    }
  }

  /**
   * Get storage statistics - optimized with SCAN instead of KEYS
   * 🚀 PERFORMANCE: SCAN is non-blocking, KEYS blocks entire Redis instance
   */
  async getStorageStats() {
    const info = await this.redis.info('memory');
    const memoryMatch = info.match(/used_memory_human:(.+)/);
    const memoryUsage = memoryMatch ? memoryMatch[1].trim() : 'unknown';

    const pairs = new Set();
    const granularities = new Set();
    let keyCount = 0;
    let cursor = '0';

    // 🚀 Use non-blocking SCAN instead of KEYS for massive performance improvement
    // KEYS blocks the entire Redis instance, SCAN iterates without blocking
    do {
      const [newCursor, keys] = await this.redis.scan(
        cursor,
        'MATCH',
        `${CANDLE_STORAGE_CONFIG.keyPrefixes.candles}:*`,
        'COUNT',
        100
      );
      cursor = newCursor;

      keys.forEach(key => {
        const parts = key.split(':');
        if (parts.length >= 3) {
          pairs.add(parts[1]);
          granularities.add(parts[2]);
        }
        keyCount++;
      });
    } while (cursor !== '0');

    return {
      totalKeys: keyCount,
      memoryUsage,
      pairs: Array.from(pairs),
      granularities: Array.from(granularities)
    };
  }
}

// Export singleton instance
export const redisCandleStorage = new RedisCandleStorage();