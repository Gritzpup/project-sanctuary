<script lang="ts">
  export let strategyParams: Record<string, any>;
</script>

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

<style>
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
  
  .warning-text {
    color: #ffa726;
    font-size: 12px;
    margin-top: 5px;
  }
</style>