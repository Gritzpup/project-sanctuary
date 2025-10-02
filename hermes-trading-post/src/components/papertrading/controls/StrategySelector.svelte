<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let selectedStrategyType: string;
  export let strategies: any[];
  export let isRunning: boolean;

  const dispatch = createEventDispatcher();

  function handleStrategyChange(event: Event) {
    const select = event.target as HTMLSelectElement;
    dispatch('strategyChange', { value: select.value });
  }
</script>

<div class="control-group">
  <label for="strategy-select">Strategy</label>
  <select 
    id="strategy-select"
    class="select-base strategy-dropdown"
    bind:value={selectedStrategyType}
    on:change={handleStrategyChange}
    disabled={isRunning}
  >
    {#each strategies as strategy}
      <option value={strategy.value}>{strategy.label}</option>
    {/each}
  </select>
</div>

<style>
  .control-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 2px;
    margin-top: 10px;
  }

  .control-group label {
    font-size: 13px;
    color: #888;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    font-weight: 500;
  }
  
  .strategy-dropdown {
    height: 28px !important;
    padding: 2px 6px !important;
    border-radius: 4px !important;
    font-size: 12px !important;
    font-weight: 500 !important;
    background: var(--bg-primary) !important;
    color: #c4b5fd !important;
    border: 1px solid var(--border-primary) !important;
    appearance: none !important;
    background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%23ffffff' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e") !important;
    background-position: right 6px center !important;
    background-repeat: no-repeat !important;
    background-size: 12px !important;
    padding-right: 24px !important;
    transition: all 0.2s ease !important;
  }
  
  .strategy-dropdown:hover:not(:disabled) {
    background: rgba(74, 0, 224, 0.2) !important;
    border-color: rgba(74, 0, 224, 0.5) !important;
    color: white !important;
  }
  
  .strategy-dropdown:disabled {
    opacity: 0.5 !important;
    cursor: not-allowed !important;
  }
</style>