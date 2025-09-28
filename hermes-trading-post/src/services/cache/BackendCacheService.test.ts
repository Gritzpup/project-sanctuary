/**
 * @file BackendCacheService.test.ts
 * @description Tests for the new BackendCacheService
 */

import { testRunner, assert } from '../../utils/testing/TestRunner';
import { BackendCacheService } from './BackendCacheService';

describe('BackendCacheService', () => {
  let cacheService: BackendCacheService;
  
  beforeEach(() => {
    cacheService = BackendCacheService.getInstance();
  });
  
  afterEach(async () => {
    await cacheService.clearCache();
  });
  
  it('should be a singleton', () => {
    const instance1 = BackendCacheService.getInstance();
    const instance2 = BackendCacheService.getInstance();
    assert.equals(instance1, instance2, 'Should return same instance');
  });
  
  it('should generate consistent cache keys', () => {
    const key1 = (cacheService as any).generateCacheKey({
      symbol: 'BTC-USD',
      granularity: '1m',
      startTime: 1000,
      endTime: 2000
    });
    
    const key2 = (cacheService as any).generateCacheKey({
      symbol: 'BTC-USD',
      granularity: '1m',
      startTime: 1000,
      endTime: 2000
    });
    
    assert.equals(key1, key2, 'Should generate consistent keys');
  });
  
  it('should return cache statistics', () => {
    const stats = cacheService.getCacheStats();
    assert.true(typeof stats.memoryItems === 'number', 'Should have memory items count');
    assert.true(typeof stats.maxMemoryItems === 'number', 'Should have max memory items');
    assert.true(typeof stats.memoryCacheTTL === 'number', 'Should have TTL');
  });
  
  it('should handle store candles operation', async () => {
    const request = {
      symbol: 'BTC-USD',
      granularity: '1m',
      startTime: 1000,
      endTime: 2000
    };
    
    const candles = [
      { time: 1000, open: 50000, high: 51000, low: 49000, close: 50500, volume: 100 }
    ];
    
    // Should not throw
    await assert.async.resolves(
      cacheService.storeCandles(request, candles),
      'Should store candles without error'
    );
  });
});

// Run the tests if this file is executed directly
if (import.meta.url === new URL(import.meta.url).href) {
  testRunner.runAll();
}