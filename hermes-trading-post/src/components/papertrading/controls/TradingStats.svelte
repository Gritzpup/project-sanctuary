<script lang="ts">
  export let balance: number;
  export let startingBalance: number;
  export let totalTrades: number;
  export let totalReturn: number;
  export let totalFees: number;
  export let totalRebates: number;
  export let totalRebalance: number;
  export let positions: any[];
  export let currentPrice: number;
  export let btcBalance: number;

  // Calculate derived stats
  $: growth = balance - startingBalance;
  $: growthPercent = ((balance - startingBalance) / startingBalance * 100);
  $: totalValue = balance + (btcBalance * currentPrice);
  $: totalPL = totalValue - startingBalance;
  $: netFeesAfterRebase = totalFees - totalRebates;

  // Calculate position stats
  $: totalPositionSize = positions.reduce((sum, pos) => sum + (pos.size || 0), 0);
  $: averageEntryPrice = positions.length > 0 && totalPositionSize > 0 ? 
    positions.reduce((sum, pos) => sum + ((pos.entryPrice || 0) * (pos.size || 0)), 0) / totalPositionSize : 0;
</script>

<div class="control-group">
  <label>Trading Stats</label>
  <div class="stats-panel">
    <div class="stats-grid">
      <div class="stat-item">Start: <span class="stat-value">${startingBalance.toLocaleString()}</span></div>
      <div class="stat-item">Growth: <span class="stat-value" class:profit={growth > 0} class:loss={growth < 0}>{growth > 0 ? '+' : ''}${growth.toLocaleString()}</span></div>
      <div class="stat-item">Rebalance: <span class="stat-value" class:profit={totalRebalance > 0}>${totalRebalance.toFixed(2)}</span></div>
      <div class="stat-item">Fees: <span class="stat-value">${totalFees.toFixed(2)}</span></div>
      <div class="stat-item">Position Size: <span class="stat-value">{totalPositionSize.toFixed(6)} BTC</span></div>
      <div class="stat-item">Avg Entry: <span class="stat-value">${averageEntryPrice > 0 ? averageEntryPrice.toLocaleString() : 'N/A'}</span></div>
      <div class="stat-item">Return: <span class="stat-value" class:profit={growthPercent > 0} class:loss={growthPercent < 0}>{growthPercent > 0 ? '+' : ''}{growthPercent.toFixed(1)}%</span></div>
      <div class="stat-item">Total: <span class="stat-value">${totalValue.toLocaleString()}</span></div>
      <div class="stat-item">Trades: <span class="stat-value">{totalTrades}</span></div>
      <div class="stat-item">P/L: <span class="stat-value" class:profit={totalPL > 0} class:loss={totalPL < 0}>{totalPL > 0 ? '+' : ''}${totalPL.toLocaleString()}</span></div>
    </div>
  </div>
</div>

<style>
  .control-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-bottom: 6px;
  }

  .control-group label {
    font-size: 13px;
    color: #888;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    font-weight: 500;
  }

  .stats-panel {
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(74, 0, 224, 0.2);
    border-radius: 4px;
    padding: 6px 8px;
  }

  .stats-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 2px 4px;
    margin: 0;
  }

  .stat-item {
    font-size: 14px;
    line-height: 1.2;
    color: #888;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    display: block;
    margin: 0;
    padding: 1px 0 1px 4px;
  }

  .stat-value {
    font-size: 14px;
    font-weight: 600;
    color: #d1d4dc;
    font-family: 'Courier New', monospace;
    display: inline;
  }

  .stat-value.profit {
    color: #26a69a;
  }

  .stat-value.loss {
    color: #ef4444;
  }
</style>