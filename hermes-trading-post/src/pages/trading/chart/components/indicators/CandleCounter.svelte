<script lang="ts">
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

  // ✅ REACTIVE: Use dataStore.stats.totalCount directly for instant updates
  // No need to query chart - dataStore already has the count and updates instantly
  const displayCount = $derived(dataStore.stats.totalCount || 0);

  // Track new candles for animation
  $effect(() => {
    if (displayCount > lastCandleCount && lastCandleCount > 0) {
      if (showAnimation) {
        isNewCandle = true;
        setTimeout(() => {
          isNewCandle = false;
        }, 1000);
      }
    }
    lastCandleCount = displayCount;
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