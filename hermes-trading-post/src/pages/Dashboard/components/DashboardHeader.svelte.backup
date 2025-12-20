<script lang="ts">
  export let currentPrice: number;
  export let connectionStatus: 'connected' | 'disconnected' | 'error' | 'loading';
</script>

<div class="header-bar">
  <h1>Dashboard</h1>
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
    padding: var(--space-xl) var(--space-2xl);
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border-secondary);
  }
  
  .header-bar h1 {
    font-size: var(--font-size-3xl);
    color: var(--text-accent);
    margin: 0;
    font-weight: var(--font-weight-semibold);
  }
  
  .header-stats {
    display: flex;
    gap: var(--space-2xl);
  }
  
  .stat-item {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: var(--space-xs);
  }
  
  .stat-label {
    font-size: var(--font-size-xs);
    color: var(--text-muted);
    text-transform: uppercase;
    font-weight: var(--font-weight-medium);
  }
  
  .stat-value {
    font-size: var(--font-size-xl);
    font-weight: var(--font-weight-bold);
    color: var(--text-primary);
  }
  
  .stat-value.price {
    color: var(--color-success);
  }
  
  .stat-value.status {
    font-size: var(--font-size-sm);
    text-transform: capitalize;
  }
  
  .stat-value.connected {
    color: var(--color-success);
  }
  
  .stat-value.disconnected {
    color: var(--color-warning);
  }
  
  .stat-value.error {
    color: var(--color-error);
  }
  
  .stat-value.loading {
    color: var(--text-muted);
  }

  /* Mobile responsive */
  @media (max-width: 768px) {
    .header-bar {
      padding: var(--space-lg);
    }
    
    .header-bar h1 {
      font-size: var(--font-size-xl);
    }
    
    .header-stats {
      gap: var(--space-lg);
    }
    
    .stat-value {
      font-size: var(--font-size-lg);
    }
  }
</style>