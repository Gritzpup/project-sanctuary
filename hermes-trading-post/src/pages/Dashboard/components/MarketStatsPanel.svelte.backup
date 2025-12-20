<script lang="ts">
  // Market data - would typically come from props or API
  export let volume24h: string = '$2.4B';
  export let high24h: string = '$118,234';
  export let low24h: string = '$116,892';
</script>

<div class="panel stats-panel">
  <div class="panel-header">
    <h2>Market Stats</h2>
  </div>
  <div class="panel-content">
    <div class="market-stat">
      <span>24h Volume:</span>
      <span>{volume24h}</span>
    </div>
    <div class="market-stat">
      <span>24h High:</span>
      <span>{high24h}</span>
    </div>
    <div class="market-stat">
      <span>24h Low:</span>
      <span>{low24h}</span>
    </div>
  </div>
</div>

<style>
  /* Uses global .panel and .panel-header styles from layout-system.css */
  
  .stats-panel {
    height: auto;
    min-height: 200px;
  }
  
  .market-stat {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-sm) 0;
    border-bottom: 1px solid var(--border-subtle);
    font-size: var(--font-size-sm);
  }
  
  .market-stat:last-child {
    border-bottom: none;
  }

  .market-stat span:first-child {
    color: var(--text-secondary);
    font-weight: var(--font-weight-medium);
  }

  .market-stat span:last-child {
    color: var(--text-primary);
    font-weight: var(--font-weight-semibold);
    font-family: var(--font-family-mono, 'Courier New', monospace);
  }
</style>