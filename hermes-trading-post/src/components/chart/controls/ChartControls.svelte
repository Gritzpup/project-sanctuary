<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  
  export let selectedGranularity: string = '1m';
  export let selectedPeriod: string = '1H';
  export let isLoadingChart: boolean = false;
  export let isPaperTestMode: boolean = false;
  export let lockedTimeframe: boolean = false;
  
  const dispatch = createEventDispatcher();
  
  // Valid granularity combinations per period
  const validGranularities: Record<string, string[]> = {
    '1H': ['1m'],
    '4H': ['1m', '5m'],
    '5D': ['1m', '5m', '15m'],
    '1M': ['5m', '15m', '1h'],
    '3M': ['15m', '1h', '6h'],
    '6M': ['1h', '6h', '1D'],
    '1Y': ['6h', '1D'],
    '5Y': ['1D']
  };
  
  const granularityLabels: Record<string, string> = {
    '1m': '1m',
    '5m': '5m',
    '15m': '15m',
    '1h': '1h',
    '6h': '6h',
    '1D': '1D'
  };
  
  const periodLabels: Record<string, string> = {
    '1H': '1H',
    '4H': '4H',
    '5D': '5D',
    '1M': '1M',
    '3M': '3M',
    '6M': '6M',
    '1Y': '1Y',
    '5Y': '5Y'
  };
  
  function isGranularityValid(granularity: string, period: string): boolean {
    return validGranularities[period]?.includes(granularity) || false;
  }
  
  function selectGranularity(granularity: string) {
    if (lockedTimeframe || !isGranularityValid(granularity, selectedPeriod)) return;
    selectedGranularity = granularity;
    dispatch('granularityChange', { granularity });
  }
  
  function selectPeriod(period: string) {
    if (lockedTimeframe) return;
    
    selectedPeriod = period;
    
    // Auto-select valid granularity if current one is invalid
    if (!isGranularityValid(selectedGranularity, period)) {
      const validOptions = validGranularities[period];
      if (validOptions && validOptions.length > 0) {
        const middleIndex = Math.floor(validOptions.length / 2);
        selectedGranularity = validOptions[middleIndex];
      }
    }
    
    dispatch('periodChange', { period });
  }
  
  function clearCache() {
    dispatch('clearCache');
  }
  
  function resetZoom() {
    dispatch('resetZoom');
  }
</script>

<div class="chart-controls">
  <!-- Granularity buttons -->
  <div class="granularity-buttons">
    {#each Object.entries(granularityLabels) as [value, label]}
      <button 
        class="granularity-btn" 
        class:active={selectedGranularity === value}
        class:disabled={!isGranularityValid(value, selectedPeriod) || lockedTimeframe}
        on:click={() => selectGranularity(value)}
        disabled={!isGranularityValid(value, selectedPeriod) || lockedTimeframe}
      >
        {label}
      </button>
    {/each}
  </div>
  
  <!-- Period buttons -->
  <div class="period-buttons">
    {#each Object.entries(periodLabels) as [value, label]}
      <button 
        class="period-btn" 
        class:active={selectedPeriod === value}
        class:disabled={lockedTimeframe}
        on:click={() => selectPeriod(value)}
        disabled={lockedTimeframe}
      >
        {label}
      </button>
    {/each}
  </div>
  
  <!-- Action buttons -->
  <div class="action-buttons">
    <button class="action-btn" on:click={resetZoom} disabled={lockedTimeframe}>
      Reset Zoom
    </button>
    <button class="action-btn" on:click={clearCache} disabled={isPaperTestMode}>
      Clear Cache
    </button>
  </div>
  
  {#if isLoadingChart}
    <div class="loading-indicator">
      Loading...
    </div>
  {/if}
</div>

<style>
  .chart-controls {
    display: flex;
    gap: 20px;
    align-items: center;
    padding: 10px;
    background: rgba(0, 0, 0, 0.5);
    border-bottom: 1px solid rgba(74, 0, 224, 0.3);
  }
  
  .granularity-buttons,
  .period-buttons,
  .action-buttons {
    display: flex;
    gap: 5px;
  }
  
  .granularity-btn,
  .period-btn,
  .action-btn {
    padding: 6px 12px;
    background: rgba(74, 0, 224, 0.1);
    border: 1px solid rgba(74, 0, 224, 0.3);
    border-radius: 4px;
    color: #9ca3af;
    cursor: pointer;
    font-size: 12px;
    transition: all 0.2s;
  }
  
  .granularity-btn:hover:not(:disabled),
  .period-btn:hover:not(:disabled),
  .action-btn:hover:not(:disabled) {
    background: rgba(74, 0, 224, 0.2);
    border-color: rgba(74, 0, 224, 0.5);
  }
  
  .granularity-btn.active,
  .period-btn.active {
    background: rgba(74, 0, 224, 0.3);
    border-color: rgba(74, 0, 224, 0.6);
    color: #a78bfa;
  }
  
  .granularity-btn:disabled,
  .period-btn:disabled,
  .action-btn:disabled,
  .granularity-btn.disabled,
  .period-btn.disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }
  
  .loading-indicator {
    margin-left: auto;
    color: #ffa726;
    font-size: 12px;
  }
</style>