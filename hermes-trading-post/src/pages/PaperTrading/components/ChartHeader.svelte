<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import PriceDisplay from './PriceDisplay.svelte';
  
  export let selectedPair = 'BTC-USD';
  export let currentPrice: number = 0;
  export let priceChange24h: number = 0;
  export let priceChangePercent24h: number = 0;
  export let botTabs: any[] = [];
  export let activeBotInstance: any = null;
  export let selectedGranularity = '1m';
  
  const dispatch = createEventDispatcher();
  
  // Clean up - removed debug logs
  
  const pairOptions = [
    { value: 'BTC-USD', label: 'BTC/USD Chart' },
    { value: 'ETH-USD', label: 'ETH/USD Chart' },
    { value: 'PAXG-USD', label: 'PAXG/USD Chart' }
  ];
  
  function handlePairChange(pair: string) {
    dispatch('pairChange', { pair });
  }
  
  function handleBotSelect(botId: string) {
    dispatch('botSelect', { botId });
  }
  
  function handleGranularityChange(granularity: string) {
    dispatch('granularityChange', { granularity });
  }

  function handleZoomReset() {
    dispatch('zoomReset');
  }

  // Mobile drag scroll functionality for header row 2
  let isDraggingHeader = false;
  let startXHeader = 0;
  let scrollLeftHeader = 0;
  let headerRow2: HTMLElement;

  function handleHeaderDragStart(event: MouseEvent | TouchEvent) {
    if (window.innerWidth > 768) return; // Only on mobile
    
    isDraggingHeader = true;
    const clientX = event instanceof TouchEvent ? event.touches[0].clientX : event.clientX;
    startXHeader = clientX - headerRow2.offsetLeft;
    scrollLeftHeader = headerRow2.scrollLeft;
    headerRow2.style.cursor = 'grabbing';
  }

  function handleHeaderDragMove(event: MouseEvent | TouchEvent) {
    if (!isDraggingHeader || window.innerWidth > 768) return;
    
    event.preventDefault();
    const clientX = event instanceof TouchEvent ? event.touches[0].clientX : event.clientX;
    const x = clientX - headerRow2.offsetLeft;
    const walk = (x - startXHeader) * 2; // Scroll speed multiplier
    headerRow2.scrollLeft = scrollLeftHeader - walk;
  }

  function handleHeaderDragEnd() {
    if (!isDraggingHeader) return;
    isDraggingHeader = false;
    headerRow2.style.cursor = 'grab';
  }
  
  const granularityOptions = [
    { value: '1m', label: '1m' },
    { value: '5m', label: '5m' },
    { value: '15m', label: '15m' },
    { value: '1h', label: '1H' },
    { value: '6h', label: '6h' },
    { value: '1D', label: '1D' }
  ];
</script>

