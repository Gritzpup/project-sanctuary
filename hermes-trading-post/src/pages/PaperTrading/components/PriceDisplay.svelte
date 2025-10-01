<script lang="ts">
  import { fly } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  
  export let currentPrice: number = 0;
  export let priceChange24h: number = 0;
  export let priceChangePercent24h: number = 0;
  
  // Clean up - removed debug logs
  
  let prevPrice = currentPrice;
  let prev24hChange = priceChange24h;
  let prev24hPercent = priceChangePercent24h;
  let priceDirection: 'up' | 'down' | 'neutral' = 'neutral';
  let lastDirection: 'up' | 'down' | 'neutral' = 'up'; // Default to green
  let directionTimeout: NodeJS.Timeout | null = null;
  let animatingDigits = new Set<number>();
  let arrows24hAnimating = false;
  
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

  // Handle 24h data changes and trigger arrow animations
  $: {
    if ((priceChange24h !== prev24hChange || priceChangePercent24h !== prev24hPercent) && 
        (priceChange24h !== 0 || priceChangePercent24h !== 0)) {
      
      // Trigger arrow animation
      arrows24hAnimating = true;
      setTimeout(() => {
        arrows24hAnimating = false;
      }, 600);
      
      prev24hChange = priceChange24h;
      prev24hPercent = priceChangePercent24h;
    } else if (priceChange24h !== 0 && prev24hChange === 0) {
      // Initialize when we first get 24h data
      prev24hChange = priceChange24h;
      prev24hPercent = priceChangePercent24h;
    }
  }
  
  $: displayPrice = currentPrice > 0 ? currentPrice : 0;
  
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
    <span class="change-arrow" 
          class:positive={priceChangePercent24h > 0} 
          class:negative={priceChangePercent24h < 0}
          class:animating={arrows24hAnimating}>
      {priceChangePercent24h > 0 ? '↗' : priceChangePercent24h < 0 ? '↘' : '→'}
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
    font-size: 32px;
    margin-right: 2px;
    transition: color var(--transition-fast);
    font-weight: 700;
  }
  
  .price-text {
    display: inline-flex;
    align-items: baseline;
    font-size: 32px;
    font-weight: 700;
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
    font-size: 22px;
    font-family: 'Courier New', monospace;
    font-weight: 600;
  }
  
  .positive {
    color: var(--color-success);
  }
  
  .negative {
    color: var(--color-error);
  }

  .change-arrow {
    font-size: 22px;
    margin-left: 4px;
    transition: all 0.3s ease;
    display: inline-block;
    vertical-align: baseline;
    line-height: 1;
    font-weight: 600;
  }

  .change-arrow.positive {
    color: var(--color-success);
  }

  .change-arrow.negative {
    color: var(--color-error);
  }

  .change-arrow.animating.positive {
    animation: bounceUp 0.6s ease-out;
  }

  .change-arrow.animating.negative {
    animation: bounceDown 0.6s ease-out;
  }

  @keyframes bounceUp {
    0% { transform: translateY(0) scale(1); }
    30% { transform: translateY(-3px) scale(1.1); }
    60% { transform: translateY(1px) scale(1.05); }
    100% { transform: translateY(0) scale(1); }
  }

  @keyframes bounceDown {
    0% { transform: translateY(0) scale(1); }
    30% { transform: translateY(3px) scale(1.1); }
    60% { transform: translateY(-1px) scale(1.05); }
    100% { transform: translateY(0) scale(1); }
  }
</style>