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
  export let currentPrice: number = 0;
  export let customPresets: Array<any>;
  export let selectedPresetIndex: number;
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
      <button class="sync-btn" class:warning={paperTradingActive} class:success={showSyncSuccess} on:click={syncToPaperTrading} disabled={isSynced && !showSyncSuccess}>
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
      <button class="run-btn" on:click={() => { updateCurrentStrategy(); runBacktest(); }} disabled={isRunning}>
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
    <button class="tab" class:active={activeTab === 'backups'} on:click={() => { activeTab = 'backups'; loadSavedBackups(); }}>
      Backups
    </button>
  </div>
  
  <div class="panel-content">
    {#if activeTab === 'config'}
      <div class="config-section">
        <div class="strategy-header">
          <label class="strategy-label">
            Strategy
            <select bind:value={selectedStrategyType} on:change={updateCurrentStrategy}>
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
              on:click={() => showImportDialog = true}
              title="Import strategy"
            >
              📥
            </button>
            <button 
              class="icon-btn export-btn" 
              on:click={exportCurrentStrategy}
              title="Export current strategy"
            >
              📤
            </button>
            {#if strategies.find(s => s.value === selectedStrategyType)?.isCustom}
              <button 
                class="icon-btn edit-btn" 
                on:click={() => editStrategy(selectedStrategyType)}
                title="Edit strategy code"
              >
                ✏️
              </button>
              <button 
                class="icon-btn delete-btn" 
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
            bind:value={startBalance}
            min="100" 
            step="100" 
          />
          <span class="input-hint">$1000+ recommended for micro-scalping profitability</span>
        </label>
      </div>
      
      <div class="config-section">
        <h4 style="color: #a78bfa; margin-bottom: 10px;">Fee Structure</h4>
        <label>
          Maker Fee (%)
          <input 
            type="number" 
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
        <button on:click={importStrategy}>Import</button>
        <button on:click={() => { showImportDialog = false; importJsonText = ''; }}>Cancel</button>
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
            bind:value={newStrategyLabel} 
            placeholder="My Custom Strategy"
          />
        </label>
        
        <label>
          Description
          <input 
            type="text" 
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
        <button class="save-strategy-btn" on:click={saveStrategy}>
          {editingStrategy ? 'Update' : 'Create'} Strategy
        </button>
        <button on:click={() => showStrategyEditor = false}>Cancel</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .strategy-panel {
    min-height: 500px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  
  .panel {
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(74, 0, 224, 0.3);
    border-radius: 8px;
    display: flex;
    flex-direction: column;
  }
  
  .panel-header {
    padding: 15px 20px;
    background: rgba(74, 0, 224, 0.1);
    border-bottom: none;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  .panel-header h2 {
    margin: 0;
    font-size: 16px;
    color: #a78bfa;
  }
  
  .sync-indicator {
    font-size: 12px;
    font-weight: normal;
    margin-left: 10px;
  }
  
  .sync-indicator.synced {
    color: #26a69a;
  }
  
  .sync-indicator.out-of-sync {
    color: #ffa726;
  }
  
  .header-buttons {
    display: flex;
    gap: 10px;
  }
  
  .sync-btn, .run-btn {
    padding: 8px 16px;
    background: rgba(74, 0, 224, 0.2);
    border: 1px solid rgba(74, 0, 224, 0.4);
    border-radius: 6px;
    color: #a78bfa;
    cursor: pointer;
    font-size: 13px;
    transition: all 0.2s;
  }
  
  .sync-btn:hover:not(:disabled), .run-btn:hover:not(:disabled) {
    background: rgba(74, 0, 224, 0.3);
    border-color: rgba(74, 0, 224, 0.6);
  }
  
  .sync-btn:disabled, .run-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .sync-btn.warning {
    background: rgba(255, 167, 38, 0.2);
    border-color: rgba(255, 167, 38, 0.4);
    color: #ffa726;
  }
  
  .sync-btn.success {
    background: rgba(34, 197, 94, 0.2);
    border-color: rgba(34, 197, 94, 0.5);
    color: #22c55e;
  }
  
  .tabs {
    display: flex;
    gap: 0;
    align-items: center;
    background: rgba(255, 255, 255, 0.05);
    padding: 0;
    border-bottom: 1px solid rgba(74, 0, 224, 0.3);
  }
  
  .tab {
    padding: 12px 24px;
    background: transparent;
    border: none;
    border-bottom: 2px solid transparent;
    color: #888;
    cursor: pointer;
    border-radius: 0;
    font-size: 13px;
    font-weight: 500;
    transition: all 0.2s;
    position: relative;
  }
  
  .tab:hover {
    background: rgba(74, 0, 224, 0.1);
    color: #a78bfa;
  }
  
  .tab.active {
    background: rgba(74, 0, 224, 0.15);
    border-bottom: 2px solid #a78bfa;
    color: #a78bfa;
  }
  
  .tab:not(:last-child)::after {
    content: '';
    position: absolute;
    right: 0;
    top: 25%;
    height: 50%;
    width: 1px;
    background: rgba(255, 255, 255, 0.1);
  }
  
  .tab.active::after,
  .tab.active + .tab::after {
    display: none;
  }
  
  .panel-content {
    flex: 1;
    padding: 20px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
  }
  
  .config-section {
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
  
  label {
    display: flex;
    flex-direction: column;
    gap: 8px;
    font-size: 14px;
    color: #d1d4dc;
  }
  
  input[type="number"] {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(74, 0, 224, 0.3);
    border-radius: 6px;
    color: #d1d4dc;
    padding: 10px 12px;
    font-size: 14px;
    transition: all 0.2s;
  }
  
  input[type="number"]:focus {
    outline: none;
    border-color: rgba(74, 0, 224, 0.6);
    background: rgba(255, 255, 255, 0.08);
  }
  
  .input-hint {
    font-size: 11px;
    color: #888;
    font-style: italic;
  }
  
  .code-editor-section {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
    height: 100%;
  }
  
  .code-header {
    margin-bottom: 15px;
    flex-shrink: 0;
  }
  
  .code-header h3 {
    margin: 0 0 5px 0;
    font-size: 14px;
    color: #a78bfa;
    font-family: 'Monaco', 'Consolas', monospace;
  }
  
  .code-info {
    font-size: 12px;
    color: #888;
  }
  
  .code-editor {
    flex: 1;
    background: #1a1a1a;
    border: 1px solid rgba(74, 0, 224, 0.2);
    border-radius: 6px;
    padding: 15px;
    overflow-y: auto;
    overflow-x: auto;
    min-height: 0;
    max-height: 100%;
    width: 100%;
    box-sizing: border-box;
  }
  
  .code-editor pre {
    margin: 0;
    font-family: 'Monaco', 'Consolas', monospace;
    font-size: 12px;
    line-height: 1.6;
  }
  
  .code-editor code {
    color: #d1d4dc;
    white-space: pre;
    word-break: normal;
  }
  
  /* Dialogs */
  .import-dialog-overlay,
  .strategy-editor-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }
  
  .import-dialog,
  .strategy-editor-dialog {
    background: #1a1a1a;
    border: 1px solid rgba(74, 0, 224, 0.3);
    border-radius: 8px;
    padding: 20px;
    width: 90%;
    max-width: 600px;
    max-height: 80vh;
    overflow-y: auto;
  }
  
  .import-dialog h3,
  .strategy-editor-dialog h3 {
    margin: 0 0 20px 0;
    color: #a78bfa;
  }
  
  .import-dialog textarea {
    width: 100%;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(74, 0, 224, 0.3);
    border-radius: 6px;
    color: #d1d4dc;
    padding: 10px;
    font-family: monospace;
    font-size: 12px;
    resize: vertical;
  }
  
  .dialog-actions {
    display: flex;
    gap: 10px;
    justify-content: flex-end;
    margin-top: 20px;
  }
  
  .dialog-actions button {
    padding: 8px 16px;
    background: rgba(74, 0, 224, 0.2);
    border: 1px solid rgba(74, 0, 224, 0.4);
    border-radius: 6px;
    color: #a78bfa;
    cursor: pointer;
    font-size: 13px;
    transition: all 0.2s;
  }
  
  .dialog-actions button:hover {
    background: rgba(74, 0, 224, 0.3);
    border-color: rgba(74, 0, 224, 0.6);
  }
  
  .editor-form {
    display: flex;
    flex-direction: column;
    gap: 15px;
  }
  
  .editor-form input[type="text"] {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(74, 0, 224, 0.3);
    border-radius: 6px;
    color: #d1d4dc;
    padding: 10px 12px;
    font-size: 14px;
  }
  
  .strategy-code-editor {
    width: 100%;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(74, 0, 224, 0.3);
    border-radius: 6px;
    color: #d1d4dc;
    padding: 10px;
    font-family: monospace;
    font-size: 12px;
    resize: vertical;
  }
</style>