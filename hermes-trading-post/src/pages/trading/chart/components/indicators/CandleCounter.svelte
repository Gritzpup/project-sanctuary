<script lang="ts">
  import { onMount, onDestroy, getContext } from 'svelte';
  import { formatNumber } from '../../../../../utils/formatters/priceFormatters';
  import type { IChartApi } from 'lightweight-charts';

  // Props using Svelte 5 runes syntax
  const {
    showAnimation = true
  }: {
    showAnimation?: boolean;
  } = $props();

  // Animation state
  let isNewCandle = $state(false);
  let lastCandleCount = $state(0);
  let visibleCandleCount = $state(60); // Default to 60
  
  // Get chart context
  let chartContext: any = null;
  try {
    chartContext = getContext('chart');
  } catch (error) {
    console.log('CandleCounter: No chart context available');
  }
  
  // Simple function to count visible candles
  function updateVisibleCount() {
    try {
      const chart = chartContext?.getChart?.() as IChartApi | null;
      if (!chart) {
        return;
      }
      
      const logicalRange = chart.timeScale().getVisibleLogicalRange();
      if (logicalRange) {
        const count = Math.ceil(logicalRange.to - logicalRange.from);
        if (count > 0 && count < 10000) { // Sanity check
          visibleCandleCount = count;
        }
      }
    } catch (error) {
      // Silently fail
    }
  }

  // Track new candles for animation
  $effect(() => {
    if (visibleCandleCount > lastCandleCount && lastCandleCount > 0) {
      if (showAnimation) {
        isNewCandle = true;
        setTimeout(() => {
          isNewCandle = false;
        }, 1000);
      }
    }
    lastCandleCount = visibleCandleCount;
  });

  onMount(() => {
    // 🚀 PERF: Update every 1000ms instead of 500ms to reduce re-renders
    // This prevents excessive DOM updates while still providing responsive feedback
    const interval = setInterval(updateVisibleCount, 1000);

    return () => {
      clearInterval(interval);
    };
  });
</script>

<span 
  class="candle-count" 
  class:new-candle={isNewCandle}
>
  {formatNumber(visibleCandleCount)}
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