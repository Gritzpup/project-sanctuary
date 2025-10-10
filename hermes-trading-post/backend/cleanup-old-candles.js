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
  console.log('🧹 Starting cleanup of old candle data...\n');

  try {
    await redisCandleStorage.connect();

    const pair = 'BTC-USD';
    const now = Math.floor(Date.now() / 1000);

    for (const [granularity, retentionDays] of Object.entries(RETENTION_POLICIES)) {
      console.log(`\n${'='.repeat(70)}`);
      console.log(`Cleaning ${granularity} data (retention: ${retentionDays} days)`);
      console.log('='.repeat(70));

      const retentionSeconds = retentionDays * 86400;
      const cutoffTime = now - retentionSeconds;

      console.log(`Cutoff date: ${new Date(cutoffTime * 1000).toISOString()}`);

      // Get metadata before cleanup
      const beforeMetadata = await redisCandleStorage.getMetadata(pair, granularity);
      if (beforeMetadata) {
        console.log(`Before: ${beforeMetadata.totalCandles} candles from ${new Date(beforeMetadata.firstTimestamp * 1000).toISOString()} to ${new Date(beforeMetadata.lastTimestamp * 1000).toISOString()}`);
      }

      // Delete old data
      const deletedCount = await redisCandleStorage.deleteOldCandles(pair, granularity, cutoffTime);

      // Get metadata after cleanup
      const afterMetadata = await redisCandleStorage.getMetadata(pair, granularity);
      if (afterMetadata) {
        console.log(`After: ${afterMetadata.totalCandles} candles from ${new Date(afterMetadata.firstTimestamp * 1000).toISOString()} to ${new Date(afterMetadata.lastTimestamp * 1000).toISOString()}`);
      }

      console.log(`✅ Deleted ${deletedCount} day buckets for ${granularity}`);
    }

    console.log(`\n${'='.repeat(70)}`);
    console.log('CLEANUP SUMMARY');
    console.log('='.repeat(70));

    // Get final statistics
    const stats = await redisCandleStorage.getStorageStats();
    console.log(`\nTotal Redis keys: ${stats.totalKeys}`);
    console.log(`Memory usage: ${stats.memoryUsage}`);
    console.log(`\nGranularities: ${stats.granularities.join(', ')}`);

    // Get total candles
    let totalCandles = 0;
    for (const granularity of Object.keys(RETENTION_POLICIES)) {
      const metadata = await redisCandleStorage.getMetadata(pair, granularity);
      if (metadata) {
        console.log(`  ${granularity}: ${metadata.totalCandles.toLocaleString()} candles`);
        totalCandles += metadata.totalCandles;
      }
    }

    console.log(`\n📊 Total candles after cleanup: ${totalCandles.toLocaleString()}`);
    console.log('\n✅ Cleanup complete!\n');

  } catch (error) {
    console.error('❌ Cleanup failed:', error);
  } finally {
    await redisCandleStorage.disconnect();
    process.exit(0);
  }
}

cleanupAllGranularities();
