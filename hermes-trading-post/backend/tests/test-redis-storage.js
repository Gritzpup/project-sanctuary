#!/usr/bin/env node

/**
 * Test script for Redis candle storage functionality
 */

import { redisChartDataProvider } from './src/services/redis/RedisChartDataProvider.js';
import { redisCandleStorage } from './src/services/redis/RedisCandleStorage.js';

async function testRedisStorage() {
  
  try {
    // Test 1: Connection
    await redisCandleStorage.connect();
    
    // Test 2: Store sample candles
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
    
    // Test 3: Retrieve candles
    const startTime = Math.floor(Date.now() / 1000) - 400;
    const endTime = Math.floor(Date.now() / 1000);
    
    const retrievedCandles = await redisCandleStorage.getCandles(
      'BTC-USD', 
      '1m', 
      startTime, 
      endTime
    );
    
    
    // Test 4: Test chart data provider
    const chartResponse = await redisChartDataProvider.getChartData({
      pair: 'BTC-USD',
      granularity: '1m',
      maxCandles: 100
    });
    
    
    // Test 5: Storage stats
    const stats = await redisCandleStorage.getStorageStats();
    
    
  } catch (error) {
  } finally {
    await redisCandleStorage.disconnect();
  }
}

// Run the test
