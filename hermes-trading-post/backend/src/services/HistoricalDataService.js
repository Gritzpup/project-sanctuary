/**
 * Historical Data Service
 * Fetches large amounts of historical candle data from Coinbase and stores in Redis
 */

import { coinbaseAPI } from './CoinbaseAPIService.js';
import { redisCandleStorage } from './redis/RedisCandleStorage.js';

export class HistoricalDataService {
  constructor() {
    this.isRunning = false;
    this.fetchQueue = [];
    this.stats = {
      totalCandles: 0,
      totalRequests: 0,
      errors: 0,
      startTime: null
    };
  }

  /**
   * Convert granularity string to seconds
   */
  granularityToSeconds(granularity) {
    const map = {
      '1m': 60,
      '5m': 300,
      '15m': 900,
      '30m': 1800,
      '1h': 3600,
      '4h': 14400,
      '6h': 21600,
      '12h': 43200,
      '1d': 86400,
      '1w': 604800
    };
    return map[granularity] || 60;
  }

  /**
   * Fetch historical data for a specific time range
   */
  async fetchHistoricalData(pair, granularity, daysBack = 30) {

    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    this.stats = {
      totalCandles: 0,
      totalRequests: 0,
      errors: 0,
      startTime: Date.now()
    };



    try {
      const granularitySeconds = this.granularityToSeconds(granularity);
      const now = Math.floor(Date.now() / 1000);
      const startTime = now - (daysBack * 24 * 60 * 60);

      // Use CoinbaseAPIService paginated fetch (handles Advanced Trade + Exchange API fallback)
      try {
        const candles = await coinbaseAPI.getCandlesPaginated(
          pair, granularitySeconds, startTime.toString(), now.toString()
        );

        if (candles.length > 0) {
          await redisCandleStorage.storeCandles(pair, granularity, candles);
          this.stats.totalCandles += candles.length;
        }

        this.stats.totalRequests++;
      } catch (error) {
        this.stats.errors++;
        console.error(`[HistoricalData] Paginated fetch failed for ${pair} ${granularity}: ${error.message}`);
      }

      const duration = (Date.now() - this.stats.startTime) / 1000;
    } catch (error) {
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Quick fetch to fill recent gaps
   */
  async fillRecentGaps(pair, granularity, hoursBack = 24) {

    const granularitySeconds = this.granularityToSeconds(granularity);
    const now = Math.floor(Date.now() / 1000);
    
    // Respect Coinbase API limits: max 300 candles per request
    const maxCandles = 300;
    const maxHours = Math.floor((maxCandles * granularitySeconds) / 3600);
    const requestHours = Math.min(hoursBack, maxHours);
    
    
    const startTime = now - (requestHours * 60 * 60);

    try {
      const candles = await coinbaseAPI.getCandles(
        pair, granularitySeconds, startTime.toString(), now.toString()
      );

      if (candles.length > 0) {
        await redisCandleStorage.storeCandles(pair, granularity, candles);
      }

      return candles.length;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Get current fetch status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      stats: this.stats,
      queueLength: this.fetchQueue.length
    };
  }

  /**
   * Initialize with default data fetch
   */
  async initialize(pair = 'BTC-USD', granularity = '1m') {

    // Test API connection first
    const connected = await coinbaseAPI.testConnection();
    if (!connected) {
      return false;
    }

    // Check if we need initial data
    try {
      const metadata = await redisCandleStorage.getMetadata(pair, granularity);
      const candleCount = metadata?.totalCandles || 0;

      // Use retention-appropriate history depth per granularity
      // 1d needs 1825 days (5 years) for 5Y timeframe support
      // 6h needs 30 days, smaller granularities need 7 days
      const daysBackMap = { '1m': 7, '5m': 7, '15m': 7, '1h': 7, '6h': 30, '1d': 1825 };
      const daysBack = daysBackMap[granularity] || 7;

      if (candleCount < 1000) {
        await this.fetchHistoricalData(pair, granularity, daysBack);
      } else {
        await this.fillRecentGaps(pair, granularity, 6);
      }

      return true;
    } catch (error) {
      return false;
    }
  }
}

// Export singleton instance
export const historicalDataService = new HistoricalDataService();