<script lang="ts">
  export let currentPrice: number = 0;
  export let connectionStatus: 'connected' | 'disconnected' | 'error' | 'loading' = 'loading';
</script>

<div class="header">
  <h1>Paper Trading</h1>
  <div class="header-stats">
    <div class="stat-item">
      <span class="stat-label">BTC Price</span>
      <span class="stat-value price">${currentPrice ? currentPrice.toFixed(2) : '0.00'}</span>
    </div>
    <div class="stat-item">
      <span class="stat-label">Connection</span>
      <span class="stat-value status" class:connected={connectionStatus === 'connected'} class:disconnected={connectionStatus === 'disconnected'} class:error={connectionStatus === 'error'} class:loading={connectionStatus === 'loading'}>
        {connectionStatus}
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

  .stat-value.status {
    padding: 4px 12px;
    border-radius: 4px;
    font-size: 12px;
    text-transform: uppercase;
    font-weight: 600;
  }

  .stat-value.status.connected {
    color: #26a69a;
    background: rgba(38, 166, 154, 0.1);
  }

  .stat-value.status.disconnected {
    color: #ff6b6b;
    background: rgba(255, 107, 107, 0.1);
  }

  .stat-value.status.error {
    color: #ff6b6b;
    background: rgba(255, 107, 107, 0.1);
  }

  .stat-value.status.loading {
    color: #ffa94d;
    background: rgba(255, 169, 77, 0.1);
  }

  /* Remove bottom spacing on mobile */
  @media (max-width: 768px) {
    .header {
      padding: 20px 20px 0 20px;
      margin-bottom: 0;
    }
  }
</style>