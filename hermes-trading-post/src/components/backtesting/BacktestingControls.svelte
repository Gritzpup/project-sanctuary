<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  
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
  export const currentPrice: number = 0;
  export const customPresets: Array<any> = [];
  export const selectedPresetIndex: number = 0;
  export let showSaveSuccess: boolean = false;
  export let showSyncSuccess: boolean = false;
  
  const dispatch = createEventDispatcher();
  
  let activeTab: 'config' | 'code' | 'backups' = 'config';
  let strategySourceCode = '';
  let backupName = '';
  let backupDescription = '';
  let showImportDialog = false;
  let importJsonText = '';
  let savedBackups: Array<any> = [];
  let selectedBackupKey = '';
  let showBackupDialog = false;
  let editingBackupKey = '';
  let showStrategyEditor = false;
  let newStrategyName = '';
  let newStrategyLabel = '';
  let newStrategyDescription = '';
  let newStrategyCode = '';
  let editingStrategy: string | null = null;
  let isEditingPresets = false;
  let editingPresetName = '';
  
  function syncToPaperTrading() {
    dispatch('syncToPaperTrading');
  }
  
  function runBacktest() {
    dispatch('runBacktest');
  }
  
  function updateCurrentStrategy() {
    dispatch('updateStrategy');
  }
  
  function applyPreset(index: number) {
    dispatch('applyPreset', { index });
  }
  
  function savePresetForTimeframe(index: number) {
    dispatch('savePresetForTimeframe', { index });
  }
  
  function updatePresetName(index: number, newName: string) {
    dispatch('updatePresetName', { index, newName });
  }
  
  function addNewPreset() {
    dispatch('addNewPreset');
  }
  
  function deletePreset(index: number) {
    dispatch('deletePreset', { index });
  }
  
  function saveCurrentAsPreset(index: number) {
    dispatch('saveCurrentAsPreset', { index });
  }
  
  function calculatePositionSizes(balance: number = startBalance): Array<{level: number, amount: number, percentage: number}> {
    const params = strategyParams['reverse-ratio'];
    const sizes = [];
    
    for (let level = 1; level <= Math.min(params.maxLevels, 5); level++) {
      let amount: number;
      
      if (params.positionSizeMode === 'fixed') {
        if (params.ratioMultiplier === 1) {
          amount = params.basePositionAmount * level;
        } else {
          const levelRatio = Math.pow(params.ratioMultiplier, level - 1);
          amount = params.basePositionAmount * levelRatio;
        }
      } else {
        const basePercent = params.basePositionPercent / 100;
        if (params.ratioMultiplier === 1) {
          amount = balance * (basePercent * level);
        } else {
          const levelRatio = Math.pow(params.ratioMultiplier, level - 1);
          amount = balance * (basePercent * levelRatio);
        }
      }
      
      sizes.push({
        level,
        amount,
        percentage: (amount / balance) * 100
      });
    }
    
    return sizes;
  }
  
  function saveCurrentStrategy() {
    dispatch('saveCurrentStrategy', { useAutoName: true });
  }
  
  function loadSavedBackups() {
    dispatch('loadSavedBackups');
  }
  
  function importStrategy() {
    dispatch('importStrategy', { jsonText: importJsonText });
    showImportDialog = false;
    importJsonText = '';
  }
  
  function exportCurrentStrategy() {
    dispatch('exportCurrentStrategy');
  }
  
  function editStrategy(strategyType: string) {
    dispatch('editStrategy', { strategyType });
  }
  
  function deleteCustomStrategy(strategyType: string) {
    dispatch('deleteCustomStrategy', { strategyType });
  }
  
  function saveStrategy() {
    dispatch('saveStrategy', {
      name: newStrategyName,
      label: newStrategyLabel,
      description: newStrategyDescription,
      code: newStrategyCode,
      editing: editingStrategy
    });
    showStrategyEditor = false;
  }
  
  function saveStrategyConfig() {
    if (!backupName.trim()) {
      alert('Please enter a backup name');
      return;
    }
    dispatch('saveStrategyConfig', {
      name: backupName,
      description: backupDescription
    });
    backupName = '';
    backupDescription = '';
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
      <button class="btn-base btn-md" class:btn-warning={paperTradingActive} class:btn-success={showSyncSuccess} on:click={syncToPaperTrading} disabled={isSynced && !showSyncSuccess}>
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
      <button class="btn-base btn-md btn-primary" on:click={() => { updateCurrentStrategy(); runBacktest(); }} disabled={isRunning}>
        {isRunning ? 'Running...' : 'Run Backtest'}
      </button>
    </div>
  </div>
  
  <div class="tabs">
    <button class="btn-base btn-sm" class:active={activeTab === 'config'} on:click={() => activeTab = 'config'}>
      Config
    </button>
    <button class="btn-base btn-sm" class:active={activeTab === 'code'} on:click={() => activeTab = 'code'}>
      Source Code
    </button>
    <button class="btn-base btn-sm" class:active={activeTab === 'backups'} on:click={() => { activeTab = 'backups'; loadSavedBackups(); }}>
      Backups
    </button>
  </div>
  
  <div class="panel-content">
    {#if activeTab === 'config'}
      <div class="config-section">
        <div class="strategy-header">
          <label class="strategy-label">
            Strategy
            <select class="select-base" bind:value={selectedStrategyType} on:change={updateCurrentStrategy}>
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
              class="btn-base btn-icon" 
              class:btn-success={showSaveSuccess}
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
              class="btn-base btn-icon" 
              on:click={() => showImportDialog = true}
              title="Import strategy"
            >
              📥
            </button>
            <button 
              class="btn-base btn-icon" 
              on:click={exportCurrentStrategy}
              title="Export current strategy"
            >
              📤
            </button>
            {#if strategies.find(s => s.value === selectedStrategyType)?.isCustom}
              <button 
                class="btn-base btn-icon" 
                on:click={() => editStrategy(selectedStrategyType)}
                title="Edit strategy code"
              >
                ✏️
              </button>
              <button 
                class="btn-base btn-icon btn-error" 
                on:click={() => deleteCustomStrategy(selectedStrategyType)}
                title="Delete custom strategy"
              >
                🗑️
              </button>
            {/if}
          </div>
        </div>
        {#if strategies.find(s => s.value === selectedStrategyType)}
          <div class="strategy-description">
            {strategies.find(s => s.value === selectedStrategyType).description}
          </div>
        {/if}
      </div>
      
      <div class="config-section">
        <label>
          Starting Balance
          <input 
            type="number" 
            class="input-base"
            bind:value={startBalance}
            min="100" 
            step="100" 
          />
          <span class="input-hint">$1000+ recommended for micro-scalping profitability</span>
        </label>
      </div>
      
      <div class="config-section">
        <h4 class="text-accent mb-10">Fee Structure</h4>
        <label>
          Maker Fee (%)
          <input 
            type="number" 
            class="input-base"
            bind:value={makerFeePercent}
            min="0" 
            max="2" 
            step="0.05" 
          />
        </label>
      </div>
      
      <div class="config-section">
        <label>
          Taker Fee (%)
          <input 
            type="number" 
            class="input-base"
            bind:value={takerFeePercent}
            min="0" 
            max="2" 
            step="0.05" 
          />
        </label>
      </div>
      
      <div class="config-section">
        <label>
          Fee Rebate (%)
          <input 
            type="number" 
            class="input-base"
            bind:value={feeRebatePercent}
            min="0" 
            max="100" 
            step="5" 
          />
        </label>
      </div>
      
      <div class="strategy-params">
        <slot name="strategy-params" />
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

{#if showImportDialog}
  <div class="import-dialog-overlay" on:click={() => showImportDialog = false} role="button" tabindex="0" aria-label="Close dialog">
    <div class="import-dialog" on:click|stopPropagation role="dialog" on:keydown={e => e.key === 'Escape' && (showImportDialog = false)}>
      <h3>Import Strategy</h3>
      <textarea
        bind:value={importJsonText}
        placeholder="Paste exported strategy JSON here..."
        rows="10"
      ></textarea>
      <div class="dialog-actions">
        <button class="btn-base btn-md btn-success" on:click={importStrategy}>Import</button>
        <button class="btn-base btn-md btn-secondary" on:click={() => { showImportDialog = false; importJsonText = ''; }}>Cancel</button>
      </div>
    </div>
  </div>
{/if}

{#if showStrategyEditor}
  <div class="strategy-editor-overlay" on:click={() => showStrategyEditor = false} role="button" tabindex="0" aria-label="Close dialog">
    <div class="strategy-editor-dialog" on:click|stopPropagation role="dialog" on:keydown={e => e.key === 'Escape' && (showStrategyEditor = false)}>
      <h3>{editingStrategy ? 'Edit' : 'Create New'} Strategy</h3>
      
      <div class="editor-form">
        <label>
          Strategy ID (lowercase, hyphens only)
          <input 
            type="text" 
            class="input-base"
            bind:value={newStrategyName} 
            placeholder="my-custom-strategy"
            pattern="[a-z0-9-]+"
            disabled={editingStrategy !== null}
          />
        </label>
        
        <label>
          Display Name
          <input 
            type="text" 
            class="input-base"
            bind:value={newStrategyLabel} 
            placeholder="My Custom Strategy"
          />
        </label>
        
        <label>
          Description
          <input 
            type="text" 
            class="input-base"
            bind:value={newStrategyDescription} 
            placeholder="Brief description of your strategy"
          />
        </label>
        
        <label>
          Strategy Code
          <div class="code-editor-wrapper">
            <textarea
              bind:value={newStrategyCode}
              class="strategy-code-editor"
              rows="20"
              spellcheck="false"
            ></textarea>
          </div>
        </label>
      </div>
      
      <div class="dialog-actions">
        <button class="btn-base btn-md btn-success" on:click={saveStrategy}>
          {editingStrategy ? 'Update' : 'Create'} Strategy
        </button>
        <button class="btn-base btn-md btn-secondary" on:click={() => showStrategyEditor = false}>Cancel</button>
      </div>
    </div>
  </div>
{/if}

