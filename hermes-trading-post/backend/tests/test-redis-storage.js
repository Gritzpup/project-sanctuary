#!/usr/bin/env node

/**
 * Test script for Redis candle storage functionality
 */

import { redisChartDataProvider } from './src/services/redis/RedisChartDataProvider.js';
import { redisCandleStorage } from './src/services/redis/RedisCandleStorage.js';

async function testRedisStorage() {
  console.log('🧪 Testing Redis Candle Storage System...\n');
  
  try {
    // Test 1: Connection
    console.log('1️⃣ Testing Redis connection...');
    await redisCandleStorage.connect();
    console.log('✅ Redis connection successful\n');
    
    // Test 2: Store sample candles
    console.log('2️⃣ Testing candle storage...');
    const sampleCandles = [
      {
        time: Math.floor(Date.now() / 1000) - 300,
        open: 45000,
        high: 45100,
        low: 44950,
        close: 45050,
        volume: 1.5
      },
      {
        time: Math.floor(Date.now() / 1000) - 240,
        open: 45050,
        high: 45200,
        low: 45000,
        close: 45150,
        volume: 2.1
      },
      {
        time: Math.floor(Date.now() / 1000) - 180,
        open: 45150,
        high: 45300,
        low: 45100,
        close: 45250,
        volume: 1.8
      }
    ];
    
    await redisCandleStorage.storeCandles('BTC-USD', '1m', sampleCandles);
    console.log('✅ Sample candles stored successfully\n');
    
    // Test 3: Retrieve candles
    console.log('3️⃣ Testing candle retrieval...');
    const startTime = Math.floor(Date.now() / 1000) - 400;
    const endTime = Math.floor(Date.now() / 1000);
    
    const retrievedCandles = await redisCandleStorage.getCandles(
      'BTC-USD', 
      '1m', 
      startTime, 
      endTime
    );
    
    console.log(`✅ Retrieved ${retrievedCandles.length} candles`);
    console.log('Sample candle:', retrievedCandles[0]);
    console.log('');
    
    // Test 4: Test chart data provider
    console.log('4️⃣ Testing chart data provider...');
    const chartResponse = await redisChartDataProvider.getChartData({
      pair: 'BTC-USD',
      granularity: '1m',
      maxCandles: 100
    });
    
    console.log(`✅ Chart data provider returned ${chartResponse.candles.length} candles`);
    console.log(`Source: ${chartResponse.metadata.source}`);
    console.log(`Cache hit ratio: ${chartResponse.metadata.cacheHitRatio.toFixed(2)}`);
    console.log('');
    
    // Test 5: Storage stats
    console.log('5️⃣ Testing storage statistics...');
    const stats = await redisCandleStorage.getStorageStats();
    console.log('✅ Storage stats:', stats);
    console.log('');
    
    console.log('🎉 All Redis storage tests passed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await redisCandleStorage.disconnect();
    console.log('🔌 Redis connection closed');
  }
}

// Run the test
testRedisStorage().catch(console.error);