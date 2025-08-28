<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  
  export let selectedStrategyType: string;
  export let strategies: Array<any>;
  export let showSaveSuccess: boolean = false;
  
  const dispatch = createEventDispatcher();
  
  function updateStrategy() {
    dispatch('updateStrategy');
  }
  
  function saveCurrentStrategy() {
    dispatch('saveCurrentStrategy');
  }
  
  function importStrategy() {
    dispatch('importStrategy');
  }
  
  function exportStrategy() {
    dispatch('exportStrategy');
  }
  
  function editStrategy() {
    dispatch('editStrategy', { strategyType: selectedStrategyType });
  }
  
  function deleteStrategy() {
    dispatch('deleteStrategy', { strategyType: selectedStrategyType });
  }
  
  $: currentStrategy = strategies.find(s => s.value === selectedStrategyType);
</script>

<div class="strategy-selector">
  <div class="strategy-header">
    <label class="strategy-label">
      Strategy
      <select bind:value={selectedStrategyType} on:change={updateStrategy}>
        {#each strategies as strat}
          <option value={strat.value}>
            {strat.label}
            {#if strat.isCustom}[CUSTOM]{/if}
          </option>
        {/each}
      </select>
    </label>
    <div class="strategy-actions">
      <button 
        class="icon-btn save-btn" 
        class:success={showSaveSuccess}
        on:click={saveCurrentStrategy}
        title="Save current configuration"
      >
        {#if showSaveSuccess}
          ✅
        {:else}
          💾
        {/if}
      </button>
      <button 
        class="icon-btn import-btn" 
        on:click={importStrategy}
        title="Import strategy"
      >
        📥
      </button>
      <button 
        class="icon-btn export-btn" 
        on:click={exportStrategy}
        title="Export current strategy"
      >
        📤
      </button>
      {#if currentStrategy?.isCustom}
        <button 
          class="icon-btn edit-btn" 
          on:click={editStrategy}
          title="Edit strategy code"
        >
          ✏️
        </button>
        <button 
          class="icon-btn delete-btn" 
          on:click={deleteStrategy}
          title="Delete custom strategy"
        >
          🗑️
        </button>
      {/if}
    </div>
  </div>
  {#if currentStrategy}
    <div class="strategy-description">
      {currentStrategy.description}
    </div>
  {/if}
</div>

<style>
  .strategy-selector {
    margin-bottom: 20px;
  }
  
  .strategy-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  .strategy-label {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 14px;
    color: #d1d4dc;
  }
  
  .strategy-label select {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(74, 0, 224, 0.3);
    border-radius: 6px;
    color: #d1d4dc;
    padding: 8px 12px;
    font-size: 13px;
  }
  
  .strategy-actions {
    display: flex;
    gap: 8px;
  }
  
  .icon-btn {
    width: 32px;
    height: 32px;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(74, 0, 224, 0.3);
    border-radius: 6px;
    cursor: pointer;
    font-size: 16px;
    transition: all 0.2s;
  }
  
  .icon-btn:hover {
    background: rgba(74, 0, 224, 0.2);
    border-color: rgba(74, 0, 224, 0.5);
  }
  
  .icon-btn.success {
    background: rgba(34, 197, 94, 0.2);
    border-color: rgba(34, 197, 94, 0.5);
    color: #22c55e;
  }
  
  .strategy-description {
    margin-top: 10px;
    font-size: 12px;
    color: #888;
    font-style: italic;
  }
</style>