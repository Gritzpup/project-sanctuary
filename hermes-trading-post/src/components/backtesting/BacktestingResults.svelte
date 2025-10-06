<script lang="ts">
  import CompoundGrowthChart from '../../components/CompoundGrowthChart.svelte';
  import type { BacktestResult } from '../../strategies/base/StrategyTypes';
  
  export let backtestResults: BacktestResult | null = null;
  export let selectedStrategyType: string;
  export let strategyParams: Record<string, any>;
  export let selectedGranularity: string;
  export let startBalance: number;
  
  function getBtcPositions(): string {
    if (!backtestResults) return '0';
    
    // Calculate total BTC held in open positions
    const openPositions = backtestResults.trades.filter(t => t.type === 'buy');
    const closedPositions = backtestResults.trades.filter(t => t.type === 'sell');
    
    const totalBought = openPositions.reduce((sum, t) => sum + t.size, 0);
    const totalSold = closedPositions.reduce((sum, t) => sum + t.size, 0);
    
    return (totalBought - totalSold).toFixed(6);
  }
</script>

<div class="panel results-panel">
  <div class="panel-header">
    <h2>Backtest Results</h2>
  </div>
  <div class="panel-content">
    {#if !backtestResults}
      <div class="no-results">
        <p>Configure your strategy and run a backtest to see results</p>
      </div>
    {:else}
      {#if backtestResults.metrics.totalTrades === 0}
        <div class="no-trades-notice">
          <h3>No trades were executed</h3>
          <p>The strategy didn't find any trading opportunities in this period.</p>
          <p>Try:</p>
          <ul>
            <li>Lowering the "Initial Drop (%)" parameter (currently {strategyParams[selectedStrategyType].initialDropPercent}%)</li>
            <li>Selecting a different time period with more volatility</li>
            <li>Using a different strategy like DCA or Grid Trading</li>
          </ul>
        </div>
      {:else if backtestResults.metrics.totalTrades === 1 && selectedStrategyType === 'reverse-descending-grid'}
        <div class="single-trade-notice">
          <h3>⚠️ Only 1 buy level was used</h3>
          <p>The Reverse Descending Grid strategy only triggered one buy because:</p>
          <ul>
            <li>Price dropped {strategyParams['reverse-descending-grid'].initialDropPercent}% to trigger the first buy</li>
            <li>Price didn't drop another {strategyParams['reverse-descending-grid'].levelDropPercent}% for the second level</li>
            <li>Strategy is waiting for {strategyParams['reverse-descending-grid'].profitTarget}% profit to sell</li>
          </ul>
          <p><strong>For {selectedGranularity} timeframe, consider:</strong></p>
          <ul>
            <li>Use the ⚡ optimized parameters (click the timeframe to apply)</li>
            <li>Lower profit target for quicker exits</li>
            <li>Adjust position sizes to use more capital on first level</li>
          </ul>
        </div>
      {/if}
      
      <div class="results-summary">
        <div class="result-item">
          <span class="result-label">Total Trades</span>
          <span class="result-value">{backtestResults.metrics.totalTrades}</span>
        </div>
        <div class="result-item">
          <span class="result-label">Win Rate</span>
          <span class="result-value">{backtestResults.metrics.winRate.toFixed(1)}%</span>
        </div>
        <div class="result-item">
          <span class="result-label">Total Return</span>
          <span class="result-value" class:profit={backtestResults.metrics.totalReturn > 0} class:loss={backtestResults.metrics.totalReturn < 0}>
            ${backtestResults.metrics.totalReturn.toFixed(2)} ({backtestResults.metrics.totalReturnPercent.toFixed(2)}%)
          </span>
        </div>
        <div class="result-item">
          <span class="result-label">Max Drawdown</span>
          <span class="result-value loss">{backtestResults.metrics.maxDrawdown.toFixed(2)}%</span>
        </div>
        <div class="result-item">
          <span class="result-label">Sharpe Ratio</span>
          <span class="result-value">{backtestResults.metrics.sharpeRatio.toFixed(2)}</span>
        </div>
        <div class="result-item">
          <span class="result-label">Profit Factor</span>
          <span class="result-value">{backtestResults.metrics.profitFactor.toFixed(2)}</span>
        </div>
        <div class="result-item">
          <span class="result-label">USDC Vault Balance</span>
          <span class="result-value profit">${backtestResults.metrics.vaultBalance.toFixed(2)}</span>
        </div>
        <div class="result-item">
          <span class="result-label">BTC Vault</span>
          <span class="result-value">{backtestResults.metrics.btcGrowth.toFixed(6)} BTC</span>
        </div>
        <div class="result-item">
          <span class="result-label">BTC Open Positions</span>
          <span class="result-value">{getBtcPositions()} BTC</span>
        </div>
        {#if backtestResults.metrics.initialBalanceGrowth}
          <div class="result-item">
            <span class="result-label">Starting Balance Growth</span>
            <span class="result-value profit">
              ${backtestResults.metrics.initialBalanceGrowth.toFixed(2)} 
              ({backtestResults.metrics.initialBalanceGrowthPercent.toFixed(2)}%)
            </span>
          </div>
        {/if}
        {#if backtestResults.metrics.totalFees}
          <div class="result-item">
            <span class="result-label">Total Fees Paid</span>
            <span class="result-value loss">
              ${backtestResults.metrics.totalFees.toFixed(2)}
              {#if backtestResults.metrics.totalFeeRebates > 0}
                (Rebates: ${backtestResults.metrics.totalFeeRebates.toFixed(2)})
              {/if}
            </span>
          </div>
        {/if}
      </div>
      
      <h3>All Trades ({backtestResults.trades.length})</h3>
      <div class="trades-list">
        {#each backtestResults.trades.slice().reverse() as trade}
          <div class="trade-item" class:buy={trade.type === 'buy'} class:sell={trade.type === 'sell'}>
            <div class="trade-header">
              <span class="trade-type">{trade.type.toUpperCase()}</span>
              <span class="trade-date">{new Date(trade.timestamp * 1000).toLocaleDateString()}</span>
            </div>
            <div class="trade-details">
              <span>Price: ${trade.price.toLocaleString()}</span>
              <span>Size: {trade.size.toFixed(6)} BTC</span>
              <span>Value: ${trade.value.toFixed(2)}</span>
              {#if trade.profit !== undefined}
                <span class:profit={trade.profit > 0} class:loss={trade.profit < 0}>
                  P&L: ${trade.profit.toFixed(2)}
                </span>
              {/if}
              <span class="trade-reason">{trade.reason}</span>
            </div>
          </div>
        {/each}
      </div>
      
      {#if backtestResults?.chartData}
        <div class="compound-growth-section">
          <h3>Compound Growth Visualization</h3>
          <CompoundGrowthChart 
            vaultData={backtestResults.chartData.vaultGrowth || []}
            btcData={backtestResults.chartData.btcGrowth || []}
            totalValueData={backtestResults.equity.map(e => ({ time: e.timestamp, value: e.value }))}
            initialBalance={startBalance}
          />
        </div>
      {/if}
    {/if}
  </div>
</div>

<style>
  .panel {
    background: var(--bg-primary);
    border: 1px solid var(--border-primary);
    border-radius: var(--radius-lg);
    display: flex;
    flex-direction: column;
  }
  
  .results-panel {
    min-height: 400px;
  }
  
  .panel-header {
    padding: var(--space-md) var(--space-xl);
    background: var(--bg-primary-active);
    border-bottom: none;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  .panel-header h2 {
    margin: 0;
    font-size: var(--font-size-md);
    color: var(--color-primary);
    font-weight: var(--font-weight-semibold);
  }
  
  .panel-content {
    flex: 1;
    padding: var(--space-xl);
    overflow-y: auto;
  }
  
  .no-results {
    text-align: center;
    padding: var(--space-xxl);
    color: var(--text-secondary);
  }
  
  .no-trades-notice,
  .single-trade-notice {
    background: rgba(255, 167, 38, 0.1);
    border: 1px solid var(--color-warning);
    border-radius: var(--radius-lg);
    padding: var(--space-xl);
    margin-bottom: var(--space-xl);
  }
  
  .no-trades-notice h3,
  .single-trade-notice h3 {
    margin: 0 0 var(--space-sm) 0;
    color: var(--color-warning);
    font-weight: var(--font-weight-semibold);
  }
  
  .no-trades-notice p,
  .single-trade-notice p {
    margin: var(--space-sm) 0;
    color: var(--text-primary);
  }
  
  .no-trades-notice ul,
  .single-trade-notice ul {
    margin: var(--space-sm) 0;
    padding-left: var(--space-xl);
  }
  
  .no-trades-notice li,
  .single-trade-notice li {
    margin: var(--space-xs) 0;
    color: var(--text-secondary);
  }
  
  .results-summary {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: var(--space-md);
    margin-bottom: var(--space-xxl);
  }
  
  .result-item {
    background: var(--bg-surface);
    border: 1px solid var(--border-primary);
    border-radius: var(--radius-lg);
    padding: var(--space-md);
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
  }
  
  .result-label {
    font-size: var(--font-size-xs);
    color: var(--text-secondary);
    text-transform: uppercase;
    font-weight: var(--font-weight-medium);
    letter-spacing: 0.5px;
  }
  
  .result-value {
    font-size: var(--font-size-lg);
    font-weight: var(--font-weight-semibold);
    color: var(--text-primary);
    font-family: var(--font-family-mono, 'Courier New', monospace);
  }
  
  .result-value.profit {
    color: var(--color-success);
  }
  
  .result-value.loss {
    color: var(--color-error);
  }
  
  h3 {
    margin: var(--space-xxl) 0 var(--space-md) 0;
    color: var(--color-primary);
    font-size: var(--font-size-md);
    font-weight: var(--font-weight-semibold);
  }
  
  .trades-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
    max-height: 400px;
    overflow-y: auto;
  }
  
  .trade-item {
    background: var(--bg-primary);
    border: 1px solid var(--border-primary);
    border-radius: var(--radius-lg);
    padding: var(--space-md);
  }
  
  .trade-item.buy {
    border-left: 3px solid var(--color-success);
  }
  
  .trade-item.sell {
    border-left: 3px solid var(--color-error);
  }
  
  .trade-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--space-sm);
  }
  
  .trade-type {
    font-weight: var(--font-weight-semibold);
    font-size: var(--font-size-xs);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  
  .trade-item.buy .trade-type {
    color: var(--color-success);
  }
  
  .trade-item.sell .trade-type {
    color: var(--color-error);
  }
  
  .trade-date {
    font-size: var(--font-size-xs);
    color: var(--text-secondary);
  }
  
  .trade-details {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-md);
    font-size: var(--font-size-xs);
  }
  
  .trade-details span {
    color: var(--text-primary);
    font-family: var(--font-family-mono, 'Courier New', monospace);
  }
  
  .trade-details span.profit {
    color: var(--color-success);
  }
  
  .trade-details span.loss {
    color: var(--color-error);
  }
  
  .trade-reason {
    flex: 1 1 100%;
    margin-top: var(--space-xs);
    font-size: var(--font-size-xs);
    color: var(--text-secondary);
    font-style: italic;
  }
  
  .compound-growth-section {
    margin-top: var(--space-xxl);
  }
  
  /* Scrollbar styling */
  .trades-list::-webkit-scrollbar {
    width: 8px;
  }
  
  .trades-list::-webkit-scrollbar-track {
    background: var(--bg-surface);
    border-radius: var(--radius-sm);
  }
  
  .trades-list::-webkit-scrollbar-thumb {
    background: var(--border-primary-active);
    border-radius: var(--radius-sm);
  }
  
  .trades-list::-webkit-scrollbar-thumb:hover {
    background: var(--border-primary-hover);
  }

  /* Mobile responsive */
  @media (max-width: 768px) {
    .panel-content {
      padding: var(--space-lg);
    }
    
    .results-summary {
      grid-template-columns: 1fr;
      gap: var(--space-sm);
    }
    
    .trade-details {
      gap: var(--space-sm);
    }
  }

  /* Tablet responsive */
  @media (max-width: 1024px) and (min-width: 769px) {
    .results-summary {
      grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    }
  }
</style>