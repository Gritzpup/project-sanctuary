<script lang="ts">
  export let balance: number;
  export let startingBalance: number;
  export let totalTrades: number;
  export let totalFees: number;
  export let totalRebates: number;
  export let totalReturn: number = 0; // Realized profit from backend
  export let positions: any[];
  export let currentPrice: number;
  export let btcBalance: number;
  export let vaultBalance: number = 0;
  export let btcVaultBalance: number = 0;
  export let nextBuyDistance: number | null = null;
  export let nextSellDistance: number | null = null;
  export let nextBuyPrice: number | null = null;
  export let nextSellPrice: number | null = null;

  // Calculate derived stats
  $: growth = balance - startingBalance;
  $: growthPercent = ((balance - startingBalance) / startingBalance * 100);

  // Calculate position cost basis (what was SPENT to buy the BTC)
  $: positionCostBasis = positions.reduce((sum, pos) => sum + ((pos.entryPrice || 0) * (pos.size || 0)), 0);

  // Calculate unrealized P/L from current positions
  $: totalPositionSize = positions.reduce((sum, pos) => sum + (pos.size || 0), 0);
  $: averageEntryPrice = positions.length > 0 && totalPositionSize > 0 ?
    positions.reduce((sum, pos) => sum + ((pos.entryPrice || 0) * (pos.size || 0)), 0) / totalPositionSize : 0;
  $: unrealizedPL = positions.length > 0 ? (currentPrice - averageEntryPrice) * totalPositionSize : 0;

  // 🎯 Total P/L using cost basis (ignores unrealized gains/losses)
  // This shows realized P/L only - as if the money spent on BTC is still there
  // Balance + What was spent on BTC + Vaults = How much total capital you have deployed
  $: currentBtcValue = btcBalance * currentPrice;
  $: totalCapitalDeployed = balance + positionCostBasis + vaultBalance + (btcVaultBalance * currentPrice);
  $: totalPL = totalCapitalDeployed - startingBalance;


  // Total value includes current market value of positions
  $: totalValue = balance + (btcBalance * currentPrice) + vaultBalance + (btcVaultBalance * currentPrice);
  $: netFeesAfterRebase = totalFees - totalRebates;
</script>

<div class="control-group">
  <h4 class="control-label">Trading Stats</h4>
  <div class="stats-panel">
    <div class="stats-grid">
      <div class="stat-item">Start: <span class="stat-value">${startingBalance.toLocaleString()}</span></div>
      <div class="stat-item">Balance: <span class="stat-value">${balance.toLocaleString()}</span></div>
      <div class="stat-item">USDC Vault: <span class="stat-value" class:profit={vaultBalance > 0}>${vaultBalance.toFixed(2)}</span></div>
      <div class="stat-item">BTC Vault: <span class="stat-value" class:profit={btcVaultBalance > 0}>{btcVaultBalance.toFixed(6)} BTC</span></div>
      <div class="stat-item">Position Size: <span class="stat-value">${(totalPositionSize * currentPrice).toLocaleString()}</span></div>
      <div class="stat-item">Avg Entry: <span class="stat-value">${averageEntryPrice > 0 ? averageEntryPrice.toLocaleString() : 'N/A'}</span></div>
      <div class="stat-item">Fees: <span class="stat-value">${totalFees.toFixed(2)}</span></div>
      <div class="stat-item">Net Fees: <span class="stat-value">${netFeesAfterRebase.toFixed(2)}</span></div>
      <div class="stat-item">Unrealized P/L: <span class="stat-value" class:profit={unrealizedPL > 0} class:loss={unrealizedPL < 0}>{unrealizedPL > 0 ? '+' : ''}${unrealizedPL.toFixed(2)}</span></div>
      <div class="stat-item">Total P/L: <span class="stat-value" class:profit={totalPL > 0} class:loss={totalPL < 0}>{totalPL > 0 ? '+' : ''}${totalPL.toLocaleString()}</span></div>
      <div class="stat-item">Total: <span class="stat-value">${totalValue.toLocaleString()}</span></div>
      <div class="stat-item">Return: <span class="stat-value" class:profit={growthPercent > 0} class:loss={growthPercent < 0}>{growthPercent > 0 ? '+' : ''}{growthPercent.toFixed(1)}%</span></div>
      <div class="stat-item">Next Buy: <span class="stat-value buy-trigger">{nextBuyDistance != null ? nextBuyDistance.toFixed(0) + '%' : 'N/A'}</span> <span class="price-small buy-price">{nextBuyPrice != null ? `($${nextBuyPrice.toFixed(0)})` : '(N/A)'}</span></div>
      <div class="stat-item">Next Sell: <span class="stat-value sell-trigger">{nextSellDistance != null ? nextSellDistance.toFixed(0) + '%' : 'N/A'}</span> <span class="price-small sell-price">{nextSellPrice != null ? `($${nextSellPrice.toFixed(0)})` : '(N/A)'}</span></div>
      <div class="stat-item">Trades: <span class="stat-value">{totalTrades}</span></div>
    </div>
  </div>
</div>

<style>
  .control-group {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
    margin-bottom: 0;
    margin-top: 0;
  }

  /* Desktop spacing */
  @media (min-width: 769px) {
    .control-group {
      gap: var(--space-md);
    }
  }

  .control-group .control-label {
    font-size: 13px;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    font-weight: var(--font-weight-medium);
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
    gap: 2px var(--space-xs);
    margin: 0;
  }

  .stat-item {
    font-size: var(--font-size-sm);
    line-height: 1.2;
    color: var(--text-secondary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    display: block;
    margin: 0;
    padding: 1px 0 1px var(--space-xs);
  }

  .stat-value {
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-medium);
    color: var(--text-primary);
    font-family: var(--font-family-mono, 'Courier New', monospace);
    display: inline;
  }

  .stat-value.profit {
    color: var(--color-success);
  }

  .stat-value.loss {
    color: var(--color-error);
  }

  .stat-value.buy-trigger {
    color: var(--color-success);
    font-weight: var(--font-weight-semibold);
  }

  .stat-value.sell-trigger {
    color: var(--color-error);
    font-weight: var(--font-weight-semibold);
  }

  .price-small {
    font-size: var(--font-size-xs);
    font-weight: var(--font-weight-normal);
    font-family: var(--font-family-mono, 'Courier New', monospace);
  }

  .buy-price {
    color: var(--color-success);
  }

  .sell-price {
    color: var(--color-error);
  }
</style>