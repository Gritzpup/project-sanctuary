/**
 * Recalculate Metadata Script
 * Fixes the inflated totalCandles counter
 */

import { redisCandleStorage } from './src/services/redis/RedisCandleStorage.js';
import { CANDLE_STORAGE_CONFIG } from './src/services/redis/RedisConfig.js';

async function recalculateMetadata() {
  console.log('Starting metadata recalculation...\n');
  
  await redisCandleStorage.connect();
  
  const pair = 'BTC-USD';
  const granularities = ['1m', '5m', '15m', '1h', '6h', '1d'];
  
  for (const granularity of granularities) {
    console.log('Processing ' + pair + ' ' + granularity + '...');
    
    const oldMeta = await redisCandleStorage.getMetadata(pair, granularity);
    
    if (!oldMeta) {
      console.log('  No metadata found, skipping\n');
      continue;
    }
    
    console.log('  Old totalCandles: ' + oldMeta.totalCandles);
    
    const pattern = CANDLE_STORAGE_CONFIG.keyPrefixes.candles + ':' + pair + ':' + granularity + ':*:data';
    const keys = await redisCandleStorage.redis.keys(pattern);
    
    let actualCount = 0;
    for (const key of keys) {
      const count = await redisCandleStorage.redis.hlen(key);
      actualCount += count;
    }
    
    console.log('  Actual unique candles: ' + actualCount);
    console.log('  Difference: ' + (oldMeta.totalCandles - actualCount) + ' duplicates removed');
    
    const metadataKey = 'meta:' + pair + ':' + granularity;
    await redisCandleStorage.redis.hset(metadataKey, {
      pair: oldMeta.pair,
      granularity: oldMeta.granularity,
      firstTimestamp: oldMeta.firstTimestamp.toString(),
      lastTimestamp: oldMeta.lastTimestamp.toString(),
      totalCandles: actualCount.toString(),
      lastUpdated: Date.now().toString()
    });
    
    console.log('  Metadata updated\n');
  }
  
  console.log('Metadata recalculation complete!');
  
  await redisCandleStorage.disconnect();
  process.exit(0);
}

recalculateMetadata().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
