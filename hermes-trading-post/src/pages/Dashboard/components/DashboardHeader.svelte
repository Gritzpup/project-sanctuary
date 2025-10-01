<script lang="ts">
  export let currentPrice: number;
  export let connectionStatus: 'connected' | 'disconnected' | 'error' | 'loading';
</script>

<div class="header-bar">
  <h1>Trading Dashboard</h1>
  <div class="header-stats">
    <div class="stat-item">
      <span class="stat-label">BTC/USD</span>
      <span class="stat-value price">${currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
    </div>
    <div class="stat-item">
      <span class="stat-label">Status</span>
      <span class="stat-value status {connectionStatus}">{connectionStatus}</span>
    </div>
  </div>
</div>

<style>
  .header-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20px 30px;
    background: #0f0f0f;
    border-bottom: 1px solid rgba(74, 0, 224, 0.2);
  }
  
  .header-bar h1 {
    font-size: 24px;
    color: #a78bfa;
    margin: 0;
  }
  
  .header-stats {
    display: flex;
    gap: 30px;
  }
  
  .stat-item {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
  }
  
  .stat-label {
    font-size: 12px;
    color: #6b7280;
    text-transform: uppercase;
  }
  
  .stat-value {
    font-size: 18px;
    font-weight: bold;
  }
  
  .stat-value.price {
    color: #26a69a;
  }
  
  .stat-value.status {
    font-size: 14px;
  }
  
  .stat-value.connected {
    color: #10b981;
  }
  
  .stat-value.disconnected {
    color: #f59e0b;
  }
  
  .stat-value.error {
    color: #ef4444;
  }
  
  .stat-value.loading {
    color: #6b7280;
  }
</style>