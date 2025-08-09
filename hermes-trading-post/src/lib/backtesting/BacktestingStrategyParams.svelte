<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  
  export let selectedStrategyType: string;
  export let strategyParams: Record<string, any>;
  export let currentPrice: number = 0;
  export let startBalance: number;
  export let customPresets: Array<any>;
  export let selectedPresetIndex: number;
  
  const dispatch = createEventDispatcher();
  
  function applyPreset(index: number) {
    dispatch('applyPreset', { index });
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
  
  let isEditingPresets = false;
  let editingPresetName = '';
</script>

{#if selectedStrategyType === 'reverse-ratio'}
  <!-- Preset Management -->
  <div class="preset-management">
    <div class="preset-controls">
      <label class="preset-select-label">
        Quick Presets
        <select 
          bind:value={selectedPresetIndex}
          on:change={() => {
            applyPreset(selectedPresetIndex);
          }}
          class="preset-dropdown"
        >
          {#each customPresets as preset, index}
            <option value={index}>
              {preset.name} ({preset.initialDropPercent}% → {preset.profitTarget}%)
            </option>
          {/each}
        </select>
      </label>
    </div>
  </div>
  
  <!-- Position Sizing Section -->
  <div class="param-group">
    <h4 class="param-group-title">Position Sizing</h4>
    
    <div class="config-section">
      <label>
        Position Size Mode
        <select bind:value={strategyParams['reverse-ratio'].positionSizeMode}>
          <option value="percentage">Percentage of Balance</option>
          <option value="fixed">Fixed Dollar Amount</option>
        </select>
      </label>
    </div>
    
    {#if strategyParams['reverse-ratio'].positionSizeMode === 'percentage'}
      <div class="config-section">
        <label>
          Base Position Size (%)
          <input type="number" bind:value={strategyParams['reverse-ratio'].basePositionPercent} min="1" max="95" step="1" />
          <span class="input-hint">Percentage of balance for first buy level</span>
          {#if strategyParams['reverse-ratio'].basePositionPercent >= 80}
            <span class="position-size-warning">⚠️ HIGH RISK: Using {strategyParams['reverse-ratio'].basePositionPercent}% of capital!</span>
          {/if}
        </label>
      </div>
    {:else}
      <div class="config-section">
        <label>
          Base Position Amount ($)
          <input type="number" bind:value={strategyParams['reverse-ratio'].basePositionAmount} min="10" max="1000" step="10" />
          <span class="input-hint">Dollar amount for first buy level</span>
        </label>
      </div>
    {/if}
    
    <div class="config-section">
      <label>
        Ratio Multiplier
        <input type="number" bind:value={strategyParams['reverse-ratio'].ratioMultiplier} min="1" max="5" step="0.25" />
        <span class="input-hint">How much to increase position size per level</span>
      </label>
    </div>
    
    <div class="config-section">
      <label>
        Max Total Position (%)
        <input type="number" bind:value={strategyParams['reverse-ratio'].maxPositionPercent} min="10" max="100" step="5" />
        <span class="input-hint">Maximum percentage of balance to use across all levels</span>
      </label>
    </div>
    
    <!-- Position Sizing Preview -->
    <div class="position-preview">
      <h5>Position Size Preview (First 5 levels)</h5>
      <div class="preview-table">
        {#each calculatePositionSizes(startBalance) as level}
          <div class="preview-row">
            <span class="preview-level">Level {level.level}:</span>
            <span class="preview-amount">${level.amount.toFixed(2)}</span>
            <span class="preview-percent">({level.percentage.toFixed(1)}%)</span>
          </div>
        {/each}
        <div class="preview-row total">
          <span class="preview-level">Total:</span>
          <span class="preview-amount">
            ${calculatePositionSizes(startBalance).reduce((sum, l) => sum + l.amount, 0).toFixed(2)}
          </span>
          <span class="preview-percent">
            ({calculatePositionSizes(startBalance).reduce((sum, l) => sum + l.percentage, 0).toFixed(1)}%)
          </span>
        </div>
      </div>
    </div>
  </div>
  
  <!-- Entry Conditions Section -->
  <div class="param-group">
    <h4 class="param-group-title">Entry Conditions</h4>
    
    <div class="config-section">
      <label>
        Initial Drop (%)
        <input type="number" bind:value={strategyParams['reverse-ratio'].initialDropPercent} min="0.01" max="10" step="0.01" />
        <span class="input-hint">Price drop from recent high to trigger first buy</span>
        {#if currentPrice > 0}
          <span class="price-preview">
            At current price ${currentPrice.toFixed(2)}, this means buying at ${(currentPrice * (1 - strategyParams['reverse-ratio'].initialDropPercent / 100)).toFixed(2)}
          </span>
        {/if}
      </label>
    </div>
    
    <div class="config-section">
      <label>
        Level Drop (%)
        <input type="number" bind:value={strategyParams['reverse-ratio'].levelDropPercent} min="0.01" max="10" step="0.01" />
        <span class="input-hint">Additional drop between each buy level</span>
      </label>
    </div>
    
    <div class="config-section">
      <label>
        Max Levels
        <input type="number" bind:value={strategyParams['reverse-ratio'].maxLevels} min="3" max="30" step="1" />
        <span class="input-hint">Maximum number of buy levels</span>
      </label>
    </div>
  </div>
  
  <!-- Exit Strategy Section -->
  <div class="param-group">
    <h4 class="param-group-title">Exit Strategy</h4>
    
    <div class="config-section">
      <label>
        Profit Target (%)
        <input type="number" bind:value={strategyParams['reverse-ratio'].profitTarget} min="0.1" max="20" step="0.05" />
        <span class="input-hint">Sell all positions when first entry reaches this profit</span>
        {#if currentPrice > 0 && strategyParams['reverse-ratio'].initialDropPercent > 0}
          <span class="price-preview">
            Sell target: ${(currentPrice * (1 - strategyParams['reverse-ratio'].initialDropPercent / 100) * (1 + strategyParams['reverse-ratio'].profitTarget / 100)).toFixed(2)}
          </span>
        {/if}
      </label>
    </div>
  </div>
  
  <!-- Vault Configuration Section -->
  <div class="param-group">
    <h4 class="param-group-title">Vault Configuration</h4>
    
    <div class="config-section">
      <h5 class="config-subtitle">Profit Distribution</h5>
      <label>
        BTC Vault Allocation (%)
        <input type="number" bind:value={strategyParams['reverse-ratio'].vaultConfig.btcVaultPercent} min="0" max="100" step="0.1" />
        <span class="input-hint">Percentage of profits allocated to BTC vault (default: 14.3% = 1/7)</span>
      </label>
    </div>
    
    <div class="config-section">
      <label>
        USD Growth Allocation (%)
        <input type="number" bind:value={strategyParams['reverse-ratio'].vaultConfig.usdGrowthPercent} min="0" max="100" step="0.1" />
        <span class="input-hint">Percentage of profits to grow trading balance (default: 14.3% = 1/7)</span>
      </label>
    </div>
    
    <div class="config-section">
      <label>
        USDC Vault Allocation (%)
        <input type="number" bind:value={strategyParams['reverse-ratio'].vaultConfig.usdcVaultPercent} min="0" max="100" step="0.1" />
        <span class="input-hint">Percentage of profits to USDC vault (default: 71.4% = 5/7)</span>
      </label>
      {#if strategyParams['reverse-ratio'].vaultConfig.btcVaultPercent + strategyParams['reverse-ratio'].vaultConfig.usdGrowthPercent + strategyParams['reverse-ratio'].vaultConfig.usdcVaultPercent !== 100}
        <span class="warning-text">⚠️ Allocations should sum to 100% (current: {(strategyParams['reverse-ratio'].vaultConfig.btcVaultPercent + strategyParams['reverse-ratio'].vaultConfig.usdGrowthPercent + strategyParams['reverse-ratio'].vaultConfig.usdcVaultPercent).toFixed(1)}%)</span>
      {/if}
    </div>
    
    <div class="config-section">
      <h5 class="config-subtitle">Compound Settings</h5>
      <label>
        Compound Frequency
        <select bind:value={strategyParams['reverse-ratio'].vaultConfig.compoundFrequency}>
          <option value="trade">Every Trade</option>
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
        </select>
        <span class="input-hint">How often to compound profits</span>
      </label>
    </div>
    
    <div class="config-section">
      <label>
        Min Compound Amount ($)
        <input type="number" bind:value={strategyParams['reverse-ratio'].vaultConfig.minCompoundAmount} min="0.01" max="100" step="0.01" />
        <span class="input-hint">Minimum profit required to trigger compound</span>
      </label>
    </div>
    
    <div class="config-section">
      <label>
        <input type="checkbox" bind:checked={strategyParams['reverse-ratio'].vaultConfig.autoCompound} />
        Auto-Compound
        <span class="input-hint">Automatically compound vault earnings</span>
      </label>
    </div>
    
    <div class="config-section">
      <h5 class="config-subtitle">Vault Targets (Optional)</h5>
      <label>
        BTC Vault Target
        <input type="number" bind:value={strategyParams['reverse-ratio'].vaultConfig.btcVaultTarget} min="0" max="10" step="0.01" />
        <span class="input-hint">Target BTC amount for vault (optional)</span>
      </label>
    </div>
    
    <div class="config-section">
      <label>
        USDC Vault Target ($)
        <input type="number" bind:value={strategyParams['reverse-ratio'].vaultConfig.usdcVaultTarget} min="0" max="1000000" step="100" />
        <span class="input-hint">Target USDC amount for vault (optional)</span>
      </label>
    </div>
    
    <div class="config-section">
      <label>
        Rebalance Threshold (%)
        <input type="number" bind:value={strategyParams['reverse-ratio'].vaultConfig.rebalanceThreshold} min="0" max="20" step="0.5" />
        <span class="input-hint">Rebalance when allocation deviates by this percentage</span>
      </label>
    </div>
  </div>
{:else if selectedStrategyType === 'grid-trading'}
  <div class="config-section">
    <label>
      Grid Levels
      <input type="number" bind:value={strategyParams['grid-trading'].gridLevels} min="5" max="20" step="1" />
    </label>
  </div>
  <div class="config-section">
    <label>
      Grid Spacing (%)
      <input type="number" bind:value={strategyParams['grid-trading'].gridSpacing} min="0.5" max="5" step="0.5" />
    </label>
  </div>
  <div class="config-section">
    <label>
      Position Size
      <input type="number" bind:value={strategyParams['grid-trading'].positionSize} min="0.01" max="1" step="0.01" />
    </label>
  </div>
  <div class="config-section">
    <label>
      Take Profit (%)
      <input type="number" bind:value={strategyParams['grid-trading'].takeProfit} min="1" max="10" step="0.5" />
    </label>
  </div>
{:else if selectedStrategyType === 'rsi-mean-reversion'}
  <div class="config-section">
    <label>
      RSI Period
      <input type="number" bind:value={strategyParams['rsi-mean-reversion'].rsiPeriod} min="7" max="30" step="1" />
    </label>
  </div>
  <div class="config-section">
    <label>
      Oversold Level
      <input type="number" bind:value={strategyParams['rsi-mean-reversion'].oversoldLevel} min="10" max="40" step="5" />
    </label>
  </div>
  <div class="config-section">
    <label>
      Overbought Level
      <input type="number" bind:value={strategyParams['rsi-mean-reversion'].overboughtLevel} min="60" max="90" step="5" />
    </label>
  </div>
  <div class="config-section">
    <label>
      Position Size
      <input type="number" bind:value={strategyParams['rsi-mean-reversion'].positionSize} min="0.01" max="1" step="0.01" />
    </label>
  </div>
{:else if selectedStrategyType === 'dca'}
  <div class="config-section">
    <label>
      Interval (Hours)
      <input type="number" bind:value={strategyParams['dca'].intervalHours} min="1" max="168" step="1" />
    </label>
  </div>
  <div class="config-section">
    <label>
      Amount Per Buy ($)
      <input type="number" bind:value={strategyParams['dca'].amountPerBuy} min="10" max="1000" step="10" />
    </label>
  </div>
  <div class="config-section">
    <label>
      Drop Threshold (%)
      <input type="number" bind:value={strategyParams['dca'].dropThreshold} min="1" max="20" step="1" />
      <span class="input-hint">Extra buy when price drops this %</span>
    </label>
  </div>
{:else if selectedStrategyType === 'vwap-bounce'}
  <div class="config-section">
    <label>
      VWAP Period
      <input type="number" bind:value={strategyParams['vwap-bounce'].vwapPeriod} min="10" max="50" step="5" />
    </label>
  </div>
  <div class="config-section">
    <label>
      Buy Deviation
      <input type="number" bind:value={strategyParams['vwap-bounce'].deviationBuy} min="1" max="5" step="0.5" />
    </label>
  </div>
  <div class="config-section">
    <label>
      Sell Deviation
      <input type="number" bind:value={strategyParams['vwap-bounce'].deviationSell} min="1" max="5" step="0.5" />
    </label>
  </div>
{:else if selectedStrategyType === 'micro-scalping'}
  <div class="config-section">
    <label>
      Initial Drop (%)
      <input type="number" bind:value={strategyParams['micro-scalping'].initialDropPercent} min="0.1" max="5" step="0.1" />
    </label>
  </div>
  <div class="config-section">
    <label>
      Level Drop (%)
      <input type="number" bind:value={strategyParams['micro-scalping'].levelDropPercent} min="0.1" max="5" step="0.1" />
    </label>
  </div>
  <div class="config-section">
    <label>
      Ratio Multiplier
      <input type="number" bind:value={strategyParams['micro-scalping'].ratioMultiplier} min="1" max="3" step="0.1" />
    </label>
  </div>
  <div class="config-section">
    <label>
      Profit Target (%)
      <input type="number" bind:value={strategyParams['micro-scalping'].profitTarget} min="0.5" max="5" step="0.1" />
    </label>
  </div>
  <div class="config-section">
    <label>
      Max Levels
      <input type="number" bind:value={strategyParams['micro-scalping'].maxLevels} min="2" max="10" step="1" />
    </label>
  </div>
  <div class="config-section">
    <label>
      Lookback Period
      <input type="number" bind:value={strategyParams['micro-scalping'].lookbackPeriod} min="5" max="50" step="1" />
    </label>
  </div>
  <div class="config-section">
    <label>
      Base Position (%)
      <input type="number" bind:value={strategyParams['micro-scalping'].basePositionPercent} min="5" max="50" step="5" />
    </label>
  </div>
  <div class="config-section">
    <label>
      Max Position (%)
      <input type="number" bind:value={strategyParams['micro-scalping'].maxPositionPercent} min="50" max="100" step="5" />
    </label>
  </div>
{:else if selectedStrategyType === 'proper-scalping'}
  <div class="config-section">
    <label>
      Position Size (%)
      <input type="number" bind:value={strategyParams['proper-scalping'].positionSize} min="1" max="20" step="1" />
    </label>
  </div>
  <div class="config-section">
    <label>
      Max Open Positions
      <input type="number" bind:value={strategyParams['proper-scalping'].maxOpenPositions} min="1" max="10" step="1" />
    </label>
  </div>
  <div class="config-section">
    <label>
      RSI Period
      <input type="number" bind:value={strategyParams['proper-scalping'].rsiPeriod} min="5" max="20" step="1" />
    </label>
  </div>
  <div class="config-section">
    <label>
      RSI Overbought
      <input type="number" bind:value={strategyParams['proper-scalping'].rsiOverbought} min="60" max="90" step="5" />
    </label>
  </div>
  <div class="config-section">
    <label>
      RSI Oversold
      <input type="number" bind:value={strategyParams['proper-scalping'].rsiOversold} min="10" max="40" step="5" />
    </label>
  </div>
  <div class="config-section">
    <label>
      Stop Loss (%)
      <input type="number" bind:value={strategyParams['proper-scalping'].stopLoss} min="0.1" max="5" step="0.1" />
    </label>
  </div>
  <div class="config-section">
    <label>
      Profit Target (%)
      <input type="number" bind:value={strategyParams['proper-scalping'].profitTarget} min="0.5" max="10" step="0.5" />
    </label>
  </div>
  <div class="config-section">
    <label>
      <input type="checkbox" bind:checked={strategyParams['proper-scalping'].trailingStop} />
      Use Trailing Stop
    </label>
  </div>
  {#if strategyParams['proper-scalping'].trailingStop}
    <div class="config-section">
      <label>
        Trailing Stop (%)
        <input type="number" bind:value={strategyParams['proper-scalping'].trailingStopPercent} min="0.1" max="2" step="0.1" />
      </label>
    </div>
  {/if}
{/if}

<style>
  .preset-management {
    margin-bottom: 20px;
  }
  
  .preset-controls {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  
  .preset-select-label {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 14px;
    color: #d1d4dc;
  }
  
  .preset-dropdown {
    flex: 1;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(74, 0, 224, 0.3);
    border-radius: 6px;
    color: #d1d4dc;
    padding: 8px 12px;
    font-size: 13px;
  }
  
  .param-group {
    margin-bottom: 30px;
    padding-bottom: 20px;
    border-bottom: 1px solid rgba(74, 0, 224, 0.2);
  }
  
  .param-group:last-child {
    border-bottom: none;
  }
  
  .param-group-title {
    margin: 0 0 15px 0;
    color: #a78bfa;
    font-size: 16px;
    font-weight: 600;
  }
  
  .config-section {
    margin-bottom: 20px;
  }
  
  .config-subtitle {
    margin: 0 0 10px 0;
    color: #a78bfa;
    font-size: 14px;
    font-weight: 500;
  }
  
  label {
    display: flex;
    flex-direction: column;
    gap: 8px;
    font-size: 14px;
    color: #d1d4dc;
  }
  
  input[type="number"],
  input[type="text"],
  select {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(74, 0, 224, 0.3);
    border-radius: 6px;
    color: #d1d4dc;
    padding: 10px 12px;
    font-size: 14px;
    transition: all 0.2s;
  }
  
  input[type="number"]:focus,
  input[type="text"]:focus,
  select:focus {
    outline: none;
    border-color: rgba(74, 0, 224, 0.6);
    background: rgba(255, 255, 255, 0.08);
  }
  
  input[type="checkbox"] {
    width: 18px;
    height: 18px;
    cursor: pointer;
  }
  
  .input-hint {
    font-size: 11px;
    color: #888;
    font-style: italic;
  }
  
  .price-preview {
    font-size: 12px;
    color: #a78bfa;
    background: rgba(167, 139, 250, 0.1);
    padding: 5px 10px;
    border-radius: 4px;
    margin-top: 5px;
  }
  
  .position-size-warning {
    color: #ffa726;
    font-size: 12px;
    font-weight: 600;
  }
  
  .warning-text {
    color: #ffa726;
    font-size: 12px;
    margin-top: 5px;
  }
  
  .position-preview {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(74, 0, 224, 0.2);
    border-radius: 8px;
    padding: 15px;
    margin-top: 15px;
  }
  
  .position-preview h5 {
    margin: 0 0 10px 0;
    color: #a78bfa;
    font-size: 14px;
  }
  
  .preview-table {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  
  .preview-row {
    display: flex;
    align-items: center;
    font-size: 13px;
  }
  
  .preview-row.total {
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px solid rgba(74, 0, 224, 0.2);
    font-weight: 600;
  }
  
  .preview-level {
    flex: 0 0 80px;
    color: #888;
  }
  
  .preview-amount {
    flex: 0 0 100px;
    color: #d1d4dc;
    text-align: right;
  }
  
  .preview-percent {
    flex: 0 0 80px;
    color: #888;
    text-align: right;
  }
</style>