<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { Strategy } from '../../../../strategies/base/Strategy';

  // Props
  export let selectedStrategyType: string = 'reverse-ratio';
  export let strategies: Array<{
    value: string;
    label: string;
    description: string;
    isCustom: boolean;
  }> = [];
  export let currentStrategy: Strategy | null = null;
  export let disabled: boolean = false;
  export let syncIndicator: boolean = true;

  // Event dispatcher
  const dispatch = createEventDispatcher<{
    strategyChange: {
      strategyType: string;
      previousType: string;
    };
  }>();

  // Handle strategy selection change
  async function handleStrategyChange(event: Event) {
    const select = event.target as HTMLSelectElement;
    const newStrategyType = select.value;
    const previousType = selectedStrategyType;
    
    if (newStrategyType === selectedStrategyType) return;
    
    // Dispatch the change event to parent
    dispatch('strategyChange', {
      strategyType: newStrategyType,
      previousType
    });
  }

  // Get strategy display info
  function getStrategyInfo(strategyType: string) {
    const strategy = strategies.find(s => s.value === strategyType);
    return {
      label: strategy?.label || 'Unknown Strategy',
      isCustom: strategy?.isCustom || false,
      description: strategy?.description || ''
    };
  }

  $: strategyInfo = getStrategyInfo(selectedStrategyType);
</script>

<div class="strategy-selector">
  {#if syncIndicator}
    <div class="sync-indicator">
      <span class="sync-icon">🔗</span>
      <span class="sync-text">Synced with Backtesting</span>
    </div>
  {/if}
  
  <div class="strategy-field">
    <label>
      Strategy
      <select 
        bind:value={selectedStrategyType} 
        on:change={handleStrategyChange}
        {disabled}
        class:disabled
      >
        {#each strategies as strategy}
          <option value={strategy.value}>
            {strategy.label}
            {#if strategy.isCustom}[CUSTOM]{/if}
          </option>
        {/each}
      </select>
    </label>
    
    {#if strategyInfo.description}
      <div class="strategy-description">
        {strategyInfo.description}
      </div>
    {/if}
  </div>
  
  {#if currentStrategy}
    <div class="strategy-status">
      <span class="status-dot active"></span>
      <span class="status-text">{currentStrategy.getName()} Loaded</span>
    </div>
  {:else}
    <div class="strategy-status">
      <span class="status-dot inactive"></span>
      <span class="status-text">No Strategy Loaded</span>
    </div>
  {/if}
</div>

<style>
  .strategy-selector {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .sync-indicator {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    background: rgba(34, 197, 94, 0.1);
    border: 1px solid rgba(34, 197, 94, 0.3);
    border-radius: 6px;
    font-size: 12px;
  }

  .sync-icon {
    color: #22c55e;
  }

  .sync-text {
    color: #22c55e;
    font-weight: 500;
  }

  .strategy-field {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .strategy-field label {
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-weight: 600;
    color: #e5e7eb;
    font-size: 14px;
  }

  .strategy-field select {
    background: #374151;
    border: 1px solid #4b5563;
    border-radius: 6px;
    padding: 8px 12px;
    color: #f3f4f6;
    font-size: 14px;
    transition: all 0.2s ease;
  }

  .strategy-field select:hover:not(.disabled) {
    background: #4b5563;
    border-color: #6b7280;
  }

  .strategy-field select:focus:not(.disabled) {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }

  .strategy-field select.disabled {
    background: #2d3748;
    color: #9ca3af;
    cursor: not-allowed;
    opacity: 0.6;
  }

  .strategy-field select option {
    background: #374151;
    color: #f3f4f6;
  }

  .strategy-description {
    font-size: 12px;
    color: #9ca3af;
    font-style: italic;
    padding: 4px 0;
  }

  .strategy-status {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: rgba(55, 65, 81, 0.5);
    border-radius: 6px;
    font-size: 12px;
  }

  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    display: block;
  }

  .status-dot.active {
    background: #22c55e;
    box-shadow: 0 0 6px rgba(34, 197, 94, 0.6);
  }

  .status-dot.inactive {
    background: #6b7280;
  }

  .status-text {
    color: #e5e7eb;
    font-weight: 500;
  }
</style>