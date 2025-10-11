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

  // Simple reactive price display
  let displayPrice = $state('N/A');
  let priceColor = $state('#fff');

  // Update price display when dataStore changes
  $effect(() => {
    const currentPrice = dataStore.latestPrice;
    
    if (currentPrice !== null && currentPrice > 0) {
      // Format the price
      displayPrice = formatPrice(currentPrice, { decimals: precision });
      
      // Determine color based on change
      if (previousPrice !== null && previousPrice > 0) {
        if (currentPrice > previousPrice) {
          priceColor = '#4caf50'; // Green for up
          triggerAnimation();
        } else if (currentPrice < previousPrice) {
          priceColor = '#f44336'; // Red for down
          triggerAnimation();
        }
      } else {
        priceColor = '#fff'; // White for no change/first load
      }
      
      previousPrice = currentPrice;
    } else {
      displayPrice = 'N/A';
      priceColor = '#fff';
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