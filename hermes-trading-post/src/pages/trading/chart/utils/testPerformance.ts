import { CoinbaseAPI } from '../../../../services/api/coinbaseApi';

export async function testCoinbaseAPIPerformance() {
  // PERF: Disabled - console.log('[TEST] Starting Coinbase API performance test for 3M/1d...');
  
  const api = new CoinbaseAPI();
  const now = Math.floor(Date.now() / 1000);
  const threeMonthsAgo = now - (90 * 24 * 60 * 60); // 90 days in seconds
  
  // PERF: Disabled - console.log('[TEST] Test parameters:');
  // PERF: Disabled - console.log(`- Pair: BTC-USD`);
  // PERF: Disabled - console.log(`- Granularity: 86400 (1 day)`);
  // PERF: Disabled - console.log(`- Start: ${new Date(threeMonthsAgo * 1000).toISOString()}`);
  // PERF: Disabled - console.log(`- End: ${new Date(now * 1000).toISOString()}`);
  // PERF: Disabled - console.log(`- Expected candles: ~90`);
  
  const startTime = performance.now();
  
  try {
    // PERF: Disabled - console.log('[TEST] Making API call...');
    const candles = await api.getCandles(
      'BTC-USD',
      86400, // 1 day in seconds
      threeMonthsAgo.toString(),
      now.toString()
    );
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    // PERF: Disabled - console.log('[TEST] Results:');
    // PERF: Disabled - console.log(`- API call duration: ${duration}ms (${(duration/1000).toFixed(2)}s)`);
    // PERF: Disabled - console.log(`- Candles received: ${candles.length}`);
    
    if (candles.length > 0) {
      // PERF: Disabled - console.log(`- First candle: ${new Date(candles[0].time * 1000).toISOString()}`);
      // PERF: Disabled - console.log(`- Last candle: ${new Date(candles[candles.length - 1].time * 1000).toISOString()}`);
    }
    
    if (duration > 2000) {
      // PERF: Disabled - console.warn('[TEST] WARNING: API call took more than 2 seconds!');
      // PERF: Disabled - console.warn('[TEST] Possible causes:');
      // PERF: Disabled - console.warn('- Slow network connection to Coinbase');
      // PERF: Disabled - console.warn('- Coinbase API rate limiting');
      // PERF: Disabled - console.warn('- Proxy configuration issues in development');
    }
    
    return { duration, candleCount: candles.length };
  } catch (error) {
    // PERF: Disabled - console.error('[TEST] Error during API call:', error);
    throw error;
  }
}

// Run this test directly
if (import.meta.hot) {
  testCoinbaseAPIPerformance();
}