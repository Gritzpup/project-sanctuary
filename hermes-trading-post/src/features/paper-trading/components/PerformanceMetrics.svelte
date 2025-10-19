<script lang="ts">
  export let trades: any[] = [];
  export let balance: number = 10000;
  export let winRate: number = 0;
  export let totalReturn: number = 0;
  export let totalFees: number = 0;
  
  const startingBalance = 10000;
  $: netPnL = totalReturn - totalFees;
  $: growth = ((balance / startingBalance - 1) * 100);
</script>

{#if trades.length > 0}
  <div class="panel results-panel">
    <div class="panel-header">
      <h2>Performance Metrics</h2>
    </div>
    <div class="panel-content">
      <div class="results-grid">
        <div class="result-item">
          <span class="result-label">Total Trades</span>
          <span class="result-value">{trades.length}</span>
        </div>
        <div class="result-item">
          <span class="result-label">Win Rate</span>
          <span class="result-value" class:positive={winRate > 50} class:negative={winRate <= 50}>{winRate.toFixed(1)}%</span>
        </div>
        <div class="result-item">
          <span class="result-label">Total Return</span>
          <span class="result-value" class:positive={totalReturn > 0} class:negative={totalReturn < 0}>${totalReturn.toFixed(2)}</span>
        </div>
        <div class="result-item">
          <span class="result-label">Total Fees</span>
          <span class="result-value negative">-${Math.abs(totalFees).toFixed(2)}</span>
        </div>
        <div class="result-item">
          <span class="result-label">Net P&L</span>
          <span class="result-value" class:positive={netPnL > 0} class:negative={netPnL < 0}>
            ${netPnL.toFixed(2)}
          </span>
        </div>
        <div class="result-item">
          <span class="result-label">Starting Balance</span>
          <span class="result-value">${startingBalance.toFixed(2)}</span>
        </div>
        <div class="result-item">
          <span class="result-label">Current Balance</span>
          <span class="result-value">${balance.toFixed(2)}</span>
        </div>
        <div class="result-item">
          <span class="result-label">Growth</span>
          <span class="result-value" class:positive={growth > 0} class:negative={growth < 0}>
            {growth.toFixed(2)}%
          </span>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  /* Component styles are inherited from parent */
</style>