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

<style>
  .panel {
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(74, 0, 224, 0.3);
    border-radius: 8px;
    overflow: hidden;
  }

  .strategy-panel {
    width: 100%;
    min-width: 350px;
    flex-shrink: 0;
    height: 100%;
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
  }

  .panel-header {
    background: var(--bg-primary-subtle);
    padding: 15px 20px;
    border-bottom: 1px solid var(--border-primary);
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 10px;
  }

  .panel-header h2 {
    margin: 0;
    font-size: 16px;
    color: #a78bfa;
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .sync-indicator {
    font-size: 12px;
    opacity: 0.8;
  }

  .header-buttons {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .sync-btn,
  .run-btn {
    padding: 6px 12px;
    font-size: 13px;
    border-radius: 4px;
    border: none;
    cursor: pointer;
    transition: all 0.2s ease;
    font-weight: 500;
  }

  .sync-btn {
    background: rgba(255, 255, 255, 0.1);
    color: #a78bfa;
    border: 1px solid rgba(74, 0, 224, 0.3);
  }

  .sync-btn:hover:not(:disabled) {
    background: rgba(74, 0, 224, 0.2);
    border-color: rgba(74, 0, 224, 0.5);
  }

  .sync-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .sync-btn.warning {
    background: rgba(255, 167, 38, 0.2);
    color: #fbbf24;
    border-color: rgba(255, 167, 38, 0.4);
  }

  .sync-btn.success {
    background: rgba(34, 197, 94, 0.2);
    color: #4ade80;
    border-color: rgba(34, 197, 94, 0.4);
  }

  .run-btn {
    background: #a78bfa;
    color: #0a0a0a;
    border: 1px solid #a78bfa;
  }

  .run-btn:hover:not(:disabled) {
    background: #c4b5fd;
    border-color: #c4b5fd;
  }

  .run-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .panel-content {
    padding: 16px 20px 12px 20px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    flex: 1;
    height: 100%;
    background: linear-gradient(to right, rgba(255, 255, 255, 0.02), rgba(0, 0, 0, 0.6));
    overflow-y: auto;
  }

  /* Remove top spacing on mobile */
  @media (max-width: 768px) {
    .strategy-panel {
      margin-top: 0;
    }

    .panel-header {
      padding-top: 15px;
    }
  }

  /* Desktop spacing adjustments */
  @media (min-width: 769px) {
    .panel-content {
      gap: 10px;
      padding: 20px 20px 12px 20px;
    }
  }

  /* Responsive adjustments */
  @media (max-width: 1400px) {
    .strategy-panel {
      width: 100%;
      max-width: none;
    }
  }
</style>