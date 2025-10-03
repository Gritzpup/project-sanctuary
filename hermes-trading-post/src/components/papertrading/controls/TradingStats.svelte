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
  export let vaultBalance: number = 0;
  export let btcVaultBalance: number = 0;
  export let nextBuyDistance: number | null = null;
  export let nextSellDistance: number | null = null;
  export let nextBuyPrice: number | null = null;
  export let nextSellPrice: number | null = null;
  
  // Debug logging
  $: {
    console.log('TradingStats props:', {
      nextBuyDistance,
      nextSellDistance, 
      nextBuyPrice,
      nextSellPrice
    });
  }

  // Calculate derived stats
  $: growth = balance - startingBalance;
  $: growthPercent = ((balance - startingBalance) / startingBalance * 100);
  $: totalValue = balance + (btcBalance * currentPrice);
  // Calculate total P/L including both realized and unrealized profits
  $: totalPL = totalValue - startingBalance;
  // Calculate unrealized P/L from current positions
  $: unrealizedPL = positions.length > 0 ? (currentPrice - averageEntryPrice) * totalPositionSize : 0;
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
      <div class="stat-item">Balance: <span class="stat-value">${balance.toLocaleString()}</span></div>
      <div class="stat-item">USDC Vault: <span class="stat-value" class:profit={vaultBalance > 0}>${vaultBalance.toFixed(2)}</span></div>
      <div class="stat-item">BTC Vault: <span class="stat-value" class:profit={btcVaultBalance > 0}>{btcVaultBalance.toFixed(6)} BTC</span></div>
      <div class="stat-item">Position Size: <span class="stat-value">{totalPositionSize.toFixed(6)} BTC (${(totalPositionSize * currentPrice).toLocaleString()})</span></div>
      <div class="stat-item">Avg Entry: <span class="stat-value">${averageEntryPrice > 0 ? averageEntryPrice.toLocaleString() : 'N/A'}</span></div>
      <div class="stat-item">Fees: <span class="stat-value">${totalFees.toFixed(2)}</span></div>
      <div class="stat-item">Net Fees: <span class="stat-value">${netFeesAfterRebase.toFixed(2)}</span></div>
      <div class="stat-item">Unrealized P/L: <span class="stat-value" class:profit={unrealizedPL > 0} class:loss={unrealizedPL < 0}>{unrealizedPL > 0 ? '+' : ''}${unrealizedPL.toFixed(2)}</span></div>
      <div class="stat-item">Total P/L: <span class="stat-value" class:profit={totalPL > 0} class:loss={totalPL < 0}>{totalPL > 0 ? '+' : ''}${totalPL.toLocaleString()}</span></div>
      <div class="stat-item">Total: <span class="stat-value">${totalValue.toLocaleString()}</span></div>
      <div class="stat-item">Return: <span class="stat-value" class:profit={growthPercent > 0} class:loss={growthPercent < 0}>{growthPercent > 0 ? '+' : ''}{growthPercent.toFixed(1)}%</span></div>
      <div class="stat-item">Next Buy: <span class="stat-value buy-trigger">{nextBuyDistance != null ? nextBuyDistance.toFixed(0) + '%' : 'N/A'}</span> <span class="price-small buy-price">{nextBuyPrice != null ? `($${nextBuyPrice.toLocaleString()})` : '($119,547)'}</span></div>
      <div class="stat-item">Next Sell: <span class="stat-value sell-trigger">{nextSellDistance != null ? nextSellDistance.toFixed(0) + '%' : 'N/A'}</span> <span class="price-small sell-price">{nextSellPrice != null ? `($${nextSellPrice.toLocaleString()})` : '($120,234)'}</span></div>
      <div class="stat-item">Trades: <span class="stat-value">{totalTrades}</span></div>
    </div>
  </div>
</div>

<style>
  .control-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 0;
    margin-top: 0;
  }

  /* Desktop spacing */
  @media (min-width: 769px) {
    .control-group {
      gap: 12px;
    }
  }

  .control-group label {
    font-size: 13px;
    color: #888;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    font-weight: 500;
  }

  .stats-panel {
    background: none;
    border: none;
    padding: 0;
    margin-top: 0;
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
    font-weight: 500;
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

  .stat-value.buy-trigger {
    color: #26a69a;
    font-weight: 600;
  }

  .stat-value.sell-trigger {
    color: #ef4444;
    font-weight: 600;
  }

  .price-small {
    font-size: 13px;
    font-weight: 400;
    font-family: 'Courier New', monospace;
  }

  .buy-price {
    color: #26a69a;
  }

  .sell-price {
    color: #ef4444;
  }
</style>