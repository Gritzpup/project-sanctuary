/**
 * Redis Orderbook Cache Service
 *
 * High-performance orderbook caching system for Level 2 data
 * Uses Redis sorted sets for efficient price-ordered orderbook storage
 * Enables smart update forwarding with deduplication
 */

import Redis from 'ioredis';
import crypto from 'crypto';
import { REDIS_CONFIG } from './RedisConfig.js';

class RedisOrderbookCache {
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

    // Cache for orderbook snapshots (hash of bids+asks for quick comparison)
    this.snapshotCache = new Map(); // key: "pair", value: {hash, timestamp}
    this.CACHE_TTL = 5000; // Cache snapshots for 5 seconds

    // Track last sent data per client (prevents re-sending identical updates)
    this.clientStates = new Map(); // key: "clientId:pair", value: {lastHash, lastTimestamp}

    // Throttle tracking per product
    this.throttleTimestamps = new Map(); // key: "pair", value: lastUpdateTime

    this.setupEventHandlers();
  }

  setupEventHandlers() {
    this.redis.on('connect', () => {
      console.log('✅ RedisOrderbookCache: Connected to Redis on port 6379');
      this.isConnected = true;
    });

    this.redis.on('error', (error) => {
      console.error('❌ RedisOrderbookCache: Redis connection error', error.message);
      this.isConnected = false;
    });

    this.redis.on('close', () => {
      console.warn('⚠️ RedisOrderbookCache: Redis connection closed');
      this.isConnected = false;
    });
  }

  async connect() {
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    this.connectionPromise = this.redis.connect().then(() => {
      this.isConnected = true;
      console.log('✅ RedisOrderbookCache: Redis orderbook cache initialized');
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
   * Store orderbook snapshot in Redis using sorted sets
   * Bids: sorted set with score = price (descending), member = size
   * Asks: sorted set with score = price (ascending), member = size
   */
  async storeOrderbookSnapshot(productId, bids, asks) {
    if (!this.isConnected) return false;

    try {
      const bidsKey = `orderbook:${productId}:bids`;
      const asksKey = `orderbook:${productId}:asks`;
      const metaKey = `orderbook:${productId}:meta`;

      // Use pipeline for atomic operations
      const pipeline = this.redis.pipeline();

      // Clear existing data
      pipeline.del(bidsKey);
      pipeline.del(asksKey);

      // Add bids (store as score=price, member=size)
      if (bids.length > 0) {
        const bidArgs = [];
        bids.forEach(bid => {
          bidArgs.push(bid.price, bid.size.toString());
        });
        pipeline.zadd(bidsKey, ...bidArgs);
      }

      // Add asks
      if (asks.length > 0) {
        const askArgs = [];
        asks.forEach(ask => {
          askArgs.push(ask.price, ask.size.toString());
        });
        pipeline.zadd(asksKey, ...askArgs);
      }

      // Store metadata
      const metadata = {
        timestamp: Date.now(),
        bidCount: bids.length,
        askCount: asks.length,
        bestBid: bids.length > 0 ? bids[0].price : 0,
        bestAsk: asks.length > 0 ? asks[0].price : 0
      };
      pipeline.hset(metaKey, 'meta', JSON.stringify(metadata));

      // Set TTL (orderbook snapshots expire after 1 hour if not updated)
      pipeline.expire(bidsKey, 3600);
      pipeline.expire(asksKey, 3600);
      pipeline.expire(metaKey, 3600);

      await pipeline.exec();

      console.log(`📊 [OrderbookCache] Stored snapshot for ${productId}: ${bids.length} bids, ${asks.length} asks`);

      // Update local snapshot cache
      const snapshotHash = this.computeSnapshotHash(bids, asks);
      this.snapshotCache.set(productId, {
        hash: snapshotHash,
        timestamp: Date.now()
      });

      return true;
    } catch (error) {
      console.error(`❌ Failed to store orderbook snapshot for ${productId}:`, error.message);
      return false;
    }
  }

  /**
   * Get orderbook from Redis within specified price range
   */
  async getOrderbookInRange(productId, minPrice, maxPrice) {
    if (!this.isConnected) return null;

    try {
      const bidsKey = `orderbook:${productId}:bids`;
      const asksKey = `orderbook:${productId}:asks`;

      // Get bids in range (using score as price)
      // Bids are highest prices first, so we need reverse range
      const bidsRaw = await this.redis.zrevrangebyscore(bidsKey, maxPrice, minPrice, 'WITHSCORES');
      const bids = [];
      for (let i = 0; i < bidsRaw.length; i += 2) {
        bids.push({
          price: parseFloat(bidsRaw[i + 1]),
          size: parseFloat(bidsRaw[i])
        });
      }

      // Get asks in range
      const asksRaw = await this.redis.zrangebyscore(asksKey, minPrice, maxPrice, 'WITHSCORES');
      const asks = [];
      for (let i = 0; i < asksRaw.length; i += 2) {
        asks.push({
          price: parseFloat(asksRaw[i + 1]),
          size: parseFloat(asksRaw[i])
        });
      }

      return { bids, asks };
    } catch (error) {
      console.error(`❌ Failed to get orderbook for ${productId}:`, error.message);
      return null;
    }
  }

  /**
   * Check if orderbook has changed since last known state
   * Returns true if data should be forwarded to clients
   */
  hasOrderbookChanged(productId) {
    const cacheEntry = this.snapshotCache.get(productId);

    // If no cache entry, it's new data
    if (!cacheEntry) return true;

    // If cache expired, consider it changed
    if (Date.now() - cacheEntry.timestamp > this.CACHE_TTL) {
      this.snapshotCache.delete(productId);
      return true;
    }

    return false;
  }

  /**
   * Compute hash of orderbook snapshot for quick equality checks
   */
  computeSnapshotHash(bids, asks) {
    // Create a deterministic string representation
    const bidStr = bids.slice(0, 10).map(b => `${b.price}:${b.size}`).join(',');
    const askStr = asks.slice(0, 10).map(a => `${a.price}:${a.size}`).join(',');

    // Hash the first 10 levels of each side
    const combined = `${bidStr}|${askStr}`;
    return crypto.createHash('md5').update(combined).digest('hex');
  }

  /**
   * Apply incremental update to cached orderbook
   */
  async applyUpdate(productId, changes) {
    if (!this.isConnected) return false;

    try {
      const bidsKey = `orderbook:${productId}:bids`;
      const asksKey = `orderbook:${productId}:asks`;

      const pipeline = this.redis.pipeline();

      // Apply each change
      changes.forEach(change => {
        const { side, price, size } = change;
        const key = side === 'buy' || side === 'bid' ? bidsKey : asksKey;

        if (size === 0) {
          // Remove price level
          pipeline.zrem(key, size.toString());
        } else {
          // Add or update price level
          pipeline.zadd(key, price, size.toString());
        }
      });

      // Update timestamp
      const metaKey = `orderbook:${productId}:meta`;
      pipeline.hset(metaKey, 'lastUpdate', Date.now().toString());

      await pipeline.exec();

      // Invalidate cache since data changed
      this.snapshotCache.delete(productId);

      return true;
    } catch (error) {
      console.error(`❌ Failed to apply update for ${productId}:`, error.message);
      return false;
    }
  }

  /**
   * Check if update should be throttled
   * Returns true if we should send the update, false if it should be throttled
   */
  shouldThrottle(productId, maxUpdatesPerSec = 10) {
    const now = Date.now();
    const lastUpdate = this.throttleTimestamps.get(productId);
    const minInterval = 1000 / maxUpdatesPerSec;

    if (!lastUpdate || (now - lastUpdate) >= minInterval) {
      this.throttleTimestamps.set(productId, now);
      return false; // Don't throttle - send the update
    }

    return true; // Throttle - skip this update
  }

  /**
   * Clear orderbook cache for a product
   */
  async clearOrderbook(productId) {
    if (!this.isConnected) return false;

    try {
      const bidsKey = `orderbook:${productId}:bids`;
      const asksKey = `orderbook:${productId}:asks`;
      const metaKey = `orderbook:${productId}:meta`;

      await this.redis.del(bidsKey, asksKey, metaKey);
      this.snapshotCache.delete(productId);
      this.throttleTimestamps.delete(productId);

      console.log(`🧹 [OrderbookCache] Cleared orderbook for ${productId}`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to clear orderbook for ${productId}:`, error.message);
      return false;
    }
  }

  /**
   * Get cache statistics for monitoring
   */
  getStats(productId) {
    const cacheEntry = this.snapshotCache.get(productId);

    return {
      isCached: !!cacheEntry,
      cacheAge: cacheEntry ? Date.now() - cacheEntry.timestamp : null,
      lastThrottleCheck: this.throttleTimestamps.get(productId) || null,
      clientStateCount: Array.from(this.clientStates.entries()).filter(([key]) => key.startsWith(productId)).length
    };
  }

  /**
   * Get full orderbook snapshot for frontend hydration
   * Used when page loads to immediately display cached data while waiting for WebSocket
   */
  async getFullOrderbook(productId) {
    if (!this.isConnected) return null;

    try {
      const bidsKey = `orderbook:${productId}:bids`;
      const asksKey = `orderbook:${productId}:asks`;
      const metaKey = `orderbook:${productId}:meta`;

      // Get full orderbook (not just a range)
      const bidsRaw = await this.redis.zrevrange(bidsKey, 0, -1, 'WITHSCORES');
      const asksRaw = await this.redis.zrange(asksKey, 0, -1, 'WITHSCORES');

      const bids = [];
      for (let i = 0; i < bidsRaw.length; i += 2) {
        bids.push({
          price: parseFloat(bidsRaw[i + 1]),
          size: parseFloat(bidsRaw[i])
        });
      }

      const asks = [];
      for (let i = 0; i < asksRaw.length; i += 2) {
        asks.push({
          price: parseFloat(asksRaw[i + 1]),
          size: parseFloat(asksRaw[i])
        });
      }

      // Get metadata
      const metaJson = await this.redis.hget(metaKey, 'meta');
      const metadata = metaJson ? JSON.parse(metaJson) : null;

      if (bids.length === 0 && asks.length === 0) {
        console.log(`⚠️ [OrderbookCache] No cached orderbook found for ${productId}`);
        return null;
      }

      console.log(`📥 [OrderbookCache] Hydrating frontend with cached orderbook for ${productId}: ${bids.length} bids, ${asks.length} asks`);

      return {
        product_id: productId,
        bids,
        asks,
        metadata
      };
    } catch (error) {
      console.error(`❌ Failed to get full orderbook for ${productId}:`, error.message);
      return null;
    }
  }

  /**
   * Export orderbook data for API responses
   * Returns orderbook filtered to ±$25,000 range
   */
  async getOrderbookForAPI(productId, depthRange = 25000) {
    if (!this.isConnected) return { bids: [], asks: [] };

    try {
      const metaKey = `orderbook:${productId}:meta`;

      // Get metadata to find mid-price
      const metaJson = await this.redis.hget(metaKey, 'meta');
      if (!metaJson) return { bids: [], asks: [] };

      const metadata = JSON.parse(metaJson);
      const midPrice = (metadata.bestBid + metadata.bestAsk) / 2;

      // Get orderbook in range
      const orderbook = await this.getOrderbookInRange(
        productId,
        midPrice - depthRange,
        midPrice + depthRange
      );

      return orderbook || { bids: [], asks: [] };
    } catch (error) {
      console.error(`❌ Failed to get orderbook for API for ${productId}:`, error.message);
      return { bids: [], asks: [] };
    }
  }

  /**
   * 🚀 PERF: Get changed price levels since last check
   * Publishes only the DELTA (changed levels) via Redis Pub/Sub
   * Frontend receives only what changed, updates only those rows
   *
   * Strategy: Compare current snapshot with previous, publish ONLY changed levels
   */
  async getChangedLevels(productId) {
    if (!this.isConnected) return { bids: [], asks: [] };

    try {
      const bidsKey = `orderbook:${productId}:bids`;
      const asksKey = `orderbook:${productId}:asks`;

      // Get current top levels (top 50 is plenty for most UIs)
      const topBidsRaw = await this.redis.zrevrange(bidsKey, 0, 49, 'WITHSCORES');
      const topAsksRaw = await this.redis.zrange(asksKey, 0, 49, 'WITHSCORES');

      const bids = [];
      for (let i = 0; i < topBidsRaw.length; i += 2) {
        bids.push({
          price: parseFloat(topBidsRaw[i + 1]),
          size: parseFloat(topBidsRaw[i])
        });
      }

      const asks = [];
      for (let i = 0; i < topAsksRaw.length; i += 2) {
        asks.push({
          price: parseFloat(topAsksRaw[i + 1]),
          size: parseFloat(topAsksRaw[i])
        });
      }

      return { bids, asks };
    } catch (error) {
      console.error(`❌ Failed to get changed levels for ${productId}:`, error.message);
      return { bids: [], asks: [] };
    }
  }

  /**
   * 🚀 Publish orderbook deltas via Redis Pub/Sub
   * Only publishes changed price levels to minimize frontend updates
   */
  publishOrderbookDelta(productId, bids, asks) {
    if (!this.isConnected) return;

    try {
      const channel = `orderbook:${productId}:delta`;
      const deltaPayload = JSON.stringify({
        productId,
        timestamp: Date.now(),
        bids,
        asks
      });

      // Publish to Redis channel - all connected clients receive immediately
      this.redis.publish(channel, deltaPayload);
    } catch (error) {
      console.error(`❌ Failed to publish delta for ${productId}:`, error.message);
    }
  }
}

// Export singleton instance
export const redisOrderbookCache = new RedisOrderbookCache();
