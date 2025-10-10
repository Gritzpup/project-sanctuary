/**
 * Continuous Candle Updater Service
 * Periodically fetches fresh candle data from Coinbase API and updates Redis
 * This ensures the database is constantly updated with the latest candle data
 */

import { coinbaseAPI } from './CoinbaseAPIService.js';
import { redisCandleStorage } from './redis/RedisCandleStorage.js';
import { EventEmitter } from 'events';

export class ContinuousCandleUpdater extends EventEmitter {
  constructor() {
    super();
    this.intervals = new Map(); // key: "pair:granularity", value: intervalId
    this.isRunning = false;
    this.updateFrequency = 5000; // 5 seconds default
    this.stats = {
      totalFetches: 0,
      totalCandles: 0,
      errors: 0,
      lastUpdate: null,
      activePairs: new Set()
    };
  }

  /**
   * Start continuous updates for a pair and granularity
   */
  startUpdates(pair, granularity, frequencyMs = 5000) {
    const key = `${pair}:${granularity}`;

    // Don't start if already running
    if (this.intervals.has(key)) {
      console.log(`⚠️ Already updating ${key}`);
      return;
    }

    console.log(`🚀 Starting continuous candle updates for ${key} every ${frequencyMs}ms`);

    // Do an initial fetch immediately
    this.fetchLatestCandles(pair, granularity);

    // Set up the interval for continuous updates
    const intervalId = setInterval(async () => {
      await this.fetchLatestCandles(pair, granularity);
    }, frequencyMs);

    this.intervals.set(key, intervalId);
    this.stats.activePairs.add(key);
    this.isRunning = true;

    // Emit status update
    this.emit('status_update', {
      type: 'started',
      pair,
      granularity,
      activePairs: Array.from(this.stats.activePairs)
    });
  }

  /**
   * Stop updates for a specific pair and granularity
   */
  stopUpdates(pair, granularity) {
    const key = `${pair}:${granularity}`;
    const intervalId = this.intervals.get(key);

    if (intervalId) {
      clearInterval(intervalId);
      this.intervals.delete(key);
      this.stats.activePairs.delete(key);

      console.log(`⏹️ Stopped updates for ${key}`);

      this.emit('status_update', {
        type: 'stopped',
        pair,
        granularity,
        activePairs: Array.from(this.stats.activePairs)
      });
    }

    if (this.intervals.size === 0) {
      this.isRunning = false;
    }
  }

  /**
   * Get retention period for each granularity (in seconds)
   * Strategy: Store high frequency for recent data, low frequency for historical
   */
  getRetentionPeriod(granularity) {
    const retentionDays = {
      '1m': 7,      // Last week - high detail for recent trading
      '5m': 30,     // Last month - medium detail for recent trends
      '15m': 90,    // Last 3 months - pattern analysis
      '1h': 365,    // Last year - yearly trends
      '6h': 1825,   // 5 years - long-term macro trends
      '1d': 3650    // 10 years - maximum historical view
    };

    return (retentionDays[granularity] || 30) * 86400; // Convert days to seconds
  }

  /**
   * Fetch the latest candles for a pair
   */
  async fetchLatestCandles(pair, granularity) {
    try {
      const granularitySeconds = coinbaseAPI.granularityToSeconds(granularity);
      const now = Math.floor(Date.now() / 1000);

      // Fetch last 20 candles to ensure we have the latest data
      // This helps fill any small gaps from WebSocket disconnections
      const lookbackCandles = 20;
      const lookbackSeconds = lookbackCandles * granularitySeconds;
      const startTime = now - lookbackSeconds;

      const start = new Date(startTime * 1000).toISOString();
      const end = new Date(now * 1000).toISOString();

      console.log(`🔄 [CandleUpdater] Fetching ${pair} ${granularity} candles...`);

      // Emit database activity event
      this.emit('database_activity', {
        type: 'fetch_start',
        pair,
        granularity,
        operation: 'API_FETCH'
      });

      const candles = await coinbaseAPI.getCandles(pair, granularitySeconds, start, end);

      if (candles && candles.length > 0) {
        // Store in Redis
        await redisCandleStorage.storeCandles(pair, granularity, candles);

        this.stats.totalFetches++;
        this.stats.totalCandles += candles.length;
        this.stats.lastUpdate = Date.now();

        console.log(`✅ [CandleUpdater] Stored ${candles.length} ${pair} ${granularity} candles`);
        console.log(`📊 [CandleUpdater] Latest price: $${candles[candles.length - 1].close} at ${new Date(candles[candles.length - 1].time * 1000).toLocaleTimeString()}`);

        // Clean up old data based on retention policy
        await this.cleanupOldData(pair, granularity);

        // Emit database activity event
        this.emit('database_activity', {
          type: 'store_complete',
          pair,
          granularity,
          candleCount: candles.length,
          operation: 'REDIS_STORE',
          latestPrice: candles[candles.length - 1].close
        });

        // Emit candle update event for any listeners
        this.emit('candles_updated', {
          pair,
          granularity,
          candleCount: candles.length,
          latestCandle: candles[candles.length - 1]
        });
      } else {
        console.log(`⚠️ [CandleUpdater] No candles returned for ${pair} ${granularity}`);
      }

    } catch (error) {
      console.error(`❌ [CandleUpdater] Error fetching ${pair} ${granularity}:`, error.message);
      this.stats.errors++;

      // Emit error event
      this.emit('database_activity', {
        type: 'error',
        pair,
        granularity,
        error: error.message,
        operation: 'API_ERROR'
      });
    }
  }

