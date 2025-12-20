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
      const startTime = now - (daysBack * 24 * 60 * 60); // Go back X days

      // Coinbase API limit is 300 candles per request
      const maxCandlesPerRequest = 300;
      const timeSpanPerRequest = maxCandlesPerRequest * granularitySeconds;

      let currentStart = startTime;
      const batches = [];

      // Create batches for fetching
      while (currentStart < now) {
        const currentEnd = Math.min(currentStart + timeSpanPerRequest, now);
        batches.push({
          start: new Date(currentStart * 1000).toISOString(),
          end: new Date(currentEnd * 1000).toISOString(),
          startTimestamp: currentStart,
          endTimestamp: currentEnd
        });
        currentStart = currentEnd;
      }


      // Process batches with rate limiting
      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];

        try {
          // 🔧 FIX: Use unauthenticated Exchange API REST endpoint instead of authenticated Advanced Trade API
          // This avoids ECDSA signature errors with CDP keys
          const url = `https://api.exchange.coinbase.com/products/${pair}/candles?start=${batch.start}&end=${batch.end}&granularity=${granularitySeconds}`;


          const response = await fetch(url);

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          const apiData = await response.json();

          // Convert Exchange API format [time, low, high, open, close, volume] to our format
          const candles = apiData.map(([time, low, high, open, close, volume]) => ({
            time,
            open,
            high,
            low,
            close,
            volume
          }));

          if (candles.length > 0) {
            // Store candles in Redis
            await redisCandleStorage.storeCandles(pair, granularity, candles);
            this.stats.totalCandles += candles.length;
          }

          this.stats.totalRequests++;

          // Rate limiting: wait between requests
          if (i < batches.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 200)); // 200ms between requests to avoid rate limits
          }

        } catch (error) {
          this.stats.errors++;

          // If rate limited, wait longer
          if (error.message.includes('429') || error.message.includes('rate limit')) {
            await new Promise(resolve => setTimeout(resolve, 5000));
          } else {
            // Wait 1s on other errors before continuing
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
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
      const start = new Date(startTime * 1000).toISOString();
      const end = new Date(now * 1000).toISOString();

      // 🔧 FIX: Use unauthenticated Exchange API REST endpoint
      const url = `https://api.exchange.coinbase.com/products/${pair}/candles?start=${start}&end=${end}&granularity=${granularitySeconds}`;
      const response = await fetch(url);

      if (!response.ok) {
        return 0;
      }

      const apiData = await response.json();

      // Convert Exchange API format [time, low, high, open, close, volume] to our format
      const candles = apiData.map(([time, low, high, open, close, volume]) => ({
        time,
        open,
        high,
        low,
        close,
        volume
      }));

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

      if (candleCount < 1000) {
        await this.fetchHistoricalData(pair, granularity, 7);
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