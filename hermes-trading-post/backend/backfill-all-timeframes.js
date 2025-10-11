#!/usr/bin/env node
/**
 * Comprehensive Historical Data Backfill Script
 * Fetches all necessary historical data for all supported timeframes
 *
 * Timeframe requirements:
 * - 1H: 60 × 1m, 12 × 5m, 4 × 15m
 * - 6H: 72 × 5m, 24 × 15m, 6 × 1h
 * - 1D: 96 × 15m, 24 × 1h, 4 × 6h
 * - 5D: 120 × 1h, 20 × 6h, 5 × 1d
 * - 1M: 120 × 6h, 30 × 1d
 * - 3M: 90 × 1d
 * - 6M: 180 × 1d
 * - 1Y: 1460 × 6h, 365 × 1d
 * - 5Y: 1825 × 1d
 */

import { historicalDataService } from './src/services/HistoricalDataService.js';
import { redisCandleStorage } from './src/services/redis/RedisCandleStorage.js';

const PAIR = 'BTC-USD';

// Define what we need for each granularity to support all timeframes
const BACKFILL_CONFIG = [
  // 1m: Needed for 1H timeframe (60 candles = 1 hour)
  { granularity: '1m', daysBack: 7, reason: '1H timeframe (need 60 candles)' },

  // 5m: Needed for 1H and 6H timeframes (72 candles = 6 hours)
  { granularity: '5m', daysBack: 7, reason: '1H + 6H timeframes (need 72 candles)' },

  // 15m: Needed for 1H, 6H, and 1D timeframes (96 candles = 1 day)
  { granularity: '15m', daysBack: 7, reason: '1H + 6H + 1D timeframes (need 96 candles)' },

  // 1h: Needed for 6H, 1D, and 5D timeframes (120 candles = 5 days)
  { granularity: '1h', daysBack: 7, reason: '6H + 1D + 5D timeframes (need 120 candles)' },

  // 6h: Needed for 1D, 5D, 1M, and 1Y timeframes (1460 candles = 365 days)
  { granularity: '6h', daysBack: 365, reason: '1D + 5D + 1M + 1Y timeframes (need up to 1460 candles)' },

  // 1d: Needed for 5D, 1M, 3M, 6M, 1Y, and 5Y timeframes (1825 candles = 5 years)
  { granularity: '1d', daysBack: 1825, reason: '5D + 1M + 3M + 6M + 1Y + 5Y timeframes (need up to 1825 candles)' }
];

async function checkCurrentStatus() {
  console.log('📊 Checking current data status...\n');

  for (const config of BACKFILL_CONFIG) {
    const metadata = await redisCandleStorage.getMetadata(PAIR, config.granularity);
    const candleCount = metadata?.totalCandles || 0;
    const status = candleCount > 0 ? '✅' : '❌';

    console.log(`${status} ${config.granularity.padEnd(4)} - ${candleCount.toString().padStart(5)} candles (${config.reason})`);
  }

  console.log('');
}

async function backfillAllData() {
  console.log('🚀 Starting comprehensive historical data backfill...\n');

  await checkCurrentStatus();

  console.log('📥 Beginning backfill process...\n');

  let totalFetched = 0;
  let totalErrors = 0;
  const startTime = Date.now();

  for (let i = 0; i < BACKFILL_CONFIG.length; i++) {
    const config = BACKFILL_CONFIG[i];
    console.log(`\n${'='.repeat(80)}`);
    console.log(`📦 [${i + 1}/${BACKFILL_CONFIG.length}] Backfilling ${config.granularity} (${config.daysBack} days)`);
    console.log(`   Reason: ${config.reason}`);
    console.log(`${'='.repeat(80)}\n`);

    try {
      await historicalDataService.fetchHistoricalData(PAIR, config.granularity, config.daysBack);

      const metadata = await redisCandleStorage.getMetadata(PAIR, config.granularity);
      const candleCount = metadata?.totalCandles || 0;
      totalFetched += candleCount;

      console.log(`✅ ${config.granularity} backfill complete: ${candleCount} total candles stored\n`);

    } catch (error) {
      console.error(`❌ Error backfilling ${config.granularity}:`, error.message);
      totalErrors++;
    }

    // Wait between granularities to avoid overwhelming the API
    if (i < BACKFILL_CONFIG.length - 1) {
      console.log('⏳ Waiting 2s before next granularity...\n');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log(`\n${'='.repeat(80)}`);
  console.log('🎉 Backfill process completed!');
  console.log(`${'='.repeat(80)}`);
  console.log(`⏱️  Duration: ${duration}s`);
  console.log(`📊 Total candles stored: ${totalFetched}`);
  console.log(`❌ Errors: ${totalErrors}`);
  console.log(`${'='.repeat(80)}\n`);

  await checkCurrentStatus();

  console.log('✅ All timeframes should now have sufficient historical data!');
  console.log('\nSupported timeframes:');
  console.log('  • 1H: 1m (60), 5m (12), 15m (4)');
  console.log('  • 6H: 5m (72), 15m (24), 1h (6)');
  console.log('  • 1D: 15m (96), 1h (24), 6h (4)');
  console.log('  • 5D: 1h (120), 6h (20), 1d (5)');
  console.log('  • 1M: 6h (120), 1d (30)');
  console.log('  • 3M: 1d (90)');
  console.log('  • 6M: 1d (180)');
  console.log('  • 1Y: 1d (365)');
  console.log('  • 5Y: 1d (1825)');
}

// Run the backfill
backfillAllData()
  .then(() => {
    console.log('\n✅ Backfill script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Backfill script failed:', error);
    process.exit(1);
  });
