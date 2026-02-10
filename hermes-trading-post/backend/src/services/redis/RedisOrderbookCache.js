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

    // ⚡ PERF: Cache size limits to prevent memory leaks
    this.MAX_SNAPSHOT_CACHE_SIZE = 50;    // Max 50 pairs cached
    this.MAX_CLIENT_STATES_SIZE = 1000;   // Max 1000 client:pair combinations
    this.MAX_THROTTLE_ENTRIES = 100;       // Max 100 products tracked

    // ⚡ PERF: Periodic cache cleanup interval
    this.cacheCleanupInterval = setInterval(() => {
      this.pruneExpiredCaches();
    }, 60000); // Every 60 seconds

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
    // ⚡ PERF: Clear cleanup interval to prevent memory leak
    if (this.cacheCleanupInterval) {
      clearInterval(this.cacheCleanupInterval);
      this.cacheCleanupInterval = null;
    }

    // Clear all in-memory caches
    this.snapshotCache.clear();
    this.clientStates.clear();
    this.throttleTimestamps.clear();

    if (this.redis) {
      await this.redis.quit();
      this.isConnected = false;
    }
  }

  /**
   * ⚡ PERF: Prune expired cache entries and enforce size limits
   * Called periodically to prevent unbounded memory growth
   */
  pruneExpiredCaches() {
    const now = Date.now();

    // 1. Prune expired snapshot cache entries
    for (const [key, value] of this.snapshotCache.entries()) {
      if (now - value.timestamp > this.CACHE_TTL) {
        this.snapshotCache.delete(key);
      }
    }

    // Enforce max size for snapshot cache (keep most recent)
    if (this.snapshotCache.size > this.MAX_SNAPSHOT_CACHE_SIZE) {
      const entries = Array.from(this.snapshotCache.entries())
        .sort((a, b) => b[1].timestamp - a[1].timestamp);
      this.snapshotCache = new Map(entries.slice(0, this.MAX_SNAPSHOT_CACHE_SIZE));
    }

    // 2. Prune client states older than 5 minutes
    const CLIENT_STATE_TTL = 5 * 60 * 1000; // 5 minutes
    for (const [key, value] of this.clientStates.entries()) {
      if (value.lastTimestamp && (now - value.lastTimestamp) > CLIENT_STATE_TTL) {
        this.clientStates.delete(key);
      }
    }

    // Enforce max size for client states (keep most recent)
    if (this.clientStates.size > this.MAX_CLIENT_STATES_SIZE) {
      const entries = Array.from(this.clientStates.entries())
        .sort((a, b) => (b[1].lastTimestamp || 0) - (a[1].lastTimestamp || 0));
      this.clientStates = new Map(entries.slice(0, this.MAX_CLIENT_STATES_SIZE));
    }

    // 3. Prune old throttle timestamps (older than 10 seconds)
    const THROTTLE_TTL = 10000; // 10 seconds
    for (const [key, timestamp] of this.throttleTimestamps.entries()) {
      if (now - timestamp > THROTTLE_TTL) {
        this.throttleTimestamps.delete(key);
      }
    }

    // Enforce max size for throttle timestamps
    if (this.throttleTimestamps.size > this.MAX_THROTTLE_ENTRIES) {
      const entries = Array.from(this.throttleTimestamps.entries())
        .sort((a, b) => b[1] - a[1]);
      this.throttleTimestamps = new Map(entries.slice(0, this.MAX_THROTTLE_ENTRIES));
    }
  }

  /**
   * Parse Redis hash data into sorted orderbook levels
   * @param {Object} hashData - Raw hash data from HGETALL {priceStr: sizeStr, ...}
   * @param {boolean} descending - Sort descending (true for bids, false for asks)
   * @returns {Array<{price: number, size: number}>}
   */
  _parseHashToLevels(hashData, descending = false) {
    const levels = [];
    for (const [priceStr, sizeStr] of Object.entries(hashData)) {
      const price = parseFloat(priceStr);
      const size = parseFloat(sizeStr);
      if (!isNaN(price) && !isNaN(size) && size > 0) {
        levels.push({ price, size });
      }
    }
    levels.sort((a, b) => descending ? b.price - a.price : a.price - b.price);
    return levels;
  }

  /**
   * Store orderbook snapshot in Redis using hashes
   * Each side is a hash: key=price, value=size (unique per price level)
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

      // Add bids as hash entries (key=price, value=size)
      if (bids.length > 0) {
        const bidHash = {};
        bids.forEach(bid => {
          bidHash[bid.price.toString()] = bid.size.toString();
        });
        pipeline.hset(bidsKey, bidHash);
      }

      // Add asks as hash entries (key=price, value=size)
      if (asks.length > 0) {
        const askHash = {};
        asks.forEach(ask => {
          askHash[ask.price.toString()] = ask.size.toString();
        });
        pipeline.hset(asksKey, askHash);
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


      // Update local snapshot cache
      const snapshotHash = this.computeSnapshotHash(bids, asks);
      this.snapshotCache.set(productId, {
        hash: snapshotHash,
        timestamp: Date.now()
      });

      return true;
    } catch (error) {
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

      // Get all levels from hashes, then filter and sort in memory
      const [bidsRaw, asksRaw] = await Promise.all([
        this.redis.hgetall(bidsKey),
        this.redis.hgetall(asksKey)
      ]);

      // Parse, filter to range, sort (bids descending, asks ascending)
      const allBids = this._parseHashToLevels(bidsRaw || {}, true);
      const allAsks = this._parseHashToLevels(asksRaw || {}, false);

      const bids = allBids.filter(b => b.price >= minPrice && b.price <= maxPrice);
      const asks = allAsks.filter(a => a.price >= minPrice && a.price <= maxPrice);

      return { bids, asks };
    } catch (error) {
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

      // Apply each change using hash operations
      changes.forEach(change => {
        const { side, price, size } = change;
        const key = side === 'buy' || side === 'bid' ? bidsKey : asksKey;
        const priceStr = price.toString();

        if (size === 0) {
          // Remove price level by price key
          pipeline.hdel(key, priceStr);
        } else {
          // Add or update price level
          pipeline.hset(key, priceStr, size.toString());
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

      return true;
    } catch (error) {
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

      // Get all levels from hashes
      const [bidsRaw, asksRaw, metaJson] = await Promise.all([
        this.redis.hgetall(bidsKey),
        this.redis.hgetall(asksKey),
        this.redis.hget(metaKey, 'meta')
      ]);

      // Parse and sort: bids descending, asks ascending
      const bids = this._parseHashToLevels(bidsRaw || {}, true);
      const asks = this._parseHashToLevels(asksRaw || {}, false);

      const metadata = metaJson ? JSON.parse(metaJson) : null;

      if (bids.length === 0 && asks.length === 0) {
        return null;
      }


      return {
        product_id: productId,
        bids,
        asks,
        metadata
      };
    } catch (error) {
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
      return { bids: [], asks: [] };
    }
  }

  /**
   * Get top N bids and asks for depth chart hydration
   * Returns only the best N price levels on each side
   */
  async getTopOrders(productId, count = 12) {
    if (!this.isConnected) return { bids: [], asks: [] };

    try {
      const bidsKey = `orderbook:${productId}:bids`;
      const asksKey = `orderbook:${productId}:asks`;

      // Get all levels from hashes, sort, and take top N
      const [bidsRaw, asksRaw] = await Promise.all([
        this.redis.hgetall(bidsKey),
        this.redis.hgetall(asksKey)
      ]);

      // Parse and sort: bids descending (best=highest), asks ascending (best=lowest)
      const bids = this._parseHashToLevels(bidsRaw || {}, true).slice(0, count);
      const asks = this._parseHashToLevels(asksRaw || {}, false).slice(0, count);

      return { bids, asks };
    } catch (error) {
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

      // Get all levels from hashes, sort, and take top 50
      const [bidsRaw, asksRaw] = await Promise.all([
        this.redis.hgetall(bidsKey),
        this.redis.hgetall(asksKey)
      ]);

      const bids = this._parseHashToLevels(bidsRaw || {}, true).slice(0, 50);
      const asks = this._parseHashToLevels(asksRaw || {}, false).slice(0, 50);

      return { bids, asks };
    } catch (error) {
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
    }
  }
}

// Export singleton instance
export const redisOrderbookCache = new RedisOrderbookCache();
