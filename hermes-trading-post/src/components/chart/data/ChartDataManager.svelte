<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { ChartDataFeed } from '../../../services/chart/dataFeed';
  import type { CandleData } from '../../../types/coinbase';
  
  export let granularity: string = '1m';
  export let period: string = '1H';
  export let isPaperTestMode: boolean = false;
  export let paperTestDate: Date | null = null;
  
  // Data state
  export let candles: CandleData[] = [];
  export let isLoading: boolean = false;
  export let status: 'connected' | 'disconnected' | 'error' | 'loading' = 'loading';
  
  let dataFeed: ChartDataFeed | null = null;
  let updateInterval: number | null = null;
  let unsubscribe: (() => void) | null = null;
  
  // Map periods to days
  const periodToDays: Record<string, number> = {
    '1H': 1/24,
    '4H': 4/24,
    '5D': 5,
    '1M': 30,
    '3M': 90,
    '6M': 180,
    '1Y': 365,
    '5Y': 1825
  };
  
  // Map granularities to seconds
  const granularityToSeconds: Record<string, number> = {
    '1m': 60,
    '5m': 300,
    '15m': 900,
    '1h': 3600,
    '6h': 21600,
    '1D': 86400
  };
  
  async function loadData() {
    console.log('ChartDataManager: Loading data for', granularity, period);
    if (!dataFeed) {
      console.log('ChartDataManager: No data feed available');
      return;
    }
    
    isLoading = true;
    status = 'loading';
    
    try {
      const days = periodToDays[period] || 1;
      const granularitySeconds = granularityToSeconds[granularity] || 60;
      
      if (isPaperTestMode && paperTestDate) {
        // Load historical data for paper test
        const endDate = new Date(paperTestDate);
        const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);
        
        // Use getDataForVisibleRange method which exists on ChartDataFeed
        const data = await dataFeed.getDataForVisibleRange(
          startDate.getTime() / 1000,
          endDate.getTime() / 1000,
          'paper-test'
        );
        
        console.log('ChartDataManager: Loaded', data.length, 'paper test candles');
        candles = data;
      } else {
        // Load regular data
        const endDate = new Date();
        const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);
        
        const data = await dataFeed.getDataForVisibleRange(
          startDate.getTime() / 1000,
          endDate.getTime() / 1000
        );
        console.log('ChartDataManager: Loaded', data.length, 'candles');
        candles = data;
      }
      
      status = 'connected';
    } catch (error) {
      console.error('Failed to load chart data:', error);
      status = 'error';
      
      // Generate test data as fallback
      candles = generateTestData();
    } finally {
      isLoading = false;
    }
  }
  
  function generateTestData(): CandleData[] {
    const testCandles: CandleData[] = [];
    const now = Date.now() / 1000;
    const granularitySeconds = granularityToSeconds[granularity] || 60;
    
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
    
    return testCandles;
  }
  
  // Subscribe to real-time updates
  function subscribeToUpdates() {
    if (!dataFeed || isPaperTestMode) return;
    
    // Subscribe to real-time candle updates
    unsubscribe = dataFeed.subscribe((candle: CandleData) => {
      // Add or update the latest candle
      const existingIndex = candles.findIndex(c => c.time === candle.time);
      if (existingIndex >= 0) {
        candles[existingIndex] = candle;
      } else {
        candles = [...candles, candle];
        
        // Keep only last N candles based on period
        const maxCandles = calculateMaxCandles();
        if (candles.length > maxCandles) {
          candles = candles.slice(-maxCandles);
        }
      }
    });
  }
  
  function calculateMaxCandles(): number {
    const days = periodToDays[period] || 1;
    const granularitySeconds = granularityToSeconds[granularity] || 60;
    return Math.floor(days * 24 * 60 * 60 / granularitySeconds);
  }
  
  // React to granularity/period changes
  $: if (dataFeed && (granularity || period)) {
    loadData();
  }
  
  // React to paper test mode changes
  $: if (dataFeed && isPaperTestMode !== undefined) {
    loadData();
  }
  
  onMount(async () => {
    // Get singleton instance of ChartDataFeed
    dataFeed = ChartDataFeed.getInstance();
    
    // Load initial data
    await loadData();
    
    // Subscribe to updates if not in paper test mode
    if (!isPaperTestMode) {
      subscribeToUpdates();
      
      // Set up periodic refresh
      updateInterval = setInterval(() => {
        if (!isPaperTestMode) {
          loadData();
        }
      }, 30000) as unknown as number; // Refresh every 30 seconds
    }
  });
  
  onDestroy(() => {
    // ChartDataFeed is a singleton, don't call cleanup
    dataFeed = null;
    
    if (updateInterval) {
      clearInterval(updateInterval);
      updateInterval = null;
    }
    
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
  });
</script>