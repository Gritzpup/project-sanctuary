/**
 * Recalculate Metadata Script
 * Fixes the inflated totalCandles counter
 */

import { redisCandleStorage } from './src/services/redis/RedisCandleStorage.js';
import { CANDLE_STORAGE_CONFIG } from './src/services/redis/RedisConfig.js';

async function recalculateMetadata() {
  
  await redisCandleStorage.connect();
  
  const pair = 'BTC-USD';
  const granularities = ['1m', '5m', '15m', '1h', '6h', '1d'];
  
  for (const granularity of granularities) {
    
    const oldMeta = await redisCandleStorage.getMetadata(pair, granularity);
    
    if (!oldMeta) {
      continue;
    }
    
    
    const pattern = CANDLE_STORAGE_CONFIG.keyPrefixes.candles + ':' + pair + ':' + granularity + ':*:data';
    const keys = await redisCandleStorage.redis.keys(pattern);
    
    let actualCount = 0;
    for (const key of keys) {
      const count = await redisCandleStorage.redis.hlen(key);
      actualCount += count;
    }
    
    
    const metadataKey = 'meta:' + pair + ':' + granularity;
    await redisCandleStorage.redis.hset(metadataKey, {
      pair: oldMeta.pair,
      granularity: oldMeta.granularity,
      firstTimestamp: oldMeta.firstTimestamp.toString(),
      lastTimestamp: oldMeta.lastTimestamp.toString(),
      totalCandles: actualCount.toString(),
      lastUpdated: Date.now().toString()
    });
    
  }
  
  
  await redisCandleStorage.disconnect();
  process.exit(0);
}

recalculateMetadata().catch(err => {
  process.exit(1);
});
