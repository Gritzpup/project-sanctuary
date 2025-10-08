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
    this.setupEventHandlers();
  }

  setupEventHandlers() {
    this.redis.on('connect', () => {
      console.log('✅ RedisCandleStorage: Connected to Redis on port 6379');
      this.isConnected = true;
    });

    this.redis.on('error', (error) => {
      console.error('❌ RedisCandleStorage: Redis connection error', error.message);
      this.isConnected = false;
    });

    this.redis.on('close', () => {
      console.warn('⚠️ RedisCandleStorage: Redis connection closed');
      this.isConnected = false;
    });
  }

  async connect() {
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    this.connectionPromise = this.redis.connect().then(() => {
      this.isConnected = true;
      console.log('✅ RedisCandleStorage: Redis candle storage initialized');
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
      // Acquire lock for this operation
      const lockAcquired = await this.redis.set(lockKey, '1', 'EX', 30, 'NX');
      if (!lockAcquired) {
        console.warn('⚠️ RedisCandleStorage: Could not acquire lock for storing candles', { pair, granularity });
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

      console.log('✅ RedisCandleStorage: Stored candles successfully', {
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
  async getCandles(pair, granularity, startTime, endTime) {
    if (!this.isConnected) {
      await this.connect();
    }

    const startDay = Math.floor(startTime / 86400) * 86400;
    const endDay = Math.floor(endTime / 86400) * 86400;
    
    const allCandles = [];
    
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
          // dataStr format is "timestamp:jsonData"
          const colonIndex = dataStr.indexOf(':');
          if (colonIndex === -1) {
            console.error('❌ RedisCandleStorage: Invalid data format (no colon):', dataStr);
            continue;
          }
          
          const candleJson = dataStr.substring(colonIndex + 1);
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
          console.error('❌ RedisCandleStorage: Error parsing candle data', error.message, dataStr);
        }
      }
    }

    // Sort by timestamp to ensure proper order
    allCandles.sort((a, b) => a.time - b.time);

    console.log('📊 RedisCandleStorage: Retrieved candles', {
      pair,
      granularity,
      requestedRange: { startTime, endTime },
      retrievedCount: allCandles.length
    });

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
    
    const metadata = {
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
      console.log(`📈 Populating historical data for ${pair} ${granularity} (last ${hours} hours)`);
      
      const now = Math.floor(Date.now() / 1000);
      const startTime = now - (hours * 3600); // Convert hours to seconds
      
      // Check if we already have recent data
      const existingCandles = await this.getCandles(pair, granularity, startTime, now);
      const granularitySeconds = {
        '1m': 60, '5m': 300, '15m': 900, '30m': 1800, '1h': 3600
      }[granularity] || 60;
      
      const expectedCandles = Math.floor((now - startTime) / granularitySeconds);
      const dataCompleteness = existingCandles.length / expectedCandles;
      
      console.log(`📊 Data completeness: ${existingCandles.length}/${expectedCandles} = ${(dataCompleteness * 100).toFixed(1)}%`);
      
      if (dataCompleteness < 0.8) { // Less than 80% complete
        console.log(`🔄 Fetching historical data from Coinbase API...`);
        
        // Fetch from Coinbase API
        const response = await fetch(`https://api.exchange.coinbase.com/products/${pair}/candles?start=${new Date(startTime * 1000).toISOString()}&end=${new Date(now * 1000).toISOString()}&granularity=${granularitySeconds}`);
        
        if (!response.ok) {
          throw new Error(`Coinbase API error: ${response.status}`);
        }
        
        const apiData = await response.json();
        console.log(`📥 Fetched ${apiData.length} candles from Coinbase API`);
        
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
          console.log(`✅ Stored ${candles.length} historical candles in Redis`);
        }
        
        return candles.length;
      } else {
        console.log(`✅ Historical data already complete (${(dataCompleteness * 100).toFixed(1)}%)`);
        return 0;
      }
      
    } catch (error) {
      console.error(`❌ Failed to populate historical data: ${error.message}`);
      return 0;
    }
  }

  /**
   * Get storage statistics
   */
  async getStorageStats() {
    const info = await this.redis.info('memory');
    const memoryMatch = info.match(/used_memory_human:(.+)/);
    const memoryUsage = memoryMatch ? memoryMatch[1].trim() : 'unknown';

    const keys = await this.redis.keys(`${CANDLE_STORAGE_CONFIG.keyPrefixes.candles}:*`);
    const pairs = new Set();
    const granularities = new Set();

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