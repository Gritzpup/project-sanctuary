<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { PAIR_OPTIONS, GRANULARITY_OPTIONS, type PairOption, type GranularityOption } from './ChartHeaderTypes';
  
  export let selectedPair: string = 'BTC-USD';
  export let selectedGranularity: string = '1m';
  
  const dispatch = createEventDispatcher();

  function handlePairChange() {
    dispatch('pairChange', { pair: selectedPair });
  }

  function handleGranularityChange(granularity: string) {
    dispatch('granularityChange', { granularity });
  }

  function handleZoomReset() {
    dispatch('zoomReset');
  }
</script>

<div class="left-controls">
  <select 
    class="select-base btn-chart-control speed-dropdown pair-selector" 
    bind:value={selectedPair} 
    on:change={handlePairChange}
    title={PAIR_OPTIONS.find(p => p.value === selectedPair)?.label || selectedPair}
  >
    {#each PAIR_OPTIONS as option}
      <option value={option.value}>{option.label}</option>
    {/each}
  </select>
  
  <button class="magnifier-btn" on:click={handleZoomReset} title="Reset zoom to 60 candles">
    <span class="magnifier-icon">🔍</span>
  </button>
  
  <div class="timeframe-separator"></div>
  
  <div class="timeframe-buttons">
    {#each GRANULARITY_OPTIONS as option}
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

<style>
  .left-controls {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
  }

  .pair-selector {
    min-width: 140px;
    height: 28px;
    font-size: 12px;
    padding: 4px 8px;
    appearance: none;
    background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%23c4b5fd' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e");
    background-position: right 8px center;
    background-repeat: no-repeat;
    background-size: 14px;
    padding-right: 28px;
    border: 1px solid var(--border-primary);
    background-color: var(--bg-primary);
    color: #c4b5fd;
    border-radius: 4px;
  }

  .magnifier-btn {
    width: 28px;
    height: 28px;
    border: 1px solid var(--border-primary);
    background: var(--bg-primary);
    color: #c4b5fd;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    font-size: 14px;
    transition: all 0.2s ease;
  }

  .magnifier-btn:hover {
    background: rgba(74, 0, 224, 0.2);
    border-color: rgba(74, 0, 224, 0.5);
  }

  .timeframe-separator {
    width: 1px;
    height: 20px;
    background: var(--border-primary);
    margin: 0 4px;
  }

  .timeframe-buttons {
    display: flex;
    gap: 4px;
  }

  .btn-timeframe {
    height: 28px;
    min-width: 32px;
    padding: 2px 6px;
    font-size: 11px;
    font-weight: 500;
    border: 1px solid var(--border-primary);
    background: var(--bg-primary);
    color: #c4b5fd;
    border-radius: 4px;
    transition: all 0.2s ease;
  }

  .btn-timeframe.active {
    background: rgba(74, 0, 224, 0.4);
    color: white;
    border-color: rgba(74, 0, 224, 0.7);
    box-shadow: inset 0 2px 4px rgba(74, 0, 224, 0.5);
    font-weight: 600;
  }

  .btn-timeframe:hover {
    background: rgba(74, 0, 224, 0.2);
    border-color: rgba(74, 0, 224, 0.5);
    color: white;
  }

  /* Mobile adjustments */
  @media (max-width: 768px) {
    .left-controls {
      gap: var(--space-xs);
    }
    
    .pair-selector {
      min-width: 120px;
      font-size: 11px;
    }
    
    .btn-timeframe {
      min-width: 28px;
      padding: 2px 4px;
      font-size: 10px;
    }
    
    .magnifier-btn {
      width: 24px;
      height: 24px;
      font-size: 12px;
    }
  }
</style>