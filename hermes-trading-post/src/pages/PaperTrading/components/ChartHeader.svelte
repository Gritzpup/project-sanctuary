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
  <div class="header-left">
    <select 
      class="select-base btn-chart-control speed-dropdown pair-selector" 
      bind:value={selectedPair} 
      on:change={() => handlePairChange(selectedPair)}
    >
      {#each pairOptions as option}
        <option value={option.value}>{option.label}</option>
      {/each}
    </select>
    
    <PriceDisplay 
      {currentPrice}
      {priceChange24h}
      {priceChangePercent24h}
    />
  </div>
  
  <div class="header-center">
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
  
  <div class="header-right">
    <div class="timeframe-controls">
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
  </div>
</div>

<style>
  .chart-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-lg) var(--space-xl);
    background: var(--bg-primary-subtle);
    border-bottom: 1px solid var(--border-primary);
  }
  
  .header-left {
    flex: 1;
    display: flex;
    align-items: center;
    gap: var(--space-lg);
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
    height: 24px;
    background: var(--border-primary);
    opacity: 1;
    border-radius: 1px;
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
  
  .pair-selector {
    height: 32px !important;
    padding: 4px 8px !important;
    border-radius: 4px !important;
    font-size: var(--font-size-sm) !important;
    font-weight: var(--font-weight-medium) !important;
    min-width: 150px;
    background: var(--bg-primary) !important;
    color: #c4b5fd !important;
    border: 1px solid var(--border-primary) !important;
    appearance: none !important;
    background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%23ffffff' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e") !important;
    background-position: right 8px center !important;
    background-repeat: no-repeat !important;
    background-size: 16px !important;
    padding-right: 32px !important;
    transition: all 0.2s ease !important;
  }
  
  .pair-selector:hover {
    background: rgba(74, 0, 224, 0.2) !important;
    border-color: rgba(74, 0, 224, 0.5) !important;
    color: white !important;
  }
  
  .pair-selector option {
    font-weight: var(--font-weight-medium) !important;
  }
  
  .pair-selector {
    font-weight: var(--font-weight-medium) !important;
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
</style>