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
      console.log('⚠️ Historical data fetch already in progress');
      return;
    }

    this.isRunning = true;
    this.stats = {
      totalCandles: 0,
      totalRequests: 0,
      errors: 0,
      startTime: Date.now()
    };

    console.log(`🚀 Starting historical data fetch: ${pair} ${granularity} for ${daysBack} days`);

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

      console.log(`📊 Created ${batches.length} batches to fetch ~${batches.length * 300} candles`);

      // Process batches with rate limiting
      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        
        try {
          console.log(`🔄 Fetching batch ${i + 1}/${batches.length}: ${batch.start} to ${batch.end}`);
          
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
            console.log(`✅ Stored ${candles.length} candles (Total: ${this.stats.totalCandles})`);
          }

          this.stats.totalRequests++;

          // Rate limiting: wait between requests
          if (i < batches.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 150)); // 150ms between requests
          }

        } catch (error) {
          console.error(`❌ Error fetching batch ${i + 1}:`, error.message);
          this.stats.errors++;
          
          // If rate limited, wait longer
          if (error.message.includes('Rate limited')) {
            console.log('⏳ Waiting 5s due to rate limit...');
            await new Promise(resolve => setTimeout(resolve, 5000));
          } else {
            // Wait 1s on other errors before continuing
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      }

      const duration = (Date.now() - this.stats.startTime) / 1000;
      console.log(`🎉 Historical data fetch completed in ${duration.toFixed(2)}s`);
      console.log(`📊 Stats: ${this.stats.totalCandles} candles, ${this.stats.totalRequests} requests, ${this.stats.errors} errors`);

    } catch (error) {
      console.error('❌ Historical data fetch failed:', error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Quick fetch to fill recent gaps
   */
  async fillRecentGaps(pair, granularity, hoursBack = 24) {
    console.log(`🔄 Filling recent gaps: ${pair} ${granularity} for ${hoursBack} hours`);
    
    const granularitySeconds = coinbaseAPI.granularityToSeconds(granularity);
    const now = Math.floor(Date.now() / 1000);
    const startTime = now - (hoursBack * 60 * 60);

    try {
      const start = new Date(startTime * 1000).toISOString();
      const end = new Date(now * 1000).toISOString();

      const candles = await coinbaseAPI.getCandles(pair, granularitySeconds, start, end);
      
      if (candles.length > 0) {
        await redisCandleStorage.storeCandles(pair, granularity, candles);
        console.log(`✅ Filled gap with ${candles.length} recent candles`);
      }

      return candles.length;
    } catch (error) {
      console.error('❌ Error filling recent gaps:', error);
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
    console.log('🚀 Initializing HistoricalDataService...');
    
    // Test API connection first
    const connected = await coinbaseAPI.testConnection();
    if (!connected) {
      console.error('❌ Cannot connect to Coinbase API');
      return false;
    }

    // Check if we need initial data
    try {
      const metadata = await redisCandleStorage.getMetadata(pair, granularity);
      const candleCount = metadata?.totalCandles || 0;

      console.log(`📊 Current ${pair} ${granularity} candles in Redis: ${candleCount}`);

      if (candleCount < 1000) {
        console.log('📥 Fetching initial historical data (7 days)...');
        await this.fetchHistoricalData(pair, granularity, 7);
      } else {
        console.log('🔄 Filling recent gaps...');
        await this.fillRecentGaps(pair, granularity, 6);
      }

      return true;
    } catch (error) {
      console.error('❌ Error during initialization:', error);
      return false;
    }
  }
}

// Export singleton instance
export const historicalDataService = new HistoricalDataService();