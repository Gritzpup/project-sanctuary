<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { PERIOD_DISPLAY_NAMES } from '../../../utils/constants';

  export let currentTimeframe: string;
  export let availableTimeframes: string[] = ['1H', '6H', '1D', '1W', '1M'];
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

  .control-button.active {
    background: rgba(74, 0, 224, 0.4);
    color: white;
    border-color: rgba(74, 0, 224, 0.7);
    box-shadow: inset 0 2px 4px rgba(74, 0, 224, 0.5);
    font-weight: 600;
  }

  /* Dark theme support */
  :global(.dark) .control-button {
    --button-bg: #2a2a2a;
    --button-hover-bg: #3a3a3a;
    --border-color: #444;
    --border-hover-color: #666;
    --primary-color: #4f46e5;
    --text-primary: #e0e0e0;
  }
</style>