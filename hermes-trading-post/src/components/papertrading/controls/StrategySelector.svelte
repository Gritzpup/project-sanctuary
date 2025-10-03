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
    margin-bottom: 0;
    margin-top: 0;
  }

  /* Desktop spacing */
  @media (min-width: 769px) {
    .control-group {
      gap: 12px;
    }
  }

  .control-group label {
    font-size: 13px;
    color: #888;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    font-weight: 500;
  }
  
  .control-group .strategy-dropdown {
    height: 28px;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 500;
    background: var(--bg-primary);
    color: #c4b5fd;
    border: 1px solid var(--border-primary);
    appearance: none;
    background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%23c4b5fd' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e");
    background-position: right 6px center;
    background-repeat: no-repeat;
    background-size: 12px;
    padding-right: 24px;
  }
  
  .control-group .strategy-dropdown:hover {
    background: rgba(74, 0, 224, 0.2);
    border-color: rgba(74, 0, 224, 0.5);
    color: white;
  }
</style>