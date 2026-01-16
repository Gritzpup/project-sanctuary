<script lang="ts">
  // @ts-nocheck - VaultService module path compatibility
  import type { VaultData } from '../../services/vaultService';
  
  export let vaultData: VaultData | null;
  export let dailyGrowth: number = 0;
  export let weeklyGrowth: number = 0;
  export let monthlyGrowth: number = 0;
  
  function formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  }
  
  function formatPercent(value: number): string {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(2)}%`;
  }
</script>

<div class="overview-grid">
  <!-- Main vaults -->
  <div class="vault-card">
    <h3>BTC Vault</h3>
    <div class="vault-balance">{vaultData?.btcVault.balance.toFixed(6) || '0.000000'} BTC</div>
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
    padding: 20px 0;
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
    margin-bottom: 10px;
  }

  .vault-value {
    font-size: 18px;
    color: #758696;
    margin-bottom: 10px;
  }

  .vault-growth {
    font-size: 16px;
    font-weight: 500;
  }

  .vault-growth.positive,
  .positive {
    color: #26a69a;
  }

  .negative {
    color: #ef5350;
  }

  .metric-row {
    display: flex;
    justify-content: space-between;
    padding: 8px 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  }

  .metric-row:last-child {
    border-bottom: none;
  }

  .metric-row span:first-child {
    color: #758696;
  }

  .metric-row span:last-child {
    font-weight: 600;
  }
</style>