<script lang="ts">
  export let totalValue: number;
  export let dailyGrowth: number;

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

<div class="header">
  <h1>Vault</h1>
  <div class="header-stats">
    <div class="stat-item">
      <span class="stat-label">Total Value</span>
      <span class="stat-value price">{formatCurrency(totalValue)}</span>
    </div>
    <div class="stat-item">
      <span class="stat-label">24h Growth</span>
      <span class="stat-value" class:positive={dailyGrowth >= 0} class:negative={dailyGrowth < 0}>
        {formatPercent(dailyGrowth)}
      </span>
    </div>
  </div>
</div>

<style>
  .header {
    padding: 20px;
    background: #0f0f0f;
    border-bottom: 1px solid rgba(74, 0, 224, 0.3);
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .header h1 {
    margin: 0;
    font-size: 24px;
    color: #a78bfa;
  }

  .header-stats {
    display: flex;
    gap: 30px;
  }

  .stat-item {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  .stat-label {
    font-size: 12px;
    color: #758696;
    text-transform: uppercase;
  }

  .stat-value {
    font-size: 18px;
    font-weight: 600;
  }

  .stat-value.price {
    color: #26a69a;
  }

  .stat-value.positive,
  .positive {
    color: #22c55e;
  }

  .stat-value.negative,
  .negative {
    color: #ef4444;
  }
</style>