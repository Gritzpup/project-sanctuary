<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import StrategySelector from '../../components/backtesting/StrategySelector.svelte';
  import BalanceConfiguration from '../../components/backtesting/BalanceConfiguration.svelte';
  import FeeConfiguration from '../../components/backtesting/FeeConfiguration.svelte';
  // Removed backtesting.css - using design system only
  
  export let selectedStrategyType: string;
  export let strategies: Array<any>;
  export let strategyParams: Record<string, any>;
  export let startBalance: number;
  export let makerFeePercent: number;
  export let takerFeePercent: number;
  export let feeRebatePercent: number;
  export let isSynced: boolean;
  export let paperTradingActive: boolean;
  export let isRunning: boolean;
  export let currentPrice: number = 0;
  export let customPresets: Array<any>;
  export let selectedPresetIndex: number;
  export let showSaveSuccess: boolean = false;
  export let showSyncSuccess: boolean = false;
  
  const dispatch = createEventDispatcher();
  
  let activeTab: 'config' | 'code' | 'backups' = 'config';
  let strategySourceCode = '';
  
  function syncToPaperTrading() {
    dispatch('syncToPaperTrading');
  }
  
  function runBacktest() {
    dispatch('runBacktest');
  }
  
  function updateCurrentStrategy() {
    dispatch('updateStrategy');
  }
  
  function handleStrategyAction(event: CustomEvent) {
    dispatch(event.type, event.detail);
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
        on:click={() => { updateCurrentStrategy(); runBacktest(); }} 
        disabled={isRunning}
      >
        {isRunning ? 'Running...' : 'Run Backtest'}
      </button>
    </div>
  </div>
  
  <div class="tabs">
    <button class="tab" class:active={activeTab === 'config'} on:click={() => activeTab = 'config'}>
      Config
    </button>
    <button class="tab" class:active={activeTab === 'code'} on:click={() => activeTab = 'code'}>
      Source Code
    </button>
    <button class="tab" class:active={activeTab === 'backups'} on:click={() => activeTab = 'backups'}>
      Backups
    </button>
  </div>
  
  <div class="panel-content">
    {#if activeTab === 'config'}
      <div class="config-tab">
        <StrategySelector 
          bind:selectedStrategyType
          {strategies}
          {showSaveSuccess}
          on:updateStrategy={updateCurrentStrategy}
          on:saveCurrentStrategy={handleStrategyAction}
          on:importStrategy={handleStrategyAction}
          on:exportStrategy={handleStrategyAction}
          on:editStrategy={handleStrategyAction}
          on:deleteStrategy={handleStrategyAction}
        />
        
        <BalanceConfiguration bind:startBalance />
        
        <FeeConfiguration 
          bind:makerFeePercent
          bind:takerFeePercent
          bind:feeRebatePercent
        />
        
        <div class="strategy-params">
          <slot name="strategy-params" />
        </div>
      </div>
    {:else if activeTab === 'code'}
      <div class="code-editor-section">
        <div class="code-header">
          <h3>{selectedStrategyType}.ts</h3>
          <div class="code-info">
            Read-only view of the strategy implementation
          </div>
        </div>
        <div class="code-editor">
          <pre><code>{strategySourceCode || 'Loading strategy source code...'}</code></pre>
        </div>
      </div>
    {:else if activeTab === 'backups'}
      <slot name="backups-content" />
    {/if}
  </div>
</div>

<style>
  .config-tab {
    display: flex;
    flex-direction: column;
  }
  
  .strategy-params {
    margin-top: 20px;
  }
</style>