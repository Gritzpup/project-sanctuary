<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { PERIOD_DISPLAY_NAMES } from '../../../utils/constants';

  export let currentTimeframe: string;
  export let availableTimeframes: string[] = ['1H', '6H', '1D', '1W', '1M', '5Y'];
  export let showTimeframes: boolean = true;

  const dispatch = createEventDispatcher();

  function handleTimeframeChange(timeframe: string) {
    dispatch('timeframeChange', { timeframe });
  }

  function getButtonClass(isActive: boolean): string {
    let classes = ['control-button'];
    
    if (isActive) {
      classes.push('active');
    }
    
    return classes.join(' ');
  }
</script>

{#if showTimeframes}
  <div class="control-group">
    <span class="control-label">Period:</span>
    <div class="button-group">
      {#each availableTimeframes as timeframe}
        <button
          class={getButtonClass(currentTimeframe === timeframe)}
          on:click={() => handleTimeframeChange(timeframe)}
          title={PERIOD_DISPLAY_NAMES[timeframe] || timeframe}
        >
          {timeframe}
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
    transition: all var(--transition-normal);
    position: relative;
    overflow: hidden;
  }

  .control-button:hover:not(:disabled) {
    background: var(--bg-primary);
    border-color: var(--border-primary-hover);
    color: var(--text-primary);
  }

  .control-button.active {
    background: var(--bg-primary-active);
    color: var(--text-primary);
    border-color: var(--border-primary-active);
    box-shadow: inset 0 2px 4px var(--color-primary);
    font-weight: var(--font-weight-semibold);
  }
</style>