<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { EXTENDED_PERIODS, type ExtendedPeriod } from '../../../../lib/chart/TimeframeCompatibility';
  import { isCompatible, getBestGranularityForPeriod } from '../../../../lib/chart/TimeframeCompatibility';

  onMount(() => {
    console.log('🎯 [PaperTrading:TimeframeControls] COMPONENT MOUNTED');
    console.log(`Available periods: ${EXTENDED_PERIODS.join(', ')}`);
    console.log(`Current period: ${selectedPeriod}`);

    // Add a click listener to the period-buttons container to catch all clicks
    const container = document.querySelector('.period-buttons');
    if (container) {
      console.log(`✅ [PaperTrading:TimeframeControls] Found .period-buttons container, adding global click listener`);
      const buttons = container.querySelectorAll('button');
      console.log(`📍 [PaperTrading:TimeframeControls] Found ${buttons.length} buttons`);
      buttons.forEach((btn, idx) => {
        btn.addEventListener('click', () => {
          console.log(`🖱️ [Global Listener] GLOBAL CLICK on button ${idx}: ${btn.textContent}`);
        });
      });
    } else {
      console.warn(`❌ [PaperTrading:TimeframeControls] Could not find .period-buttons container`);
    }
  });

  export let selectedPeriod: string = '1H';
  export let selectedGranularity: string = '1m';

  const dispatch = createEventDispatcher();
  let isDebouncing = false;
  let debounceTimer: number | null = null;

  function handlePeriodChange(period: ExtendedPeriod) {
    console.log(`🎯 [PaperTrading:TimeframeControls] Button clicked: ${period}`);
    console.log(`📢 [PaperTrading:TimeframeControls] dispatch object:`, dispatch);
    // Prevent multiple rapid clicks - debounce with 200ms window
    if (isDebouncing) {
      console.log(`🔒 [PaperTrading:TimeframeControls] Click blocked - debouncing`);
      return;
    }

    isDebouncing = true;

    // Clear existing timer if any
    if (debounceTimer !== null) {
      clearTimeout(debounceTimer);
    }

    // Find the best compatible granularity for this period
    const bestGranularity = getBestGranularityForPeriod(period);

    console.log(`📤 [PaperTrading:TimeframeControls] About to dispatch 'periodChange' with:`, { period });
    try {
      const result = dispatch('periodChange', { period });
      console.log(`✅ [PaperTrading:TimeframeControls] Dispatch returned:`, result);
    } catch (err) {
      console.error(`❌ [PaperTrading:TimeframeControls] Dispatch error:`, err);
    }

    // If current granularity is not compatible, switch to the best one
    if (!isCompatible(selectedGranularity, period)) {
      dispatch('granularityChange', { granularity: bestGranularity });
    }

    // Reset debounce after 200ms
    debounceTimer = window.setTimeout(() => {
      isDebouncing = false;
      debounceTimer = null;
    }, 200);
  }
</script>

<div class="period-buttons">
  {#each EXTENDED_PERIODS as period}
    <button
      class="btn-base btn-sm btn-timeframe"
      class:active={selectedPeriod === period}
      on:click={() => {
        console.log(`🖱️ [PaperTrading:TimeframeControls] RAW CLICK EVENT on button: ${period}`);
        handlePeriodChange(period);
      }}
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