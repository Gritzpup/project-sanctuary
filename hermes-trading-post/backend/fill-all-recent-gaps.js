import { historicalDataService } from './src/services/HistoricalDataService.js';

async function fillAllRecentGaps() {
  try {
    console.log('🔄 Filling recent gaps for all granularities...');
    
    const granularities = ['1m', '5m', '15m', '1h', '6h', '1d'];
    
    for (const granularity of granularities) {
      console.log(`📊 Filling recent ${granularity} data...`);
      const result = await historicalDataService.fillRecentGaps('BTC-USD', granularity, 24);
      console.log(`✅ Filled ${result} recent ${granularity} candles`);
      
      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log('✅ All recent gaps filled successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error filling gaps:', error.message);
    process.exit(1);
  }
}

fillAllRecentGaps();