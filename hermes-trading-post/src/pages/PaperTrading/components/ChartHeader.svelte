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
  
  // Header price debugging
  $: console.log('📊 CHART HEADER RECEIVED:', { currentPrice, priceChange24h, priceChangePercent24h });
  
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
  
  const granularityOptions = [
    { value: '1m', label: '1m' },
    { value: '5m', label: '5m' },
    { value: '15m', label: '15m' },
    { value: '1h', label: '1h' },
    { value: '6h', label: '6h' },
    { value: '1D', label: '1D' }
  ];
</script>

<div class="chart-header">
  <div class="header-left">
    <select 
      class="btn-base btn-timeframe pair-selector" 
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
      <span class="magnifier-icon">🔍</span>
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
  
  .magnifier-icon {
    font-size: var(--font-size-lg);
    opacity: 0.7;
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
    gap: var(--space-xs);
  }
  
  .timeframe-buttons .btn-timeframe {
    height: 32px;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-medium);
    border: 1px solid var(--border-primary);
    background: var(--bg-primary);
    color: var(--text-primary);
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 40px;
  }
  
  .pair-selector {
    height: 32px;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-medium);
    border: 1px solid var(--border-primary);
    background: var(--bg-primary);
    color: var(--text-primary);
    min-width: 150px;
    appearance: none;
    background-image: url('data:image/svg+xml;charset=US-ASCII,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 5"><path fill="%23a78bfa" d="M2 0L0 2h4zm0 5L0 3h4z"/></svg>');
    background-repeat: no-repeat;
    background-position: right 8px center;
    background-size: 8px;
    padding-right: 24px;
  }
  
  .pair-selector option {
    background: var(--bg-secondary);
    color: var(--text-primary);
    padding: var(--space-sm);
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