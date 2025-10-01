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

  .position-count {
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

  .positions-grid {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .position-card {
    background: rgba(74, 0, 224, 0.1);
    border: 1px solid rgba(74, 0, 224, 0.2);
    border-radius: 6px;
    padding: 12px;
    display: flex;
    gap: 10px;
  }

  .position-index {
    font-size: 11px;
    color: #c4b5fd;
    font-weight: 600;
    min-width: 24px;
  }

  .position-details {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .position-info {
    display: flex;
    justify-content: space-between;
    font-size: 13px;
  }

  .position-size {
    color: #c4b5fd;
    font-weight: 500;
  }

  .position-entry {
    color: #888;
    font-size: 12px;
  }

  .position-metrics {
    display: flex;
    justify-content: space-between;
    font-size: 12px;
    font-weight: 500;
  }

  .profit {
    color: #4ade80;
  }

  .loss {
    color: #f87171;
  }

  .position-current {
    font-size: 11px;
    color: #888;
    text-align: right;
  }

  .no-positions {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    text-align: center;
    gap: 8px;
  }

  .no-positions-icon {
    font-size: 32px;
    opacity: 0.5;
  }

  .no-positions-text {
    color: #c4b5fd;
    font-size: 14px;
    font-weight: 500;
  }

  .no-positions-hint {
    color: #888;
    font-size: 12px;
  }
</style>