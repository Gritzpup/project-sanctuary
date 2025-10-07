<script lang="ts">
  import { onMount, onDestroy, getContext } from 'svelte';
  import { dataStore } from '../../stores/dataStore.svelte';
  import { chartStore } from '../../stores/chartStore.svelte';
  import { formatNumber } from '../../utils/priceFormatters';
  import { getCandleCount } from '../../../../../lib/chart/TimeframeCompatibility';
  import type { IChartApi } from 'lightweight-charts';

  // Props using Svelte 5 runes syntax
  const {
    updateInterval = 2000,
    showAnimation = true
  }: {
    updateInterval?: number;
    showAnimation?: boolean;
  } = $props();

  // Internal state
  let candleCountInterval: NodeJS.Timeout;
  let actualCandleCount = $state(0);
  let lastCandleCount = $state(0);

  // Animation state
  let isNewCandle = $state(false);

  // Chart context interface
  interface ChartContext {
    getChart: () => IChartApi | null;
    getSeries: () => any;
    getPluginManager: () => any;
    stores: any;
  }

  // Get chart context with proper typing
  let chartContext: ChartContext | null = null;
  try {
    chartContext = getContext('chart') as ChartContext | null;
  } catch (error) {
    console.log('CandleCounter: No chart context available');
  }

  // Get expected candle count based on current timeframe and granularity
  function getActualCandleCount(): number {
    try {
      // Get current chart configuration
      const config = chartStore.config;
      if (config?.granularity && config?.timeframe) {
        // Use the timeframe compatibility function to get expected candle count
        const expectedCount = getCandleCount(config.granularity, config.timeframe);
        
        console.log(`📊 [CandleCounter] Expected candles for ${config.granularity}/${config.timeframe}: ${expectedCount}`);
        
        // For cases where we have less data than expected, show actual data count
        const actualDataCount = dataStore.candles.length;
        const displayCount = Math.min(expectedCount, actualDataCount);
        
        console.log(`📊 [CandleCounter] Displaying ${displayCount} candles (expected: ${expectedCount}, available: ${actualDataCount})`);
        
        return displayCount;
      }
    } catch (error) {
      console.log('Could not get expected candle count:', error);
    }
    
    // Fallback: return total candles in dataStore
    const totalCandles = dataStore.candles.length;
    console.log(`📊 [CandleCounter] Fallback - total candles in dataStore: ${totalCandles}`);
    
    return totalCandles;
  }

  // Reactive updates
  $effect(() => {
    // Update count immediately when dataStore changes
    actualCandleCount = getActualCandleCount();
  });

  // Track new candles for animation
  $effect(() => {
    if (actualCandleCount > lastCandleCount && lastCandleCount > 0) {
      if (showAnimation) {
        isNewCandle = true;
        setTimeout(() => {
          isNewCandle = false;
        }, 1000); // Animation duration
      }
    }
    lastCandleCount = actualCandleCount;
  });

  onMount(() => {
    // Initial count
    actualCandleCount = getActualCandleCount();
    
    // Set up interval for periodic updates
    candleCountInterval = setInterval(() => {
      actualCandleCount = getActualCandleCount();
    }, updateInterval);
    
    // Listen for chart changes (scroll/zoom) to update visible count
    try {
      const chart = chartContext?.getChart?.();
      
      if (chart) {
        // Update count when visible logical range changes (zoom/scroll)
        chart.timeScale().subscribeVisibleLogicalRangeChange(() => {
          const newCount = getActualCandleCount();
          if (newCount !== actualCandleCount) {
            actualCandleCount = newCount;
            console.log(`📊 [CandleCounter] Range changed: now showing ${actualCandleCount} candles`);
          }
        });
        
        // Also subscribe to visible time range changes
        chart.timeScale().subscribeVisibleTimeRangeChange(() => {
          const newCount = getActualCandleCount();
          if (newCount !== actualCandleCount) {
            actualCandleCount = newCount;
            console.log(`📊 [CandleCounter] Time range changed: now showing ${actualCandleCount} candles`);
          }
        });
      }
    } catch (error) {
      console.log('Could not subscribe to chart changes:', error);
    }
  });

  onDestroy(() => {
    if (candleCountInterval) {
      clearInterval(candleCountInterval);
    }
  });
</script>

<span 
  class="candle-count" 
  class:new-candle={isNewCandle}
>
  {formatNumber(actualCandleCount)}
</span>

<style>
  .candle-count {
    transition: all 0.3s ease;
  }

  .candle-count.new-candle {
    animation: candleUpdate 1s ease-out;
    color: #4caf50;
    font-weight: bold;
  }

  @keyframes candleUpdate {
    0% {
      background-color: rgba(76, 175, 80, 0.3);
      transform: scale(1);
      box-shadow: 0 0 0 0 rgba(76, 175, 80, 0.4);
    }
    50% {
      background-color: rgba(76, 175, 80, 0.6);
      transform: scale(1.05);
      box-shadow: 0 0 8px 4px rgba(76, 175, 80, 0.3);
    }
    100% {
      background-color: transparent;
      transform: scale(1);
      box-shadow: 0 0 0 0 rgba(76, 175, 80, 0);
    }
  }
</style>