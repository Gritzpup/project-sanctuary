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
  /* Component styles are inherited from parent */
</style>