<script lang="ts">
  import { onDestroy } from 'svelte';
  import { dataStore } from '../../stores/dataStore.svelte';
  import { formatNumber } from '../../../../../utils/formatters/priceFormatters';

  // Props using Svelte 5 runes syntax
  const {
    showAnimation = true
  }: {
    showAnimation?: boolean;
  } = $props();

  // Animation state
  let isNewCandle = $state(false);
  let lastCandleCount = $state(0);
  let animationTimeout: NodeJS.Timeout | null = null;

  // 🚀 PHASE 6: Use visibleCount instead of totalCount
  // Shows only candles currently visible in chart viewport, not total loaded
  // This is more useful than showing total DB candles (already shown in "DB:" stat)
  // Updates as user pans/zooms to show what's actually on screen
  const displayCount = $derived(dataStore.stats.visibleCount || 0);

  // Track new candles for animation
  $effect(() => {
    if (displayCount > lastCandleCount && lastCandleCount > 0) {
      if (showAnimation) {
        // ⚡ PHASE 5D: Clear previous timeout and add cleanup
        if (animationTimeout) clearTimeout(animationTimeout);

        isNewCandle = true;
        animationTimeout = setTimeout(() => {
          isNewCandle = false;
          animationTimeout = null;
        }, 1000);
      }
    }
    lastCandleCount = displayCount;
  });

  // ⚡ PHASE 5D: Cleanup timeout on component destroy (prevents memory leaks)
  onDestroy(() => {
    if (animationTimeout) clearTimeout(animationTimeout);
  });
</script>

<span
  class="candle-count"
  class:new-candle={isNewCandle}
>
  {formatNumber(displayCount)}
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