<script lang="ts">
  // Portfolio data - would typically come from props or stores
  export let btcBalance: number = 0.00000000;
  export let usdBalance: number = 0.00;
  export let totalValue: number = 0.00;
</script>

<div class="panel portfolio-panel">
  <div class="panel-header">
    <h2>Portfolio Summary</h2>
  </div>
  <div class="panel-content">
    <div class="portfolio-item">
      <span>BTC Balance:</span>
      <span>{btcBalance.toFixed(8)}</span>
    </div>
    <div class="portfolio-item">
      <span>USD Balance:</span>
      <span>${usdBalance.toFixed(2)}</span>
    </div>
    <div class="portfolio-item">
      <span>Total Value:</span>
      <span>${totalValue.toFixed(2)}</span>
    </div>
  </div>
</div>

<style>
  /* Uses global .panel and .panel-header styles from layout-system.css */
  
  .portfolio-panel {
    height: auto;
    min-height: 200px;
  }
  
  .portfolio-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-sm) 0;
    border-bottom: 1px solid var(--border-subtle);
    font-size: var(--font-size-sm);
  }
  
  .portfolio-item:last-child {
    border-bottom: none;
  }

  .portfolio-item span:first-child {
    color: var(--text-secondary);
    font-weight: var(--font-weight-medium);
  }

  .portfolio-item span:last-child {
    color: var(--text-primary);
    font-weight: var(--font-weight-semibold);
    font-family: var(--font-family-mono, 'Courier New', monospace);
  }
</style>