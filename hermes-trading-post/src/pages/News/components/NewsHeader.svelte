<script lang="ts">
  export let currentPrice: number;
  export let filteredCount: number;
</script>

<div class="header">
  <h1>Crypto News</h1>
  <div class="header-stats">
    <div class="stat-item">
      <span class="stat-label">BTC Price</span>
      <span class="stat-value price">${currentPrice ? currentPrice.toFixed(2) : '0.00'}</span>
    </div>
    <div class="stat-item">
      <span class="stat-label">Articles</span>
      <span class="stat-value">{filteredCount}</span>
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
</style>