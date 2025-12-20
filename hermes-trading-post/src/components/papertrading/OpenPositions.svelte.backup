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
            <div class="position-type">#{i + 1}</div>
            <div class="position-size">{position.size.toFixed(6)} BTC</div>
            <div class="position-details">
              {#if position.entryPrice}
                {@const pnl = (currentPrice - position.entryPrice) * position.size}
                {@const pnlPercent = ((currentPrice - position.entryPrice) / position.entryPrice) * 100}
                <span class="position-pnl-amount" class:profit={pnl > 0} class:loss={pnl < 0}>
                  {pnl > 0 ? '+' : ''}${pnl.toFixed(2)}
                </span>
                <span class="position-pnl-percent" class:profit={pnl > 0} class:loss={pnl < 0}>
                  {pnl > 0 ? '+' : ''}{pnlPercent.toFixed(2)}%
                </span>
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
    height: 100%;
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
    background: linear-gradient(to right, rgba(255, 255, 255, 0.02), rgba(0, 0, 0, 0.6));
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
    padding: 10px 12px;
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .position-type {
    font-size: 11px;
    font-weight: 600;
    color: #c4b5fd;
    min-width: 40px;
  }

  .position-size {
    color: #c4b5fd;
    font-weight: 500;
    font-size: 13px;
  }

  .position-details {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 2px;
    margin-left: auto;
  }

  .position-pnl-amount {
    font-size: 13px;
    color: #c4b5fd;
    font-weight: 500;
  }

  .position-pnl-percent {
    font-size: 11px;
    color: #888;
  }

  .profit {
    color: #26a69a;
  }

  .loss {
    color: #ef4444;
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