<div class="chart-header">
  <div class="header-row-1">
    <div class="price-section">
      <PriceDisplay 
        {currentPrice}
        {priceChange24h}
        {priceChangePercent24h}
      />
    </div>
    
    <div class="bot-section">
      {#if botTabs.length > 0}
        <div class="bot-tabs">
          {#each botTabs as bot}
            <button 
              class="btn-base btn-xs"
              class:active={activeBotInstance?.id === bot.id}
              on:click={() => handleBotSelect(bot.id)}
            >
              {bot.name}
              <span class="status-dot status-{bot.status}"></span>
            </button>
          {/each}
        </div>
      {/if}
    </div>
  </div>
  
  <div 
    class="header-row-2" 
    bind:this={headerRow2}
    on:mousedown={handleHeaderDragStart}
    on:mousemove={handleHeaderDragMove}
    on:mouseup={handleHeaderDragEnd}
    on:mouseleave={handleHeaderDragEnd}
    on:touchstart={handleHeaderDragStart}
    on:touchmove={handleHeaderDragMove}
    on:touchend={handleHeaderDragEnd}
  >
    <div class="left-controls">
      <select 
        class="select-base btn-chart-control speed-dropdown pair-selector" 
        bind:value={selectedPair} 
        on:change={() => handlePairChange(selectedPair)}
        title={pairOptions.find(p => p.value === selectedPair)?.label || selectedPair}
      >
        {#each pairOptions as option}
          <option value={option.value}>{option.label}</option>
        {/each}
      </select>
      <button class="magnifier-btn" on:click={handleZoomReset} title="Reset zoom to 60 candles">
        <span class="magnifier-icon">🔍</span>
      </button>
      <div class="timeframe-separator"></div>
      <div class="timeframe-buttons">
        {#each granularityOptions as option}
          <button 
            class="btn-base btn-sm btn-timeframe"
            class:active={selectedGranularity === option.value}
            on:click={() => handleGranularityChange(option.value)}
          >
            {option.label}
          </button>
        {/each}
      </div>
    </div>
    <div class="bot-section">
      {#if botTabs.length > 0}
        <div class="bot-tabs">
          {#each botTabs as bot}
            <button 
              class="btn-base btn-xs"
              class:active={activeBotInstance?.id === bot.id}
              on:click={() => handleBotSelect(bot.id)}
            >
              {bot.name}
              <span class="status-dot status-{bot.status}"></span>
            </button>
          {/each}
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .chart-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-md) var(--space-xl) var(--space-lg) var(--space-xl);
    background: var(--bg-primary-subtle);
    border-bottom: 1px solid var(--border-primary);
    min-height: 90px;
    box-sizing: border-box;
  }

  /* Mobile-only: Switch to two-row layout */
  @media (max-width: 768px) {
    .chart-header {
      flex-direction: column;
      gap: var(--space-sm);
    }

    .header-row-1 {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex: 1;
      width: 100%;
    }

    .header-row-2 {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex: 0 0 auto;
      width: 100%;
    }
  }

  /* Desktop: Keep two-row structure but adjust layout */
  @media (min-width: 769px) {
    .chart-header {
      flex-direction: column;
      gap: var(--space-sm);
    }

    .header-row-1 {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex: 1;
      width: 100%;
    }

    .header-row-2 {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex: 0 0 auto;
      width: 100%;
    }
  }
  
  .left-controls {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
  }
  
  .price-section {
    display: flex;
    align-items: center;
  }

  .bot-section {
    display: flex;
    align-items: center;
  }
  
  .header-center {
    flex: 2;
    display: flex;
    justify-content: center;
  }
  
  .header-right {
    flex: 1;
    display: flex;
    justify-content: flex-end;
    align-items: center;
  }
  
  .timeframe-controls {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
  }
  
  .magnifier-btn {
    background: none;
    border: none;
    padding: 6px;
    cursor: pointer;
    border-radius: 4px;
    transition: background-color 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-left: var(--space-xs);
  }

  .magnifier-btn:hover {
    background: rgba(74, 0, 224, 0.2);
  }

  .magnifier-icon {
    font-size: var(--font-size-lg);
    opacity: 0.7;
    color: #c4b5fd;
  }

  .magnifier-btn:hover .magnifier-icon {
    opacity: 1;
    color: white;
  }
  
  .timeframe-separator {
    width: 2px;
    height: 32px;
    background: var(--border-primary);
    opacity: 1;
    border-radius: 1px;
    margin-left: var(--space-xs);
    margin-right: var(--space-xs);
  }
  
  .timeframe-buttons {
    display: flex;
    gap: var(--space-sm);
  }
  
  .timeframe-buttons .btn-timeframe {
    height: 32px;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-medium);
    border: 1px solid var(--border-primary);
    background: var(--bg-primary);
    color: #c4b5fd;
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 40px;
    transition: all 0.2s ease;
  }

  .timeframe-buttons .btn-timeframe.active {
    background: rgba(74, 0, 224, 0.4);
    color: white;
    border-color: rgba(74, 0, 224, 0.7);
    box-shadow: inset 0 2px 4px rgba(74, 0, 224, 0.5);
    font-weight: 600;
  }

  .timeframe-buttons .btn-timeframe:hover {
    background: rgba(74, 0, 224, 0.2);
    border-color: rgba(74, 0, 224, 0.5);
    color: white;
  }
  
  .left-controls .pair-selector {
    height: 32px;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: var(--font-size-sm);
    font-weight: 500;
    min-width: 150px;
    background: var(--bg-primary);
    color: #c4b5fd;
    border: 1px solid var(--border-primary);
    appearance: none;
    background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%23ffffff' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e");
    background-position: right 8px center;
    background-repeat: no-repeat;
    background-size: 16px;
    padding-right: 32px;
  }
  
  .left-controls .pair-selector:hover {
    background: rgba(74, 0, 224, 0.2);
    border-color: rgba(74, 0, 224, 0.5);
    color: white;
    background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%23ffffff' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e");
    background-position: right 8px center;
    background-repeat: no-repeat;
    background-size: 16px;
  }
  
  .left-controls .pair-selector:focus {
    background: rgba(74, 0, 224, 0.2);
    border-color: rgba(74, 0, 224, 0.5);
    color: white;
    background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%23ffffff' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e");
    background-position: right 8px center;
    background-repeat: no-repeat;
    background-size: 16px;
    outline: none;
  }
  
  .left-controls .pair-selector option {
    font-weight: var(--font-weight-medium);
  }
  
  
  .bot-tabs {
    display: flex;
    gap: 2px;
  }
  
  .status-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    margin-left: var(--space-xs);
  }

  /* Mobile responsive - show full text */
  @media (max-width: 768px) {
    .left-controls .pair-selector {
      min-width: 120px;
      width: auto;
      padding: 4px 32px 4px 8px;
      text-indent: 0; /* Show text */
      background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%23c4b5fd' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='m6 8 4 4 4-4'/%3e%3c/svg%3e");
      background-position: right 8px center;
      background-size: 14px;
    }

    .left-controls .pair-selector option {
      text-indent: 0; /* Show text in options */
      padding: 8px 12px;
    }
    
    /* Enable horizontal scrolling for header row 2 */
    .chart-header .header-row-2 {
      overflow-x: auto;
      overflow-y: hidden;
      scroll-behavior: smooth;
      scrollbar-width: none; /* Firefox */
      -ms-overflow-style: none; /* IE/Edge */
      cursor: grab;
      display: flex;
      justify-content: flex-start;
      white-space: nowrap;
    }
    
    .chart-header .left-controls {
      flex-shrink: 0;
      white-space: nowrap;
    }
    
    .chart-header .header-row-2::-webkit-scrollbar {
      display: none; /* Chrome/Safari */
    }
    
    .chart-header .header-row-2:active {
      cursor: grabbing;
    }
    
    .chart-header .timeframe-separator {
      cursor: grab;
      user-select: none;
    }
    
    .chart-header .timeframe-separator:active {
      cursor: grabbing;
    }
  }
</style>