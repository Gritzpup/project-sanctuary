<script lang="ts">
  import { dataStore } from '../../stores/dataStore.svelte';
  import { orderbookStore } from '../../../orderbook/stores/orderbookStore.svelte';
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

  // Subscribe to direct L2 prices on mount (instant, no lag)
  // Falls back to dataStore if L2 not available
  let currentPrice = $state<number | null>(null);

  $effect.pre(() => {
    // Subscribe to L2 prices directly
    const unsubscribe = orderbookStore.subscribeToPriceUpdates((price: number) => {
      if (price > 0) {
        // Update current price instantly from L2
        currentPrice = price;
      }
    });

    // Fallback to dataStore price if no L2 price yet
    if (!currentPrice && dataStore.latestPrice) {
      currentPrice = dataStore.latestPrice;
    }

    // Cleanup subscription on unmount
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
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