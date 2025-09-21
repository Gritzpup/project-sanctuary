import { CoinbaseAPI } from '../../../../services/api/coinbaseApi';

export async function testCoinbaseAPIPerformance() {
  console.log('[TEST] Starting Coinbase API performance test for 3M/1d...');
  
  const api = new CoinbaseAPI();
  const now = Math.floor(Date.now() / 1000);
  const threeMonthsAgo = now - (90 * 24 * 60 * 60); // 90 days in seconds
  
  console.log('[TEST] Test parameters:');
  console.log(`- Pair: BTC-USD`);
  console.log(`- Granularity: 86400 (1 day)`);
  console.log(`- Start: ${new Date(threeMonthsAgo * 1000).toISOString()}`);
  console.log(`- End: ${new Date(now * 1000).toISOString()}`);
  console.log(`- Expected candles: ~90`);
  
  const startTime = performance.now();
  
  try {
    console.log('[TEST] Making API call...');
    const candles = await api.getCandles(
      'BTC-USD',
      86400, // 1 day in seconds
      threeMonthsAgo.toString(),
      now.toString()
    );
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    console.log('[TEST] Results:');
    console.log(`- API call duration: ${duration}ms (${(duration/1000).toFixed(2)}s)`);
    console.log(`- Candles received: ${candles.length}`);
    
    if (candles.length > 0) {
      console.log(`- First candle: ${new Date(candles[0].time * 1000).toISOString()}`);
      console.log(`- Last candle: ${new Date(candles[candles.length - 1].time * 1000).toISOString()}`);
    }
    
    if (duration > 2000) {
      console.warn('[TEST] WARNING: API call took more than 2 seconds!');
      console.warn('[TEST] Possible causes:');
      console.warn('- Slow network connection to Coinbase');
      console.warn('- Coinbase API rate limiting');
      console.warn('- Proxy configuration issues in development');
    }
    
    return { duration, candleCount: candles.length };
  } catch (error) {
    console.error('[TEST] Error during API call:', error);
    throw error;
  }
}

// Run this test directly
if (import.meta.hot) {
  testCoinbaseAPIPerformance();
}