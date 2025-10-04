<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { EXTENDED_PERIODS, type ExtendedPeriod } from '../../../../lib/chart/TimeframeCompatibility';
  import { isCompatible, getBestGranularityForPeriod } from '../../../../lib/chart/TimeframeCompatibility';
  
  export let selectedPeriod: string = '1H';
  export let selectedGranularity: string = '1m';
  
  const dispatch = createEventDispatcher();

  function handlePeriodChange(period: ExtendedPeriod) {
    // Find the best compatible granularity for this period
    const bestGranularity = getBestGranularityForPeriod(period);
    
    dispatch('periodChange', { period });
    
    // If current granularity is not compatible, switch to the best one
    if (!isCompatible(selectedGranularity, period)) {
      dispatch('granularityChange', { granularity: bestGranularity });
    }
  }
</script>

<div class="period-buttons">
  {#each EXTENDED_PERIODS as period}
    <button 
      class="btn-base btn-sm btn-timeframe"
      class:active={selectedPeriod === period}
      on:click={() => handlePeriodChange(period)}
    >
      {period}
    </button>
  {/each}
</div>

<style>
  .period-buttons {
    display: flex;
    gap: var(--space-sm);
    margin-top: 12px;
  }
  
  /* Match actual header button proportions exactly */
  .period-buttons .btn-timeframe {
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
    margin: 0;
    display: flex;
    align-items: center;
    justify-content: center;
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

  
  /* Mobile adjustments - match header button mobile styles */
  @media (max-width: 768px) {
    .period-buttons .btn-timeframe {
      min-width: 28px;
      padding: 2px 4px;
      font-size: 10px;
    }
    
    /* Move timescale buttons up to align with calendar button */
    .period-buttons {
      transform: translateY(-2px);
    }
  }
</style>