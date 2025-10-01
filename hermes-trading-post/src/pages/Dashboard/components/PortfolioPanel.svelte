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
  .panel {
    background: rgba(22, 33, 62, 0.3);
    border: 1px solid rgba(74, 0, 224, 0.3);
    border-radius: 8px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  
  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 15px 20px;
    background: rgba(0, 0, 0, 0.3);
    border-bottom: 1px solid rgba(74, 0, 224, 0.2);
  }
  
  .panel-header h2 {
    font-size: 16px;
    margin: 0;
    color: #a78bfa;
  }
  
  .panel-content {
    flex: 1;
    padding: 20px;
    overflow: visible;
  }
  
  .portfolio-panel {
    height: auto;
    min-height: 200px;
  }
  
  .portfolio-item {
    display: flex;
    justify-content: space-between;
    padding: 10px 0;
    border-bottom: 1px solid rgba(74, 0, 224, 0.1);
  }
  
  .portfolio-item:last-child {
    border-bottom: none;
  }
</style>