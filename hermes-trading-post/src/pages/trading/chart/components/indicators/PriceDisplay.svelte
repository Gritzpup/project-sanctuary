<script lang="ts">
  import { dataStore } from '../../stores/dataStore.svelte';
  import { formatPrice } from '../../../../../utils/formatters/priceFormatters';

  // Props using Svelte 5 runes syntax
  const {
    precision = 2
  }: {
    precision?: number;
  } = $props();

  // Simple state
  let isNewPrice = $state(false);
  let previousPrice = $state<number | null>(null);

  // Use last candle close price (actual trade price) instead of L2 mid-price
  // L2 mid-price can swing wildly with orderbook spread changes
  // Last candle close is the authoritative price source (from actual trades)
  let currentPrice = $state<number | null>(null);

  $effect.pre(() => {
    // 🔧 FIX: Use last candle's close price instead of L2 mid-price
    // L2 mid-price = (best bid + best ask) / 2, which fluctuates with spread
    // This caused the price display to swing $3000 (77.5k → 80.5k) with orderbook changes
    // Instead, use the real trade price from the last completed/in-progress candle
    if (dataStore.candles && dataStore.candles.length > 0) {
      const lastCandle = dataStore.candles[dataStore.candles.length - 1];
      if (lastCandle && lastCandle.close > 0) {
        currentPrice = lastCandle.close;
      }
    }

    // Initial fallback if no candles yet
    if (!currentPrice && dataStore.latestPrice) {
      currentPrice = dataStore.latestPrice;
    }
  });

  // Reactive display price
  let displayPrice = $derived.by(() => {
    if (currentPrice !== null && currentPrice > 0) {
      return formatPrice(currentPrice, { decimals: precision });
    }
    return 'N/A';
  });

  // Reactive color
  let priceColor = $derived.by(() => {
    if (currentPrice === null || currentPrice <= 0) {
      return '#fff';
    }

    if (previousPrice !== null && previousPrice > 0) {
      if (currentPrice > previousPrice) {
        return '#4caf50'; // Green for up
      } else if (currentPrice < previousPrice) {
        return '#f44336'; // Red for down
      }
    }
    return '#fff'; // White for no change/first load
  });

  // Watch for price changes to trigger animation and update previousPrice
  $effect(() => {
    if (currentPrice !== null && currentPrice > 0 && previousPrice !== null && previousPrice > 0) {
      if (currentPrice !== previousPrice) {
        triggerAnimation();
      }
    }
    if (currentPrice !== null && currentPrice > 0) {
      previousPrice = currentPrice;
    }
  });

  function triggerAnimation() {
    isNewPrice = true;
    setTimeout(() => {
      isNewPrice = false;
    }, 1000);
  }
</script>

<span class="price-display" class:new-price={isNewPrice} style="color: {priceColor};">
  {displayPrice}
</span>

<style>
  .price-display {
    display: inline;
    font-weight: bold;
    transition: all 0.3s ease;
  }

  .price-display.new-price {
    animation: priceFlash 1s ease;
  }

  @keyframes priceFlash {
    0% {
      transform: scale(1);
    }
    50% {
      transform: scale(1.05);
    }
    100% {
      transform: scale(1);
    }
  }
</style>