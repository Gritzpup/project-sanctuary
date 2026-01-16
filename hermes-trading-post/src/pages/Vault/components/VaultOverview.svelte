<script lang="ts">
  // @ts-nocheck - VaultData optional property access
  import type { VaultData } from '../../../services/state/vaultService';

  export let vaultData: VaultData | null;
  export let dailyGrowth: number;
  export let weeklyGrowth: number;
  export let monthlyGrowth: number;

  // Format currency
  function formatCurrency(value: number): string {
    return `$${value.toFixed(2)}`;
  }

  // Format percentage
  function formatPercent(value: number): string {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(2)}%`;
  }
</script>

<div class="overview-grid">
  <!-- Main vaults -->
  <div class="vault-card">
    <h3>BTC Vault</h3>
    <div class="vault-balance">{vaultData?.btcVault.balance.toFixed(6)} BTC</div>
    <div class="vault-value">{formatCurrency(vaultData?.btcVault.value || 0)}</div>
    <div class="vault-growth" class:positive={vaultData?.btcVault.growthPercent >= 0}>
      {formatPercent(vaultData?.btcVault.growthPercent || 0)}
    </div>
  </div>
  
  <div class="vault-card">
    <h3>USD Growth Vault</h3>
    <div class="vault-balance">{formatCurrency(vaultData?.usdVault.balance || 0)}</div>
    <div class="vault-growth" class:positive={vaultData?.usdVault.growthPercent >= 0}>
      {formatPercent(vaultData?.usdVault.growthPercent || 0)}
    </div>
  </div>
  
  <div class="vault-card">
    <h3>USDC Vault</h3>
    <div class="vault-balance">{formatCurrency(vaultData?.usdcVault.balance || 0)}</div>
    <div class="vault-growth" class:positive={vaultData?.usdcVault.growthPercent >= 0}>
      {formatPercent(vaultData?.usdcVault.growthPercent || 0)}
    </div>
  </div>
  
  <!-- Growth metrics -->
  <div class="metrics-card">
    <h3>Growth Metrics</h3>
    <div class="metric-row">
      <span>Daily:</span>
      <span class:positive={dailyGrowth >= 0} class:negative={dailyGrowth < 0}>
        {formatPercent(dailyGrowth)}
      </span>
    </div>
    <div class="metric-row">
      <span>Weekly:</span>
      <span class:positive={weeklyGrowth >= 0} class:negative={weeklyGrowth < 0}>
        {formatPercent(weeklyGrowth)}
      </span>
    </div>
    <div class="metric-row">
      <span>Monthly:</span>
      <span class:positive={monthlyGrowth >= 0} class:negative={monthlyGrowth < 0}>
        {formatPercent(monthlyGrowth)}
      </span>
    </div>
  </div>
</div>

<style>
  .overview-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 20px;
  }

  .vault-card,
  .metrics-card {
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(74, 0, 224, 0.3);
    border-radius: 8px;
    padding: 20px;
  }

  .vault-card h3,
  .metrics-card h3 {
    margin: 0 0 15px 0;
    color: #a78bfa;
    font-size: 16px;
  }

  .vault-balance {
    font-size: 24px;
    font-weight: 600;
    color: #d1d4dc;
    margin-bottom: 8px;
  }

  .vault-value {
    font-size: 14px;
    color: #9ca3af;
    margin-bottom: 8px;
  }

  .vault-growth {
    font-size: 16px;
    font-weight: 600;
  }

  .positive {
    color: #22c55e;
  }

  .metric-row {
    display: flex;
    justify-content: space-between;
    padding: 8px 0;
    border-bottom: 1px solid rgba(74, 0, 224, 0.2);
  }

  .metric-row:last-child {
    border-bottom: none;
  }
</style>