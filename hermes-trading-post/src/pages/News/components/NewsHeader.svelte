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
    padding: var(--space-xl);
    background: var(--bg-surface);
    border-bottom: 1px solid var(--border-primary);
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .header h1 {
    margin: 0;
    font-size: var(--font-size-xl);
    color: var(--color-primary);
    font-weight: var(--font-weight-semibold);
  }

  .header-stats {
    display: flex;
    gap: var(--space-xl);
  }

  .stat-item {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
  }

  .stat-label {
    font-size: var(--font-size-xs);
    color: var(--text-secondary);
    text-transform: uppercase;
    font-weight: var(--font-weight-medium);
    letter-spacing: 0.5px;
  }

  .stat-value {
    font-size: var(--font-size-lg);
    font-weight: var(--font-weight-semibold);
    color: var(--text-primary);
    font-family: var(--font-family-mono, 'Courier New', monospace);
  }

  .stat-value.price {
    color: var(--color-success);
  }

  /* Mobile responsive */
  @media (max-width: 768px) {
    .header {
      flex-direction: column;
      gap: var(--space-md);
      align-items: flex-start;
      padding: var(--space-lg) var(--space-sm);
    }
    
    .header h1 {
      font-size: var(--font-size-lg);
    }
    
    .header-stats {
      gap: var(--space-md);
      width: 100%;
      justify-content: space-between;
    }
    
    .stat-value {
      font-size: var(--font-size-md);
    }
  }
</style>