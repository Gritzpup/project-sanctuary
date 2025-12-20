/**
 * One-time cleanup script to remove excess candle data
 * Run this manually with: node backend/cleanup-old-candles.js
 */

import { redisCandleStorage } from './src/services/redis/RedisCandleStorage.js';

const RETENTION_POLICIES = {
  '1m': 7,      // Last week
  '5m': 30,     // Last month
  '15m': 90,    // Last 3 months
  '1h': 365,    // Last year
  '6h': 1825,   // 5 years
  '1d': 3650    // 10 years
};

async function cleanupAllGranularities() {

  try {
    await redisCandleStorage.connect();

    const pair = 'BTC-USD';
    const now = Math.floor(Date.now() / 1000);

    for (const [granularity, retentionDays] of Object.entries(RETENTION_POLICIES)) {

      const retentionSeconds = retentionDays * 86400;
      const cutoffTime = now - retentionSeconds;


      // Get metadata before cleanup
      const beforeMetadata = await redisCandleStorage.getMetadata(pair, granularity);
      if (beforeMetadata) {
      }

      // Delete old data
      const deletedCount = await redisCandleStorage.deleteOldCandles(pair, granularity, cutoffTime);

      // Get metadata after cleanup
      const afterMetadata = await redisCandleStorage.getMetadata(pair, granularity);
      if (afterMetadata) {
      }

    }


    // Get final statistics
    const stats = await redisCandleStorage.getStorageStats();

    // Get total candles
    let totalCandles = 0;
    for (const granularity of Object.keys(RETENTION_POLICIES)) {
      const metadata = await redisCandleStorage.getMetadata(pair, granularity);
      if (metadata) {
        totalCandles += metadata.totalCandles;
      }
    }


  } catch (error) {
  } finally {
    await redisCandleStorage.disconnect();
    process.exit(0);
  }
}

cleanupAllGranularities();
