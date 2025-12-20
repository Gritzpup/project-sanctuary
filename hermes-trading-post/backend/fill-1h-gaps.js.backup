import { historicalDataService } from './src/services/HistoricalDataService.js';

async function fillHourlyGaps() {
  try {
    console.log('🔄 Filling recent 1-hour gaps for BTC-USD...');
    const result = await historicalDataService.fillRecentGaps('BTC-USD', '1h', 24);
    console.log(`✅ Filled ${result} recent 1-hour candles`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Error filling gaps:', error.message);
    process.exit(1);
  }
}

fillHourlyGaps();