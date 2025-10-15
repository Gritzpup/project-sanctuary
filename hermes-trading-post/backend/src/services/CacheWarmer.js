/**
 * Cache Warmer Service
 *
 * Pre-populates Redis cache with commonly accessed chart data.
 * Ensures backend always has hot caches for popular timeframes.
 *
 * Strategy:
 * 1. On startup: Pre-cache last 24 hours of 1m/5m/15m data
 * 2. Every 5 minutes: Refresh recent data and aggregate
 * 3. Every hour: Pre-cache popular timeframes (1H, 4H, 1D, 1W)
 * 4. Cleanup old data beyond retention period
 */

const logger = require('../utils/logger');

class CacheWarmer {
  constructor(redisCandleStorage, coinbaseAPI) {
    this.candleStorage = redisCandleStorage;
    this.coinbaseAPI = coinbaseAPI;
    this.warmupInterval = null;
    this.aggregationInterval = null;
    this.isWarming = false;

    // Configuration
    this.config = {
      pairs: ['BTC-USD'], // Add more pairs as needed
      baseGranularities: ['1m', '5m', '15m'], // Base granularities to fetch
      aggregatedGranularities: ['30m', '1h', '4h', '6h', '12h', '1d'], // Derived from base
      warmupIntervalMs: 5 * 60 * 1000, // 5 minutes
      aggregationIntervalMs: 15 * 60 * 1000, // 15 minutes
      initialWarmupPeriod: 24 * 60 * 60, // 24 hours in seconds
      retentionPeriods: {
        '1m': 7 * 24 * 60 * 60, // 7 days
        '5m': 30 * 24 * 60 * 60, // 30 days
        '15m': 60 * 24 * 60 * 60, // 60 days
        '30m': 90 * 24 * 60 * 60, // 90 days
        '1h': 180 * 24 * 60 * 60, // 180 days
        '4h': 365 * 24 * 60 * 60, // 1 year
        '6h': 365 * 24 * 60 * 60, // 1 year
        '12h': 365 * 24 * 60 * 60, // 1 year
        '1d': 5 * 365 * 24 * 60 * 60 // 5 years
      }
    };
  }

  /**
   * Start cache warming service
   */
  async start() {
    try {
      logger.info('[CacheWarmer] Starting cache warming service...');

      // Initial warmup
      await this.performInitialWarmup();

      // Schedule periodic warmup
      this.warmupInterval = setInterval(() => {
        this.performPeriodicWarmup();
      }, this.config.warmupIntervalMs);

      // Schedule periodic aggregation
      this.aggregationInterval = setInterval(() => {
        this.performAggregation();
      }, this.config.aggregationIntervalMs);

      logger.info('[CacheWarmer] ✅ Cache warming service started');
    } catch (error) {
      logger.error('[CacheWarmer] Failed to start cache warming service:', error);
    }
  }

  /**
   * Stop cache warming service
   */
  stop() {
    if (this.warmupInterval) {
      clearInterval(this.warmupInterval);
      this.warmupInterval = null;
    }

    if (this.aggregationInterval) {
      clearInterval(this.aggregationInterval);
      this.aggregationInterval = null;
    }

    logger.info('[CacheWarmer] Cache warming service stopped');
  }

  /**
   * Initial warmup on service start
   */
  async performInitialWarmup() {
    if (this.isWarming) {
      logger.warn('[CacheWarmer] Warmup already in progress, skipping');
      return;
    }

    this.isWarming = true;
    logger.info('[CacheWarmer] 🔥 Starting initial cache warmup...');

    try {
      const endTime = Math.floor(Date.now() / 1000);
      const startTime = endTime - this.config.initialWarmupPeriod;

      for (const pair of this.config.pairs) {
        for (const granularity of this.config.baseGranularities) {
          await this.warmupGranularity(pair, granularity, startTime, endTime);
        }
      }

      // Aggregate to other timeframes
      await this.performAggregation();

      logger.info('[CacheWarmer] ✅ Initial warmup complete');
    } catch (error) {
      logger.error('[CacheWarmer] Initial warmup failed:', error);
    } finally {
      this.isWarming = false;
    }
  }

  /**
   * Periodic warmup (every 5 minutes)
   * Fetches recent data to keep cache hot
   */
  async performPeriodicWarmup() {
    if (this.isWarming) {
      return;
    }

    this.isWarming = true;

    try {
      const endTime = Math.floor(Date.now() / 1000);
      const startTime = endTime - (10 * 60); // Last 10 minutes

      for (const pair of this.config.pairs) {
        // Only warm up base granularities (others will be aggregated)
        for (const granularity of this.config.baseGranularities) {
          await this.warmupGranularity(pair, granularity, startTime, endTime);
        }
      }

      logger.debug('[CacheWarmer] Periodic warmup complete');
    } catch (error) {
      logger.error('[CacheWarmer] Periodic warmup failed:', error);
    } finally {
      this.isWarming = false;
    }
  }

