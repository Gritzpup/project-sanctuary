<script lang="ts">
  export let currentPrice: number = 0;
  export let connectionStatus: 'connected' | 'disconnected' | 'error' | 'loading' = 'loading';
</script>

<div class="header">
  <h1>Backtesting</h1>
  <div class="header-stats">
    <div class="stat-item">
      <span class="stat-label">BTC/USD</span>
      <span class="stat-value price">
        ${currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}
      </span>
    </div>
    <div class="stat-item">
      <span class="stat-label">Status</span>
      <span class="stat-value status {connectionStatus}">{connectionStatus}</span>
    </div>
  </div>
</div>