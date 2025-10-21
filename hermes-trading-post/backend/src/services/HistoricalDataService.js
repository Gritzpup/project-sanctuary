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
   * Fetch historical data for a specific time range
   */
  async fetchHistoricalData(pair, granularity, daysBack = 30) {
    if (this.isRunning) {
      console.log(`⏳ Historical data fetch already in progress`);
      return;
    }

    this.isRunning = true;
    this.stats = {
      totalCandles: 0,
      totalRequests: 0,
      errors: 0,
      startTime: Date.now()
    };

    console.log(`📥 Starting historical data fetch: ${pair} @ ${granularity} for last ${daysBack} days`);


    try {
      const granularitySeconds = coinbaseAPI.granularityToSeconds(granularity);
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
          
          const candles = await coinbaseAPI.getCandles(
            pair,
            granularitySeconds,
            batch.start,
            batch.end
          );

          if (candles.length > 0) {
            // Store candles in Redis
            await redisCandleStorage.storeCandles(pair, granularity, candles);
            this.stats.totalCandles += candles.length;
          }

          this.stats.totalRequests++;

          // Rate limiting: wait between requests
          if (i < batches.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 150)); // 150ms between requests
          }

        } catch (error) {
          this.stats.errors++;
          
          // If rate limited, wait longer
          if (error.message.includes('Rate limited')) {
            await new Promise(resolve => setTimeout(resolve, 5000));
          } else {
            // Wait 1s on other errors before continuing
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      }

      const duration = (Date.now() - this.stats.startTime) / 1000;
      console.log(`✅ Historical data fetch completed: ${this.stats.totalCandles} candles in ${duration.toFixed(1)}s (${this.stats.totalRequests} requests, ${this.stats.errors} errors)`);
    } catch (error) {
      console.error(`❌ Historical data fetch error:`, error.message);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Quick fetch to fill recent gaps
   */
  async fillRecentGaps(pair, granularity, hoursBack = 24) {
    
    const granularitySeconds = coinbaseAPI.granularityToSeconds(granularity);
    const now = Math.floor(Date.now() / 1000);
    
    // Respect Coinbase API limits: max 300 candles per request
    const maxCandles = 300;
    const maxHours = Math.floor((maxCandles * granularitySeconds) / 3600);
    const requestHours = Math.min(hoursBack, maxHours);
    
    
    const startTime = now - (requestHours * 60 * 60);

    try {
      const start = new Date(startTime * 1000).toISOString();
      const end = new Date(now * 1000).toISOString();

      const candles = await coinbaseAPI.getCandles(pair, granularitySeconds, start, end);
      
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
    console.log(`🔧 Historical Data Service initializing for ${pair} @ ${granularity}...`);

    // Test API connection first
    const connected = await coinbaseAPI.testConnection();
    if (!connected) {
      console.warn(`⚠️ Coinbase API test connection failed`);
      return false;
    }
    console.log(`✅ Coinbase API connection verified`);

    // Check if we need initial data
    try {
      const metadata = await redisCandleStorage.getMetadata(pair, granularity);
      const candleCount = metadata?.totalCandles || 0;
      console.log(`📊 Redis has ${candleCount} candles stored for ${pair} @ ${granularity}`);

      if (candleCount < 1000) {
        console.log(`📥 Need more data: ${candleCount} < 1000, fetching 7 days of history...`);
        await this.fetchHistoricalData(pair, granularity, 7);
      } else {
        console.log(`📥 Have enough data: ${candleCount} >= 1000, just filling gaps...`);
        await this.fillRecentGaps(pair, granularity, 6);
      }

      return true;
    } catch (error) {
      console.error(`❌ Historical Data Service initialization error:`, error.message);
      return false;
    }
  }
}

// Export singleton instance
export const historicalDataService = new HistoricalDataService();