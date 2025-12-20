import { historicalDataService } from './src/services/HistoricalDataService.js';

async function fillHourlyGaps() {
  try {
    const result = await historicalDataService.fillRecentGaps('BTC-USD', '1h', 24);
    process.exit(0);
  } catch (error) {
    process.exit(1);
  }
}

fillHourlyGaps();