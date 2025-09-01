<script lang="ts">
  export let positions: any[] = [];
  export let currentPrice: number = 0;
  export let isRunning: boolean = false;
</script>

<div class="panel positions-panel">
  <div class="panel-header">
    <h2>Open Positions</h2>
    {#if positions.length > 0}
      <span class="position-count">{positions.length} active</span>
    {/if}
  </div>
  <div class="panel-content">
    {#if positions.length > 0}
      <div class="positions-grid">
        {#each positions as position, i}
          <div class="position-card">
            <div class="position-index">#{i + 1}</div>
            <div class="position-details">
              <div class="position-info">
                <span class="position-size">{position.size.toFixed(6)} BTC</span>
                <span class="position-entry">Entry: ${position.entryPrice.toFixed(2)}</span>
              </div>
              {#if currentPrice > 0}
                {@const pnl = (currentPrice - position.entryPrice) * position.size}
                {@const pnlPercent = ((currentPrice - position.entryPrice) / position.entryPrice) * 100}
                <div class="position-metrics">
                  <div class="pnl-amount" class:profit={pnl > 0} class:loss={pnl < 0}>
                    ${pnl.toFixed(2)}
                  </div>
                  <div class="pnl-percent" class:profit={pnl > 0} class:loss={pnl < 0}>
                    {pnl > 0 ? '+' : ''}{pnlPercent.toFixed(2)}%
                  </div>
                </div>
                <div class="position-current">
                  Current: ${currentPrice.toFixed(2)}
                </div>
              {/if}
            </div>
          </div>
        {/each}
      </div>
      <div class="positions-summary">
        <div class="summary-item">
          <span class="summary-label">Total Size</span>
          <span class="summary-value">{positions.reduce((sum, p) => sum + p.size, 0).toFixed(6)} BTC</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">Avg Entry</span>
          <span class="summary-value">
            ${(positions.reduce((sum, p) => sum + p.entryPrice * p.size, 0) / positions.reduce((sum, p) => sum + p.size, 0)).toFixed(2)}
          </span>
        </div>
        {#if currentPrice > 0}
          {@const totalPnl = positions.reduce((sum, p) => sum + (currentPrice - p.entryPrice) * p.size, 0)}
          <div class="summary-item">
            <span class="summary-label">Total P&L</span>
            <span class="summary-value" class:profit={totalPnl > 0} class:loss={totalPnl < 0}>
              ${totalPnl.toFixed(2)}
            </span>
          </div>
        {/if}
      </div>
    {:else}
      <div class="no-positions">
        <div class="no-positions-icon">📊</div>
        <div class="no-positions-text">No open positions</div>
        <div class="no-positions-hint">{isRunning ? 'Waiting for entry signal...' : 'Start trading to open positions'}</div>
      </div>
    {/if}
  </div>
</div>

<style>
  /* Component styles are inherited from parent */
</style>