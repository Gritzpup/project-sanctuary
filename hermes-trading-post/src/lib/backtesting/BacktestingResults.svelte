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
      {:else if backtestResults.metrics.totalTrades === 1 && selectedStrategyType === 'reverse-ratio'}
        <div class="single-trade-notice">
          <h3>⚠️ Only 1 buy level was used</h3>
          <p>The Reverse Ratio strategy only triggered one buy because:</p>
          <ul>
            <li>Price dropped {strategyParams['reverse-ratio'].initialDropPercent}% to trigger the first buy</li>
            <li>Price didn't drop another {strategyParams['reverse-ratio'].levelDropPercent}% for the second level</li>
            <li>Strategy is waiting for {strategyParams['reverse-ratio'].profitTarget}% profit to sell</li>
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
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(74, 0, 224, 0.3);
    border-radius: 8px;
    display: flex;
    flex-direction: column;
  }
  
  .results-panel {
    min-height: 400px;
  }
  
  .panel-header {
    padding: 15px 20px;
    background: rgba(74, 0, 224, 0.1);
    border-bottom: none;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  .panel-header h2 {
    margin: 0;
    font-size: 16px;
    color: #a78bfa;
  }
  
  .panel-content {
    flex: 1;
    padding: 20px;
    overflow-y: auto;
  }
  
  .no-results {
    text-align: center;
    padding: 40px;
    color: #888;
  }
  
  .no-trades-notice,
  .single-trade-notice {
    background: rgba(255, 167, 38, 0.1);
    border: 1px solid rgba(255, 167, 38, 0.3);
    border-radius: 8px;
    padding: 20px;
    margin-bottom: 20px;
  }
  
  .no-trades-notice h3,
  .single-trade-notice h3 {
    margin: 0 0 10px 0;
    color: #ffa726;
  }
  
  .no-trades-notice p,
  .single-trade-notice p {
    margin: 10px 0;
    color: #d1d4dc;
  }
  
  .no-trades-notice ul,
  .single-trade-notice ul {
    margin: 10px 0;
    padding-left: 20px;
  }
  
  .no-trades-notice li,
  .single-trade-notice li {
    margin: 5px 0;
    color: #888;
  }
  
  .results-summary {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 15px;
    margin-bottom: 30px;
  }
  
  .result-item {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(74, 0, 224, 0.2);
    border-radius: 8px;
    padding: 15px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  
  .result-label {
    font-size: 12px;
    color: #888;
    text-transform: uppercase;
  }
  
  .result-value {
    font-size: 18px;
    font-weight: 600;
    color: #d1d4dc;
  }
  
  .result-value.profit {
    color: #26a69a;
  }
  
  .result-value.loss {
    color: #ef5350;
  }
  
  h3 {
    margin: 30px 0 15px 0;
    color: #a78bfa;
    font-size: 16px;
  }
  
  .trades-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
    max-height: 400px;
    overflow-y: auto;
  }
  
  .trade-item {
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(74, 0, 224, 0.2);
    border-radius: 8px;
    padding: 15px;
  }
  
  .trade-item.buy {
    border-left: 3px solid #26a69a;
  }
  
  .trade-item.sell {
    border-left: 3px solid #ef5350;
  }
  
  .trade-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 10px;
  }
  
  .trade-type {
    font-weight: 600;
    font-size: 12px;
    text-transform: uppercase;
  }
  
  .trade-item.buy .trade-type {
    color: #26a69a;
  }
  
  .trade-item.sell .trade-type {
    color: #ef5350;
  }
  
  .trade-date {
    font-size: 12px;
    color: #888;
  }
  
  .trade-details {
    display: flex;
    flex-wrap: wrap;
    gap: 15px;
    font-size: 13px;
  }
  
  .trade-details span {
    color: #d1d4dc;
  }
  
  .trade-details span.profit {
    color: #26a69a;
  }
  
  .trade-details span.loss {
    color: #ef5350;
  }
  
  .trade-reason {
    flex: 1 1 100%;
    margin-top: 5px;
    font-size: 12px;
    color: #888;
    font-style: italic;
  }
  
  .compound-growth-section {
    margin-top: 30px;
  }
  
  /* Scrollbar styling */
  .trades-list::-webkit-scrollbar {
    width: 8px;
  }
  
  .trades-list::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.05);
    border-radius: 4px;
  }
  
  .trades-list::-webkit-scrollbar-thumb {
    background: rgba(167, 139, 250, 0.3);
    border-radius: 4px;
  }
  
  .trades-list::-webkit-scrollbar-thumb:hover {
    background: rgba(167, 139, 250, 0.5);
  }
</style>