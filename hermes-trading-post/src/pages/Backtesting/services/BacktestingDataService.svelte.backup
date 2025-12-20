<script lang="ts" context="module">
  import type { CandleData } from '../../../types/coinbase';
  import { historicalDataService } from '../../../services/data/historicalService';

  // Cache for chart data with timestamps
  const chartDataCache = new Map<string, { data: CandleData[], timestamp: number }>();
  const CACHE_DURATION = 60000; // 1 minute cache duration

  export async function loadChartData(
    selectedPeriod: string,
    selectedGranularity: string,
    forceReload = false
  ): Promise<{ data: CandleData[], connectionStatus: 'connected' | 'error' }> {
    const cacheKey = `${selectedPeriod}-${selectedGranularity}`;
    const cached = chartDataCache.get(cacheKey);
    
    if (!forceReload && cached && (Date.now() - cached.timestamp < CACHE_DURATION)) {
      console.log('Using cached chart data for', cacheKey);
      return { data: cached.data, connectionStatus: 'connected' };
    }
    
    try {
      let endTime = new Date();
      let startTime = new Date();
      
      switch (selectedPeriod) {
        case '1H':
          startTime.setHours(startTime.getHours() - 1);
          break;
        case '4H':
          startTime.setHours(startTime.getHours() - 4);
          break;
        case '5D':
          startTime.setDate(startTime.getDate() - 5);
          break;
        case '1M':
          startTime.setMonth(startTime.getMonth() - 1);
          break;
        case '3M':
          startTime.setMonth(startTime.getMonth() - 3);
          break;
        case '6M':
          startTime.setMonth(startTime.getMonth() - 6);
          break;
        case '1Y':
          startTime.setFullYear(startTime.getFullYear() - 1);
          break;
        case '5Y':
          startTime.setFullYear(startTime.getFullYear() - 5);
          break;
      }
      
      const granularityMap: Record<string, number> = {
        '1m': 60,
        '5m': 300,
        '15m': 900,
        '1h': 3600,
        '6h': 21600,
        '1D': 86400
      };
      
      const granularitySeconds = granularityMap[selectedGranularity] || 3600;
      
      console.log('Fetching data with params:', { startTime, endTime, granularitySeconds });
      
      const data = await historicalDataService.fetchHistoricalData({
        symbol: 'BTC-USD',
        startTime,
        endTime,
        granularity: granularitySeconds
      });
      
      chartDataCache.set(cacheKey, { data, timestamp: Date.now() });
      
      console.log(`Loaded ${data.length} candles for ${selectedPeriod}/${selectedGranularity}`);
      return { data, connectionStatus: 'connected' };
    } catch (error) {
      console.error('Failed to load chart data:', error);
      
      // Generate fake data for testing if API fails
      console.log('Generating test data due to API failure...');
      const testCandles: CandleData[] = [];
      const now = Date.now() / 1000;
      const granularitySeconds = { '1m': 60, '5m': 300, '15m': 900, '1h': 3600, '6h': 21600, '1D': 86400 }[selectedGranularity] || 60;
      
      for (let i = 0; i < 100; i++) {
        const time = now - (100 - i) * granularitySeconds;
        const basePrice = 50000 + Math.random() * 10000;
        testCandles.push({
          time,
          low: basePrice - Math.random() * 500,
          high: basePrice + Math.random() * 500,
          open: basePrice + (Math.random() - 0.5) * 300,
          close: basePrice + (Math.random() - 0.5) * 300,
          volume: Math.random() * 100
        });
      }
      
      console.log('Using test data:', testCandles.length, 'candles');
      return { data: testCandles, connectionStatus: 'error' };
    }
  }

  // Valid granularity combinations per period
  export const validGranularities: Record<string, string[]> = {
    '1H': ['1m'],
    '4H': ['1m', '5m'],
    '5D': ['1m', '5m', '15m'],
    '1M': ['5m', '15m', '1h'],
    '3M': ['15m', '1h', '6h'],
    '6M': ['1h', '6h', '1D'],
    '1Y': ['6h', '1D'],
    '5Y': ['1D']
  };

  export function isGranularityValid(granularity: string, period: string): boolean {
    return validGranularities[period]?.includes(granularity) || false;
  }

  export function autoSelectGranularity(period: string, currentGranularity: string): string {
    if (isGranularityValid(currentGranularity, period)) {
      return currentGranularity;
    }
    
    const validOptions = validGranularities[period];
    if (validOptions && validOptions.length > 0) {
      const middleIndex = Math.floor(validOptions.length / 2);
      return validOptions[middleIndex];
    }
    
    return currentGranularity;
  }
</script>

<script lang="ts">
  // This component only exports utility functions
  // No UI rendering
</script>