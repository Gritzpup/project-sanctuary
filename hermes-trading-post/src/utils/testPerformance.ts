import { ChartDataFeed } from '../services/chartDataFeed';
import { IndexedDBCache } from '../services/indexedDBCache';

async function testDailyCandles() {
  console.log('Testing daily candle performance...');
  
  // Clear the cache first to ensure clean test
  const cache = new IndexedDBCache();
  console.log('Clearing cache...');
  await cache.clearAll();
  
  // Create a new data feed
  const dataFeed = new ChartDataFeed();
  
  // Set to daily granularity
  dataFeed.setGranularity('1D');
  
  // Request 3 months of data
  const endTime = Math.floor(Date.now() / 1000);
  const startTime = endTime - (90 * 86400); // 90 days ago
  
  console.log(`Requesting data from ${new Date(startTime * 1000).toISOString()} to ${new Date(endTime * 1000).toISOString()}`);
  
  const startPerfTime = performance.now();
  
  try {
    const data = await dataFeed.getDataForVisibleRange(startTime, endTime);
    const elapsed = performance.now() - startPerfTime;
    
    console.log(`Performance test completed in ${elapsed.toFixed(2)}ms`);
    console.log(`Received ${data.length} candles`);
    
    // Cleanup
    dataFeed.disconnect();
  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Run the test
testDailyCandles().catch(console.error);