import { historicalDataService } from './src/services/HistoricalDataService.js';

async function fillAllRecentGaps() {
  try {
    
    const granularities = ['1m', '5m', '15m', '1h', '6h', '1d'];
    
    for (const granularity of granularities) {
      const result = await historicalDataService.fillRecentGaps('BTC-USD', granularity, 24);
      
      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    process.exit(0);
  } catch (error) {
    process.exit(1);
  }
}

fillAllRecentGaps();