<script lang="ts">
  export let trades: any[] = [];
</script>

<div class="panel history-panel">
  <div class="panel-header">
    <h2>Trading History</h2>
    {#if trades.length > 0}
      <span class="trade-count">{trades.length} trades</span>
    {/if}
  </div>
  <div class="panel-content">
    {#if trades.length > 0}
      <div class="trades-list">
        {#each trades.slice(-10).reverse() as trade}
          <div class="trade-item" class:buy={(trade.type || trade.side) === 'buy'} class:sell={(trade.type || trade.side) === 'sell'}>
            <div class="trade-type">{(trade.type || trade.side).toUpperCase()}</div>
            <div class="trade-details">
              <span class="trade-price">${trade.price.toFixed(2)}</span>
              <span class="trade-time">{new Date(trade.timestamp).toLocaleTimeString()}</span>
            </div>
          </div>
        {/each}
      </div>
    {:else}
      <div class="no-trades">No trades yet</div>
    {/if}
  </div>
</div>

<style>
  .panel {
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(74, 0, 224, 0.3);
    border-radius: 8px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    height: 300px;
  }

  .panel-header {
    background: var(--bg-primary-subtle);
    padding: 15px 20px;
    border-bottom: 1px solid var(--border-primary);
    display: flex;
    justify-content: space-between;
    align-items: center;
    min-height: 50px;
    flex-shrink: 0;
  }

  .panel-header h2 {
    margin: 0;
    font-size: 16px;
    color: #a78bfa;
    font-weight: 500;
  }

  .trade-count {
    font-size: 12px;
    color: #c4b5fd;
    background: rgba(74, 0, 224, 0.2);
    padding: 4px 8px;
    border-radius: 4px;
  }

  .panel-content {
    padding: 15px;
    overflow-y: auto;
    flex: 1;
  }

  .trades-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .trade-item {
    background: rgba(74, 0, 224, 0.1);
    border: 1px solid rgba(74, 0, 224, 0.2);
    border-radius: 6px;
    padding: 10px 12px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .trade-item.buy {
    border-left: 3px solid #4ade80;
  }

  .trade-item.sell {
    border-left: 3px solid #f87171;
  }

  .trade-type {
    font-size: 11px;
    font-weight: 600;
    color: #c4b5fd;
    min-width: 40px;
  }

  .trade-details {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 2px;
  }

  .trade-price {
    font-size: 13px;
    color: #c4b5fd;
    font-weight: 500;
  }

  .trade-time {
    font-size: 11px;
    color: #888;
  }

  .no-trades {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: #888;
    font-size: 14px;
  }
</style>