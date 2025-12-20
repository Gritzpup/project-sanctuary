<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let selectedStrategyType: string;
  export let strategies: any[];

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
    height: 32px;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 13px;
    font-weight: 500;
    background: var(--bg-primary, #1a1a2e);
    color: #c4b5fd;
    border: 1px solid var(--border-primary, #4a00e0);
    appearance: none;
    -webkit-appearance: none;
    -moz-appearance: none;
    background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%23c4b5fd' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e");
    background-position: right 8px center;
    background-repeat: no-repeat;
    background-size: 14px;
    padding-right: 28px;
    cursor: pointer;
    width: 100%;
    text-overflow: ellipsis;
    white-space: nowrap;
    overflow: hidden;
  }

  .control-group .strategy-dropdown option {
    background: #1a1a2e;
    color: #e0e0e0;
    padding: 8px;
  }

  .control-group .strategy-dropdown:hover {
    background: rgba(74, 0, 224, 0.2);
    border-color: rgba(74, 0, 224, 0.5);
    color: white;
  }

  .control-group .strategy-dropdown:focus {
    outline: none;
    border-color: #8b5cf6;
    box-shadow: 0 0 0 2px rgba(139, 92, 246, 0.2);
  }
</style>