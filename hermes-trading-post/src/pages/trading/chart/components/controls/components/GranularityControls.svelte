<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import {
    GRANULARITY_DISPLAY_NAMES,
    RECOMMENDED_GRANULARITIES,
    VALID_GRANULARITIES
  } from '../../../utils/constants';

  export let currentGranularity: string;
  export let currentTimeframe: string;
  export let availableGranularities: string[] = ['1m', '5m', '15m', '30m', '1h', '4h', '1d'];
  export let showGranularities: boolean = true;
  export let onGranularityChange: ((granularity: string) => void) | undefined = undefined;

  const dispatch = createEventDispatcher();

  // Get recommended and valid granularities for current timeframe
  $: recommendedGranularities = RECOMMENDED_GRANULARITIES[currentTimeframe] || [];
  $: validGranularities = VALID_GRANULARITIES[currentTimeframe] || [];

  // Log granularity changes for debugging
  $: if (currentGranularity) {
  }

  // Show all valid granularities for the current timeframe
  $: filteredGranularities = showGranularities ?
    availableGranularities.filter(g => validGranularities.includes(g)) :
    [];

  function handleGranularityChange(granularity: string) {
    // Coordinator handles duplicate prevention via previousGranularity check
    if (onGranularityChange) {
      onGranularityChange(granularity);
    }

    dispatch('granularityChange', { granularity });
  }

  function getButtonClass(isActive: boolean, isRecommended: boolean = false, isDisabled: boolean = false): string {
    let classes = ['control-button'];
    
    if (isActive) {
      classes.push('active');
    }
    
    if (isRecommended && !isActive && !isDisabled) {
      classes.push('recommended');
    }
    
    if (isDisabled) {
      classes.push('disabled');
    }
    
    return classes.join(' ');
  }
</script>

{#if showGranularities && availableGranularities.length > 0}
  <div class="control-group">
    <span class="control-label">Interval:</span>
    <div class="button-group">
      {#each availableGranularities as granularity}
        {@const isValid = validGranularities.includes(granularity)}
        {@const isRecommended = recommendedGranularities.includes(granularity)}
        {@const isActive = currentGranularity === granularity}
        <button
          class={getButtonClass(isActive, isRecommended, !isValid)}
          on:click={() => handleGranularityChange(granularity)}
          disabled={!isValid}
          title={isValid ? 
            (GRANULARITY_DISPLAY_NAMES[granularity] || granularity) : 
            `${GRANULARITY_DISPLAY_NAMES[granularity] || granularity} (not suitable for ${currentTimeframe})`
          }
        >
          {granularity}
        </button>
      {/each}
    </div>
  </div>
{/if}

<style>
  .control-group {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
  }

  .control-label {
    font-size: var(--font-size-xs);
    font-weight: var(--font-weight-semibold);
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .button-group {
    display: flex;
    gap: var(--space-xs);
  }

  .control-button {
    padding: var(--space-xs) var(--space-sm);
    border: 1px solid var(--border-primary);
    background: var(--bg-surface);
    color: var(--text-accent);
    font-size: var(--font-size-xs);
    font-weight: var(--font-weight-medium);
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: background-color 0.1s ease, border-color 0.1s ease;
    position: relative;
    overflow: hidden;
  }

  .control-button:hover:not(:disabled) {
    background: var(--bg-primary);
    border-color: var(--border-primary-hover);
    color: var(--text-primary);
  }

  .control-button:disabled,
  .control-button.disabled {
    opacity: 0.3;
    cursor: not-allowed;
    background: var(--bg-surface);
    color: var(--text-muted);
  }

  .control-button.disabled:hover {
    background: var(--bg-surface);
    border-color: var(--border-primary);
  }

  .control-button.active {
    background: var(--bg-primary-active);
    color: var(--text-primary);
    border-color: var(--border-primary-active);
    box-shadow: inset 0 2px 4px var(--color-primary);
    font-weight: var(--font-weight-semibold);
  }

  .control-button.recommended:not(.active)::after {
    content: '';
    position: absolute;
    top: 2px;
    right: 2px;
    width: 4px;
    height: 4px;
    background: var(--color-success);
    border-radius: 50%;
  }
</style>