  /**
   * Warm up specific granularity
   */
  async warmupGranularity(pair, granularity, startTime, endTime) {
    try {
      // Check if already cached
      const metadata = await this.candleStorage.getMetadata(pair, granularity);

      if (metadata && metadata.lastTimestamp >= (endTime - 60)) {
        // Cache is up to date
        logger.debug(`[CacheWarmer] ${pair}:${granularity} already up to date`);
        return;
      }

      // Fetch from Coinbase
      const granularitySeconds = this.getGranularitySeconds(granularity);
      const candles = await this.coinbaseAPI.getCandles(
        pair,
        granularitySeconds,
        startTime.toString(),
        endTime.toString()
      );

      if (candles.length > 0) {
        // Store in Redis
        await this.candleStorage.storeCandles(pair, granularity, candles);
        logger.info(`[CacheWarmer] ✅ Warmed ${pair}:${granularity} - ${candles.length} candles`);
      }
    } catch (error) {
      logger.error(`[CacheWarmer] Failed to warm ${pair}:${granularity}:`, error);
    }
  }

  /**
   * Perform aggregation to create higher timeframes
   */
  async performAggregation() {
    try {
      logger.debug('[CacheWarmer] Starting aggregation...');

      for (const pair of this.config.pairs) {
        // Get base data (1m is most granular)
        const endTime = Math.floor(Date.now() / 1000);
        const startTime = endTime - (24 * 60 * 60); // Last 24 hours

        const baseCandles = await this.candleStorage.getCandles(pair, '1m', startTime, endTime);

        if (baseCandles.length === 0) {
          logger.warn(`[CacheWarmer] No base candles found for ${pair}, skipping aggregation`);
          continue;
        }

        // Aggregate to all other timeframes
        for (const granularity of this.config.aggregatedGranularities) {
          await this.aggregateAndStore(pair, granularity, baseCandles);
        }
      }

      logger.debug('[CacheWarmer] Aggregation complete');
    } catch (error) {
      logger.error('[CacheWarmer] Aggregation failed:', error);
    }
  }

  /**
   * Aggregate candles and store
   */
  async aggregateAndStore(pair, targetGranularity, sourceCandles) {
    try {
      const targetSeconds = this.getGranularitySeconds(targetGranularity);
      const aggregated = this.aggregateCandles(sourceCandles, targetSeconds);

      if (aggregated.length > 0) {
        await this.candleStorage.storeCandles(pair, targetGranularity, aggregated);
        logger.debug(`[CacheWarmer] Aggregated ${pair}:${targetGranularity} - ${aggregated.length} candles`);
      }
    } catch (error) {
      logger.error(`[CacheWarmer] Failed to aggregate ${pair}:${targetGranularity}:`, error);
    }
  }

  /**
   * Aggregate candles to target granularity
   */
  aggregateCandles(candles, targetSeconds) {
    const aggregated = new Map();

    candles.forEach(candle => {
      const periodStart = Math.floor(candle.time / targetSeconds) * targetSeconds;

      if (!aggregated.has(periodStart)) {
        aggregated.set(periodStart, {
          time: periodStart,
          open: candle.open,
          high: candle.high,
          low: candle.low,
          close: candle.close,
          volume: candle.volume || 0
        });
      } else {
        const existing = aggregated.get(periodStart);
        existing.high = Math.max(existing.high, candle.high);
        existing.low = Math.min(existing.low, candle.low);
        existing.close = candle.close; // Last close
        existing.volume += (candle.volume || 0);
      }
    });

    return Array.from(aggregated.values()).sort((a, b) => a.time - b.time);
  }

  /**
   * Cleanup old data beyond retention period
   */
  async performCleanup() {
    try {
      logger.info('[CacheWarmer] Starting cleanup...');

      for (const pair of this.config.pairs) {
        for (const granularity in this.config.retentionPeriods) {
          const retentionSeconds = this.config.retentionPeriods[granularity];
          const cutoffTime = Math.floor(Date.now() / 1000) - retentionSeconds;

          await this.candleStorage.cleanupOldData(pair, granularity, cutoffTime);
          logger.debug(`[CacheWarmer] Cleaned up ${pair}:${granularity} before ${new Date(cutoffTime * 1000).toISOString()}`);
        }
      }

      logger.info('[CacheWarmer] Cleanup complete');
    } catch (error) {
      logger.error('[CacheWarmer] Cleanup failed:', error);
    }
  }

  /**
   * Get granularity in seconds
   */
  getGranularitySeconds(granularity) {
    const map = {
      '1m': 60,
      '5m': 300,
      '15m': 900,
      '30m': 1800,
      '1h': 3600,
      '4h': 14400,
      '6h': 21600,
      '12h': 43200,
      '1d': 86400
    };

    return map[granularity] || 60;
  }

  /**
   * Get cache statistics
   */
  async getStats() {
    const stats = {
      pairs: this.config.pairs,
      granularities: [...this.config.baseGranularities, ...this.config.aggregatedGranularities],
      isWarming: this.isWarming,
      cacheStatus: {}
    };

    for (const pair of this.config.pairs) {
      stats.cacheStatus[pair] = {};

      for (const granularity of [...this.config.baseGranularities, ...this.config.aggregatedGranularities]) {
        const metadata = await this.candleStorage.getMetadata(pair, granularity);
        stats.cacheStatus[pair][granularity] = metadata || { count: 0, lastTimestamp: null };
      }
    }

    return stats;
  }
}

module.exports = CacheWarmer;
