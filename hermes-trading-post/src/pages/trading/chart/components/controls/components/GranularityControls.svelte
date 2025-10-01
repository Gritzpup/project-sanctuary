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

  const dispatch = createEventDispatcher();

  // Get recommended and valid granularities for current timeframe
  $: recommendedGranularities = RECOMMENDED_GRANULARITIES[currentTimeframe] || [];
  $: validGranularities = VALID_GRANULARITIES[currentTimeframe] || [];
  
  // Show all valid granularities for the current timeframe
  $: filteredGranularities = showGranularities ? 
    availableGranularities.filter(g => validGranularities.includes(g)) :
    [];

  function handleGranularityChange(granularity: string) {
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
    gap: 8px;
  }

  .control-label {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-secondary, #666);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .button-group {
    display: flex;
    gap: 4px;
  }

  .control-button {
    padding: 6px 12px;
    border: 1px solid var(--border-color, #ddd);
    background: var(--button-bg, white);
    color: #c4b5fd;
    font-size: 13px;
    font-weight: 500;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.2s ease;
    position: relative;
    overflow: hidden;
  }

  .control-button:hover:not(:disabled) {
    background: rgba(74, 0, 224, 0.2);
    border-color: rgba(74, 0, 224, 0.5);
    color: white;
  }

  .control-button:disabled,
  .control-button.disabled {
    opacity: 0.3;
    cursor: not-allowed;
    background: var(--button-bg, white);
    color: var(--text-muted, #999);
  }

  .control-button.disabled:hover {
    background: var(--button-bg, white);
    border-color: var(--border-color, #ddd);
  }

  .control-button.active {
    background: rgba(74, 0, 224, 0.4);
    color: white;
    border-color: rgba(74, 0, 224, 0.7);
    box-shadow: inset 0 2px 4px rgba(74, 0, 224, 0.5);
    font-weight: 600;
  }

  .control-button.recommended:not(.active)::after {
    content: '';
    position: absolute;
    top: 2px;
    right: 2px;
    width: 4px;
    height: 4px;
    background: var(--accent-color, #4caf50);
    border-radius: 50%;
  }

  /* Dark theme support */
  :global(.dark) .control-button {
    --button-bg: #2a2a2a;
    --button-hover-bg: #3a3a3a;
    --border-color: #444;
    --border-hover-color: #666;
    --primary-color: #4f46e5;
    --accent-color: #4caf50;
    --text-primary: #e0e0e0;
    --text-muted: #555;
  }
</style>