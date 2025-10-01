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
  
  .stats-panel {
    height: auto;
    min-height: 200px;
  }
  
  .market-stat {
    display: flex;
    justify-content: space-between;
    padding: 10px 0;
    border-bottom: 1px solid rgba(74, 0, 224, 0.1);
  }
  
  .market-stat:last-child {
    border-bottom: none;
  }
</style>