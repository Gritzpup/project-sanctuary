<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { BacktestingControlsProps } from './BacktestingControlsTypes';
  
  export let selectedStrategyType: string;
  export let strategies: Array<any>;
  export let strategyParams: Record<string, any> = {};
  export let startBalance: number;
  export let makerFeePercent: number;
  export let takerFeePercent: number;
  export let feeRebatePercent: number;
  export let isSynced: boolean = false;
  export let paperTradingActive: boolean = false;
  export let isRunning: boolean = false;
  export let customPresets: Array<any> = [];
  export let selectedPresetIndex: number = 0;
  
  const dispatch = createEventDispatcher();

  function syncToPaperTrading() {
    dispatch('syncToPaperTrading');
  }
  
  function runBacktest() {
    dispatch('runBacktest');
  }
  
  function updateCurrentStrategy() {
    dispatch('updateStrategy');
  }
  
  function handleStrategyChange() {
    dispatch('strategyChange', { selectedStrategyType });
  }
  
  function handleParameterChange(paramName: string, value: any) {
    dispatch('parameterChange', { paramName, value });
  }
  
  function handleBalanceChange() {
    dispatch('balanceChange', { startBalance });
  }
  
  function handleFeeChange() {
    dispatch('feeChange', { 
      makerFeePercent, 
      takerFeePercent, 
      feeRebatePercent 
    });
  }

  function saveAsPreset() {
    dispatch('saveAsPreset');
  }
  
  function loadPreset() {
    dispatch('loadPreset', { selectedPresetIndex });
  }
  
  function deletePreset() {
    dispatch('deletePreset', { selectedPresetIndex });
  }
</script>

<div class="config-section">
  <!-- Strategy Selection -->
  <div class="form-group">
    <label for="strategy-select">Strategy:</label>
    <select 
      id="strategy-select"
      class="select-base"
      bind:value={selectedStrategyType}
      on:change={handleStrategyChange}
    >
      {#each strategies as strategy}
        <option value={strategy.value}>{strategy.label}</option>
      {/each}
    </select>
  </div>

  <!-- Strategy Parameters -->
  {#if strategyParams && Object.keys(strategyParams).length > 0}
    <div class="parameters-section">
      <h4>Strategy Parameters</h4>
      {#each Object.entries(strategyParams) as [paramName, paramValue]}
        <div class="form-group">
          <label for="param-{paramName}">{paramName}:</label>
          {#if typeof paramValue === 'number'}
            <input 
              id="param-{paramName}"
              class="input-base"
              type="number"
              step="any"
              bind:value={strategyParams[paramName]}
              on:input={() => handleParameterChange(paramName, strategyParams[paramName])}
            />
          {:else if typeof paramValue === 'boolean'}
            <input 
              id="param-{paramName}"
              type="checkbox"
              bind:checked={strategyParams[paramName]}
              on:change={() => handleParameterChange(paramName, strategyParams[paramName])}
            />
          {:else}
            <input 
              id="param-{paramName}"
              class="input-base"
              type="text"
              bind:value={strategyParams[paramName]}
              on:input={() => handleParameterChange(paramName, strategyParams[paramName])}
            />
          {/if}
        </div>
      {/each}
    </div>
  {/if}

  <!-- Balance Configuration -->
  <div class="form-group">
    <label for="start-balance">Starting Balance ($):</label>
    <input 
      id="start-balance"
      class="input-base"
      type="number"
      min="100"
      step="100"
      bind:value={startBalance}
      on:input={handleBalanceChange}
    />
    {#if selectedStrategyType === 'micro-scalping' && startBalance < 1000}
      <span class="input-hint">$1000+ recommended for micro-scalping profitability</span>
    {/if}
  </div>

  <!-- Fee Configuration -->
  <div class="fee-section">
    <h4>Fee Configuration</h4>
    
    <div class="form-group">
      <label for="maker-fee">Maker Fee (%):</label>
      <input 
        id="maker-fee"
        class="input-base"
        type="number"
        min="0"
        max="1"
        step="0.001"
        bind:value={makerFeePercent}
        on:input={handleFeeChange}
      />
    </div>

    <div class="form-group">
      <label for="taker-fee">Taker Fee (%):</label>
      <input 
        id="taker-fee"
        class="input-base"
        type="number"
        min="0"
        max="1"
        step="0.001"
        bind:value={takerFeePercent}
        on:input={handleFeeChange}
      />
    </div>

    <div class="form-group">
      <label for="fee-rebate">Fee Rebate (%):</label>
      <input 
        id="fee-rebate"
        class="input-base"
        type="number"
        min="0"
        max="1"
        step="0.001"
        bind:value={feeRebatePercent}
        on:input={handleFeeChange}
      />
    </div>
  </div>

  <!-- Preset Management -->
  {#if customPresets && customPresets.length > 0}
    <div class="preset-section">
      <h4>Saved Presets</h4>
      
      <div class="form-group">
        <select 
          class="select-base"
          bind:value={selectedPresetIndex}
        >
          {#each customPresets as preset, index}
            <option value={index}>{preset.name}</option>
          {/each}
        </select>
      </div>
      
      <div class="preset-actions">
        <button class="btn-base btn-sm" on:click={loadPreset}>
          Load Preset
        </button>
        <button class="btn-base btn-sm btn-danger" on:click={deletePreset}>
          Delete
        </button>
      </div>
    </div>
  {/if}

  <!-- Action Buttons -->
  <div class="action-buttons">
    <button class="btn-base btn-sm" on:click={saveAsPreset}>
      Save as Preset
    </button>
    
    <button class="btn-base btn-sm" on:click={updateCurrentStrategy}>
      Update Strategy
    </button>
    
    <button 
      class="btn-base btn-primary"
      on:click={runBacktest}
      disabled={isRunning}
    >
      {isRunning ? 'Running...' : 'Run Backtest'}
    </button>
    
    <button 
      class="btn-base btn-secondary"
      class:synced={isSynced}
      on:click={syncToPaperTrading}
      disabled={paperTradingActive || isRunning}
    >
      {#if isSynced}
        ✓ Synced to Paper Trading
      {:else}
        Sync to Paper Trading
      {/if}
    </button>
  </div>
</div>

<style>
  .config-section {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
  }

  .parameters-section,
  .fee-section,
  .preset-section {
    border: 1px solid var(--border-primary);
    border-radius: 4px;
    padding: var(--space-md);
    background: var(--surface-elevated);
  }

  .parameters-section h4,
  .fee-section h4,
  .preset-section h4 {
    margin: 0 0 var(--space-sm) 0;
    color: var(--text-primary);
    font-size: var(--font-size-sm);
    font-weight: 600;
  }

  .input-hint {
    font-size: var(--font-size-xs);
    color: var(--text-warning);
    font-style: italic;
  }

  .preset-actions {
    display: flex;
    gap: var(--space-sm);
  }

  .action-buttons {
    display: flex;
    gap: var(--space-sm);
    flex-wrap: wrap;
  }

  .btn-secondary.synced {
    background: var(--success-bg);
    color: var(--success-text);
    border-color: var(--success-border);
  }

  .btn-danger {
    background: var(--error-bg);
    color: var(--error-text);
    border-color: var(--error-border);
  }

  .btn-danger:hover {
    background: var(--error-bg-hover);
  }

  /* Mobile responsive */
  @media (max-width: 768px) {
    .action-buttons {
      flex-direction: column;
    }
    
    .preset-actions {
      flex-direction: column;
    }
  }
</style>