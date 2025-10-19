<script lang="ts">
  /**
   * TimeframeControls - Unified component for period/timeframe selection
   *
   * Phase 4: Component Consolidation
   * Consolidates two nearly identical implementations from:
   * - /src/pages/PaperTrading/components/chart-controls/TimeframeControls.svelte
   * - /src/pages/trading/chart/components/controls/components/TimeframeControls.svelte
   *
   * Now supports flexible configuration for different use cases.
   */

  import { createEventDispatcher } from 'svelte';

  export let currentTimeframe: string = '1H';
  export let availableTimeframes: string[] = ['1H', '6H', '1D', '1W', '1M', '5Y'];
  export let displayNames: Record<string, string> = {};
  export let debounceMs: number = 200;
  export let showLabel: boolean = false;
  export let labelText: string = 'Period:';
  export let onGranularityCheck: ((granularity: string, period: string) => string | null) | null = null;

  const dispatch = createEventDispatcher<{
    timeframeChange: { timeframe: string };
    granularityChange: { granularity: string };
  }>();

  let isDebouncing = false;
  let debounceTimer: number | null = null;

  function handleTimeframeChange(timeframe: string) {
    // Prevent multiple rapid clicks - debounce
    if (isDebouncing) return;

    isDebouncing = true;

    // Clear existing timer if any
    if (debounceTimer !== null) {
      clearTimeout(debounceTimer);
    }

    dispatch('timeframeChange', { timeframe });

    // If granularity checker provided, check compatibility
    if (onGranularityCheck) {
      const bestGranularity = onGranularityCheck(currentTimeframe, timeframe);
      if (bestGranularity) {
        dispatch('granularityChange', { granularity: bestGranularity });
      }
    }

    // Reset debounce after configured delay
    debounceTimer = window.setTimeout(() => {
      isDebouncing = false;
      debounceTimer = null;
    }, debounceMs);
  }

  function getButtonLabel(timeframe: string): string {
    return displayNames[timeframe] || timeframe;
  }

  function getButtonClass(isActive: boolean): string {
    return isActive ? 'control-button active' : 'control-button';
  }
</script>

<div class="timeframe-controls">
  {#if showLabel}
    <span class="control-label">{labelText}</span>
  {/if}
  <div class="button-group">
    {#each availableTimeframes as timeframe}
      <button
        class={getButtonClass(currentTimeframe === timeframe)}
        on:click={() => handleTimeframeChange(timeframe)}
        title={getButtonLabel(timeframe)}
      >
        {timeframe}
      </button>
    {/each}
  </div>
</div>

<style>
  .timeframe-controls {
    display: flex;
    align-items: center;
    gap: var(--space-sm, 8px);
  }

  .control-label {
    font-size: var(--font-size-xs, 11px);
    font-weight: var(--font-weight-semibold, 600);
    color: var(--text-secondary, #888);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .button-group {
    display: flex;
    gap: var(--space-xs, 4px);
  }

  .control-button {
    padding: var(--space-xs, 4px) var(--space-sm, 8px);
    border: 1px solid var(--border-primary, #333);
    background: var(--bg-surface, #1a1a1a);
    color: var(--text-accent, #c4b5fd);
    font-size: var(--font-size-xs, 11px);
    font-weight: var(--font-weight-medium, 500);
    border-radius: var(--radius-sm, 4px);
    cursor: pointer;
    transition: all var(--transition-normal, 0.2s ease);
    position: relative;
    overflow: hidden;
    height: 28px;
    min-width: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
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
    font-weight: var(--font-weight-semibold, 600);
  }

  /* Mobile adjustments */
  @media (max-width: 768px) {
    .control-button {
      min-width: 28px;
      padding: 2px 4px;
      font-size: 10px;
    }

    .timeframe-controls {
      transform: translateY(-2px);
    }
  }
</style>
