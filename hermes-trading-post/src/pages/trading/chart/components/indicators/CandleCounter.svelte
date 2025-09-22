<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { dataStore } from '../../stores/dataStore.svelte';
  import { formatNumber } from '../../utils/priceFormatters';

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

  // Get actual candle count (prefers chart data over store data)
  function getActualCandleCount(): number {
    // Try to get from chart context first (most accurate)
    try {
      const chartContext = dataStore.chart;
      if (chartContext?.data && Array.isArray(chartContext.data)) {
        return chartContext.data.length;
      }
    } catch (error) {
      // Fallback to dataStore
    }
    
    // Fallback to dataStore
    return dataStore.stats.totalCount || 0;
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