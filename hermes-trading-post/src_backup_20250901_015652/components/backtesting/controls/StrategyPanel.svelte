<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  
  export let isSynced: boolean = false;
  export let paperTradingActive: boolean = false;
  export let isRunning: boolean = false;
  export let showSyncSuccess: boolean = false;
  
  const dispatch = createEventDispatcher();
  
  function syncToPaperTrading() {
    dispatch('syncToPaperTrading');
  }
  
  function runBacktest() {
    dispatch('runBacktest');
  }
</script>

<div class="panel strategy-panel">
  <div class="panel-header">
    <h2>
      Strategy 
      {#if isSynced}
        <span class="sync-indicator synced" title="Strategy synced to Paper Trading">
          ✅ Synced
        </span>
      {:else}
        <span class="sync-indicator out-of-sync" title="Strategy not synced to Paper Trading">
          ⚠️ Not Synced
        </span>
      {/if}
    </h2>
    <div class="header-buttons">
      <button 
        class="sync-btn" 
        class:warning={paperTradingActive} 
        class:success={showSyncSuccess} 
        on:click={syncToPaperTrading} 
        disabled={isSynced && !showSyncSuccess}
      >
        {#if showSyncSuccess}
          ✅ Synced!
        {:else if paperTradingActive && !isSynced}
          ⚠️ Sync to Paper Trading (Active)
        {:else if isSynced}
          Already Synced
        {:else}
          Sync to Paper Trading
        {/if}
      </button>
      <button 
        class="run-btn" 
        on:click={runBacktest} 
        disabled={isRunning}
      >
        {isRunning ? 'Running...' : 'Run Backtest'}
      </button>
    </div>
  </div>
  
  <slot name="tabs" />
  <div class="panel-content">
    <slot name="content" />
  </div>
</div>