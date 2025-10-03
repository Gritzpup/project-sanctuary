<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import ConfigurationTab from './ConfigurationTab.svelte';
  import CodeEditorTab from './CodeEditorTab.svelte';
  import BackupsTab from './BackupsTab.svelte';
  import type { BacktestingControlsProps, TabType } from './BacktestingControlsTypes';
  
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
  export let customPresets: Array<any> = [];
  export let selectedPresetIndex: number = 0;
  export let showSaveSuccess: boolean = false;
  export let showSyncSuccess: boolean = false;
  
  const dispatch = createEventDispatcher();
  
  let activeTab: TabType = 'config';

  // Forward all events from child components
  function forwardEvent(event: CustomEvent) {
    dispatch(event.type, event.detail);
  }

  function switchTab(tab: TabType) {
    activeTab = tab;
    
    // Special handling for backups tab
    if (tab === 'backups') {
      // Trigger backup loading in the BackupsTab component
      dispatch('loadBackups');
    }
  }
</script>

<div class="backtesting-controls">
  <!-- Tab Navigation -->
  <div class="tabs">
    <button 
      class="btn-base btn-sm" 
      class:active={activeTab === 'config'} 
      on:click={() => switchTab('config')}
    >
      Configuration
    </button>
    <button 
      class="btn-base btn-sm" 
      class:active={activeTab === 'code'} 
      on:click={() => switchTab('code')}
    >
      Strategy Code
    </button>
    <button 
      class="btn-base btn-sm" 
      class:active={activeTab === 'backups'} 
      on:click={() => switchTab('backups')}
    >
      Backups & Presets
    </button>
  </div>

  <!-- Tab Content -->
  <div class="tab-content">
    {#if activeTab === 'config'}
      <ConfigurationTab
        {selectedStrategyType}
        {strategies}
        {strategyParams}
        {startBalance}
        {makerFeePercent}
        {takerFeePercent}
        {feeRebatePercent}
        {isSynced}
        {paperTradingActive}
        {isRunning}
        {customPresets}
        {selectedPresetIndex}
        on:syncToPaperTrading={forwardEvent}
        on:runBacktest={forwardEvent}
        on:updateStrategy={forwardEvent}
        on:strategyChange={forwardEvent}
        on:parameterChange={forwardEvent}
        on:balanceChange={forwardEvent}
        on:feeChange={forwardEvent}
        on:saveAsPreset={forwardEvent}
        on:loadPreset={forwardEvent}
        on:deletePreset={forwardEvent}
      />
    {:else if activeTab === 'code'}
      <CodeEditorTab
        {strategies}
        {selectedStrategyType}
        on:createStrategy={forwardEvent}
        on:updateStrategy={forwardEvent}
        on:deleteStrategy={forwardEvent}
      />
    {:else if activeTab === 'backups'}
      <BackupsTab
        on:saveBackup={forwardEvent}
        on:loadBackup={forwardEvent}
        on:deleteBackup={forwardEvent}
        on:updateBackup={forwardEvent}
        on:importBackup={forwardEvent}
      />
    {/if}
  </div>

  <!-- Success Messages -->
  {#if showSaveSuccess}
    <div class="success-message" role="status" aria-live="polite">
      ✓ Configuration saved successfully!
    </div>
  {/if}

  {#if showSyncSuccess}
    <div class="success-message" role="status" aria-live="polite">
      ✓ Successfully synced to Paper Trading!
    </div>
  {/if}
</div>

<style>
  .backtesting-controls {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
    width: 100%;
    max-width: 100%;
  }

  .tabs {
    display: flex;
    gap: var(--space-xs);
    border-bottom: 1px solid var(--border-primary);
    padding-bottom: var(--space-xs);
  }

  .tabs .btn-base {
    padding: var(--space-sm) var(--space-md);
    border-radius: 4px 4px 0 0;
    border-bottom: 2px solid transparent;
    background: var(--surface-elevated);
    transition: all 0.2s ease;
  }

  .tabs .btn-base.active {
    background: var(--bg-primary);
    border-bottom-color: var(--primary-color);
    color: var(--primary-color);
    font-weight: 600;
  }

  .tabs .btn-base:hover:not(.active) {
    background: var(--surface-hover);
  }

  .tab-content {
    flex: 1;
    min-height: 0; /* Allow shrinking */
    overflow: auto;
  }

  .success-message {
    padding: var(--space-sm) var(--space-md);
    background: var(--success-bg);
    color: var(--success-text);
    border: 1px solid var(--success-border);
    border-radius: 4px;
    font-size: var(--font-size-sm);
    font-weight: 500;
    animation: slideIn 0.3s ease;
  }

  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  /* Mobile responsive */
  @media (max-width: 768px) {
    .tabs {
      overflow-x: auto;
      scrollbar-width: none;
      -ms-overflow-style: none;
    }
    
    .tabs::-webkit-scrollbar {
      display: none;
    }
    
    .tabs .btn-base {
      flex-shrink: 0;
      min-width: 120px;
      padding: var(--space-xs) var(--space-sm);
      font-size: var(--font-size-xs);
    }
  }
</style>