import { CoinbaseAPI } from '../../../../services/api/coinbaseApi';

export async function testCoinbaseAPIPerformance() {
  
  const api = new CoinbaseAPI();
  const now = Math.floor(Date.now() / 1000);
  const threeMonthsAgo = now - (90 * 24 * 60 * 60); // 90 days in seconds
  
  
  const startTime = performance.now();
  
  try {
    const candles = await api.getCandles(
      'BTC-USD',
      86400, // 1 day in seconds
      threeMonthsAgo.toString(),
      now.toString()
    );
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    
    if (candles.length > 0) {
    }
    
    if (duration > 2000) {
    }
    
    return { duration, candleCount: candles.length };
  } catch (error) {
    throw error;
  }
}

// Run this test directly
if (import.meta.hot) {
  testCoinbaseAPIPerformance();
}