  /**
   * Clean up old data beyond retention period
   */
  async cleanupOldData(pair, granularity) {
    try {
      const now = Math.floor(Date.now() / 1000);
      const retentionPeriod = this.getRetentionPeriod(granularity);
      const cutoffTime = now - retentionPeriod;

      console.log(`🧹 [CandleUpdater] Cleaning ${pair} ${granularity} data older than ${new Date(cutoffTime * 1000).toISOString()}`);

      // Get metadata to see how much data we have
      const metadata = await redisCandleStorage.getMetadata(pair, granularity);

      if (!metadata) {
        return; // No metadata, nothing to clean
      }

      // Only clean if we have data older than the retention period
      if (metadata.firstTimestamp < cutoffTime) {
        const deletedCount = await redisCandleStorage.deleteOldCandles(pair, granularity, cutoffTime);

        if (deletedCount > 0) {
          console.log(`🗑️ [CandleUpdater] Deleted ${deletedCount} old ${granularity} candles for ${pair}`);
        }
      }
    } catch (error) {
      console.error(`❌ [CandleUpdater] Error cleaning old data for ${pair} ${granularity}:`, error.message);
    }
  }

  /**
   * Start updates for all common granularities for a pair
   */
  startAllGranularities(pair = 'BTC-USD') {
    const granularities = ['1m', '5m', '15m', '1h', '6h', '1d'];
    const updateIntervals = {
      '1m': 5000,   // Every 5 seconds for 1m
      '5m': 15000,  // Every 15 seconds for 5m
      '15m': 30000, // Every 30 seconds for 15m
      '1h': 60000,  // Every 60 seconds for 1h
      '6h': 300000, // Every 5 minutes for 6h
      '1d': 600000  // Every 10 minutes for 1d
    };

    console.log(`🚀 [CandleUpdater] Starting continuous updates for ALL ${pair} granularities`);

    for (const granularity of granularities) {
      this.startUpdates(pair, granularity, updateIntervals[granularity]);
    }
  }

  /**
   * Stop all updates
   */
  stopAll() {
    console.log(`⏹️ [CandleUpdater] Stopping all candle updates`);

    this.intervals.forEach((intervalId, key) => {
      clearInterval(intervalId);
      console.log(`⏹️ Stopped ${key}`);
    });

    this.intervals.clear();
    this.stats.activePairs.clear();
    this.isRunning = false;

    this.emit('status_update', {
      type: 'all_stopped',
      activePairs: []
    });
  }

  /**
   * Get current status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      activePairs: Array.from(this.stats.activePairs),
      stats: {
        ...this.stats,
        activePairs: Array.from(this.stats.activePairs)
      }
    };
  }

  /**
   * Get stats
   */
  getStats() {
    return {
      ...this.stats,
      uptime: this.stats.lastUpdate ? Date.now() - this.stats.lastUpdate : 0,
      avgCandlesPerFetch: this.stats.totalFetches > 0 ? Math.round(this.stats.totalCandles / this.stats.totalFetches) : 0
    };
  }
}

// Export singleton instance
export const continuousCandleUpdater = new ContinuousCandleUpdater();