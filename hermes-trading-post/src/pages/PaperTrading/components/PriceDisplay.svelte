<script lang="ts">
  import { fly } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  
  export let currentPrice: number = 0;
  export let priceChange24h: number = 0;
  export let priceChangePercent24h: number = 0;
  
  // Header price debugging
  $: if (currentPrice === 0) console.log('❌ HEADER PRICE: currentPrice is 0 - no data flowing');
  
  let prevPrice = currentPrice;
  let priceDirection: 'up' | 'down' | 'neutral' = 'neutral';
  let lastDirection: 'up' | 'down' | 'neutral' = 'up'; // Default to green
  let directionTimeout: NodeJS.Timeout | null = null;
  let animatingDigits = new Set<number>();
  
  $: {
    if (currentPrice !== prevPrice && currentPrice > 0 && prevPrice > 0) {
      const newDirection = currentPrice > prevPrice ? 'up' : 'down';
      priceDirection = newDirection;
      lastDirection = newDirection; // Remember the last direction
      
      // Find which digits changed for animation
      const oldStr = prevPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const newStr = currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      animatingDigits.clear();
      
      for (let i = 0; i < Math.max(oldStr.length, newStr.length); i++) {
        if (oldStr[i] !== newStr[i] && /[0-9]/.test(newStr[i] || '')) {
          animatingDigits.add(i);
        }
      }
      
      prevPrice = currentPrice;
      console.log(`💹 Price ${newDirection}: ${prevPrice} → ${currentPrice}`);
      
      // Clear existing timeout
      if (directionTimeout) {
        clearTimeout(directionTimeout);
      }
      
      // Keep the color longer, don't reset to neutral - stay colored
      directionTimeout = setTimeout(() => {
        // Keep the last direction color instead of going neutral
        animatingDigits.clear();
      }, 1200);
    } else if (currentPrice > 0 && prevPrice === 0) {
      // Initialize prevPrice when we first get data
      prevPrice = currentPrice;
    }
  }
  
  $: displayPrice = currentPrice > 0 ? currentPrice : 0;
  $: console.log('💰 PriceDisplay: currentPrice =', currentPrice, 'displayPrice =', displayPrice);
  
  // Use current direction or last direction if we're between updates
  $: displayDirection = priceDirection !== 'neutral' ? priceDirection : lastDirection;
  
  // Split price into individual characters for digit animation
  $: formattedPriceString = displayPrice.toLocaleString('en-US', { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2 
  });
  $: priceChars = formattedPriceString.split('');
</script>

<div class="bitcoin-price">
  <span class="price-container" class:price-up={displayDirection === 'up'} class:price-down={displayDirection === 'down'}>
    <span class="price-symbol" class:price-up={displayDirection === 'up'} class:price-down={displayDirection === 'down'}>$</span>
    <span class="price-text">
      {#each priceChars as char, i (i)}
        {#if char === ','}
          <span class="price-comma" class:price-up={displayDirection === 'up'} class:price-down={displayDirection === 'down'}>,</span>
        {:else if char === '.'}
          <span class="price-dot" class:price-up={displayDirection === 'up'} class:price-down={displayDirection === 'down'}>.</span>
        {:else}
          <span 
            class="price-digit" 
            class:price-up={displayDirection === 'up'} 
            class:price-down={displayDirection === 'down'}
            class:animating={animatingDigits.has(i)}
          >
            {#key char}
              <span 
                class="digit-inner"
                in:fly={{ y: priceDirection === 'up' ? 10 : -10, duration: 150, easing: cubicOut }}
                out:fly={{ y: priceDirection === 'up' ? -10 : 10, duration: 150, easing: cubicOut }}
              >
                {char}
              </span>
            {/key}
          </span>
        {/if}
      {/each}
    </span>
  </span>
  
  <div class="price-change">
    <span class="change-24h" class:positive={priceChange24h > 0} class:negative={priceChange24h < 0}>
      {priceChange24h > 0 ? '+' : ''}{priceChange24h.toFixed(2)}
    </span>
    <span class="change-percent" class:positive={priceChangePercent24h > 0} class:negative={priceChangePercent24h < 0}>
      ({priceChangePercent24h > 0 ? '+' : ''}{priceChangePercent24h.toFixed(2)}%)
    </span>
  </div>
</div>

<style>
  .bitcoin-price {
    display: flex;
    align-items: center;
    gap: var(--space-md);
  }
  
  .price-container {
    display: flex;
    align-items: center;
    font-family: 'Courier New', monospace;
    font-weight: var(--font-weight-medium);
    transition: color var(--transition-fast);
  }
  
  .price-symbol {
    font-size: var(--font-size-2xl);
    margin-right: 2px;
    transition: color var(--transition-fast);
  }
  
  .price-text {
    display: inline-flex;
    align-items: baseline;
    font-size: var(--font-size-2xl);
  }
  
  .price-digit {
    display: inline-block;
    position: relative;
    overflow: hidden;
    height: 1.2em;
    transition: color var(--transition-fast);
  }
  
  .digit-inner {
    display: block;
  }
  
  .price-comma,
  .price-dot {
    display: inline-block;
    color: var(--text-primary);
    transition: color var(--transition-fast);
  }
  
  .price-up {
    color: var(--color-success) !important;
  }
  
  .price-down {
    color: var(--color-error) !important;
  }
  
  /* Ensure the price stays colored and never goes white */
  .price-container {
    color: var(--text-primary);
  }
  
  /* Only apply neutral color if there's no direction at all */
  .price-container:not(.price-up):not(.price-down) .price-digit,
  .price-container:not(.price-up):not(.price-down) .price-comma,
  .price-container:not(.price-up):not(.price-down) .price-dot,
  .price-container:not(.price-up):not(.price-down) .price-symbol {
    color: var(--text-primary) !important;
  }
  
  .animating {
    /* Remove font-weight change to avoid brightness differences */
  }
  
  .price-container {
    color: var(--text-primary);
  }
  
  .price-change {
    display: flex;
    gap: var(--space-xs);
    font-size: var(--font-size-sm);
    font-family: 'Courier New', monospace;
  }
  
  .positive {
    color: var(--color-success);
  }
  
  .negative {
    color: var(--color-error);
  }
</style>