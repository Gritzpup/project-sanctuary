<script lang="ts">
  import Chart from './Chart.svelte';
  import CollapsibleSidebar from './CollapsibleSidebar.svelte';
  import { onMount, createEventDispatcher } from 'svelte';
  
  export let currentPrice: number = 0;
  export let connectionStatus: 'connected' | 'disconnected' | 'error' | 'loading' = 'loading';
  
  const dispatch = createEventDispatcher();
  
  let sidebarCollapsed = false;
  
  function toggleSidebar() {
    sidebarCollapsed = !sidebarCollapsed;
  }
  
  function handleNavigation(event: CustomEvent) {
    dispatch('navigate', event.detail);
  }
  
  let selectedGranularity = '1h';
  let selectedPeriod = '1M';
  let autoGranularityActive = false;
  
  // Backtesting state
  let strategy = 'sma-cross'; // Default strategy
  let startBalance = 10000;
  let backtestResults: any = null;
  let isRunning = false;
  
  // Strategy parameters
  let fastMA = 10;
  let slowMA = 30;
  let stopLoss = 2; // percent
  let takeProfit = 5; // percent
  
  // Valid granularities for each period
  const validGranularities: Record<string, string[]> = {
    '1H': ['1m', '5m', '15m'],
    '4H': ['5m', '15m', '1h'],
    '5D': ['15m', '1h'],
    '1M': ['1h', '6h'],
    '3M': ['1h', '6h', '1D'],
    '6M': ['6h', '1D'],
    '1Y': ['6h', '1D'],
    '5Y': ['1D']
  };
  
  const strategies = [
    { value: 'sma-cross', label: 'SMA Crossover' },
    { value: 'rsi', label: 'RSI Overbought/Oversold' },
    { value: 'bb', label: 'Bollinger Bands' },
    { value: 'macd', label: 'MACD Signal' }
  ];
  
  function isGranularityValid(granularity: string, period: string): boolean {
    return validGranularities[period]?.includes(granularity) || false;
  }
  
  function selectGranularity(granularity: string) {
    if (isGranularityValid(granularity, selectedPeriod)) {
      selectedGranularity = granularity;
    }
  }
  
  function selectPeriod(period: string) {
    selectedPeriod = period;
    
    if (!isGranularityValid(selectedGranularity, period)) {
      const validOptions = validGranularities[period];
      if (validOptions && validOptions.length > 0) {
        const middleIndex = Math.floor(validOptions.length / 2);
        selectedGranularity = validOptions[middleIndex];
      }
    }
  }
  
  function handleChartGranularityChange(newGranularity: string) {
    if (selectedGranularity !== newGranularity) {
      selectedGranularity = newGranularity;
      autoGranularityActive = true;
      
      setTimeout(() => {
        autoGranularityActive = false;
      }, 2000);
    }
  }
  
  async function runBacktest() {
    isRunning = true;
    
    // Simulate backtest running
    setTimeout(() => {
      // Mock backtest results
      backtestResults = {
        totalTrades: 42,
        winningTrades: 26,
        losingTrades: 16,
        winRate: 61.9,
        totalReturn: 2847.50,
        returnPercent: 28.48,
        maxDrawdown: -12.3,
        sharpeRatio: 1.45,
        trades: [
          { 
            type: 'BUY', 
            date: '2024-01-15', 
            price: 95420, 
            size: 0.105,
            reason: 'SMA Golden Cross'
          },
          { 
            type: 'SELL', 
            date: '2024-01-18', 
            price: 98750, 
            size: 0.105,
            profit: 349.65,
            profitPercent: 3.49,
            reason: 'SMA Death Cross'
          },
          { 
            type: 'BUY', 
            date: '2024-01-22', 
            price: 97200, 
            size: 0.108,
            reason: 'SMA Golden Cross'
          },
          { 
            type: 'SELL', 
            date: '2024-01-25', 
            price: 95800, 
            size: 0.108,
            profit: -151.20,
            profitPercent: -1.44,
            reason: 'Stop Loss Hit'
          }
        ]
      };
      
      isRunning = false;
    }, 2000);
  }
  
  function clearResults() {
    backtestResults = null;
  }
</script>

<div class="dashboard-layout">
  <CollapsibleSidebar 
    {sidebarCollapsed} 
    activeSection="backtesting"
    on:toggle={toggleSidebar} 
    on:navigate={handleNavigation} 
  />
  
  <main class="dashboard-content" class:expanded={sidebarCollapsed}>
    <div class="header">
      <h1>Backtesting</h1>
      <div class="header-stats">
        <div class="stat-item">
          <span class="stat-label">BTC/USD</span>
          <span class="stat-value price">${currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Status</span>
          <span class="stat-value status {connectionStatus}">{connectionStatus}</span>
        </div>
      </div>
    </div>
    
    <div class="backtest-grid">
      <!-- Chart Panel -->
      <div class="panel chart-panel">
        <div class="granularity-transition" class:active={autoGranularityActive}>
          Switching to {selectedGranularity}
        </div>
        <div class="panel-header">
          <h2>BTC/USD Chart</h2>
          <div class="chart-controls">
            <div class="granularity-buttons">
              <button class="granularity-btn" class:active={selectedGranularity === '1m'} class:disabled={!isGranularityValid('1m', selectedPeriod)} on:click={() => selectGranularity('1m')}>1m</button>
              <button class="granularity-btn" class:active={selectedGranularity === '5m'} class:disabled={!isGranularityValid('5m', selectedPeriod)} on:click={() => selectGranularity('5m')}>5m</button>
              <button class="granularity-btn" class:active={selectedGranularity === '15m'} class:disabled={!isGranularityValid('15m', selectedPeriod)} on:click={() => selectGranularity('15m')}>15m</button>
              <button class="granularity-btn" class:active={selectedGranularity === '1h'} class:disabled={!isGranularityValid('1h', selectedPeriod)} on:click={() => selectGranularity('1h')}>1h</button>
              <button class="granularity-btn" class:active={selectedGranularity === '6h'} class:disabled={!isGranularityValid('6h', selectedPeriod)} on:click={() => selectGranularity('6h')}>6h</button>
              <button class="granularity-btn" class:active={selectedGranularity === '1D'} class:disabled={!isGranularityValid('1D', selectedPeriod)} on:click={() => selectGranularity('1D')}>1D</button>
            </div>
          </div>
        </div>
        <div class="panel-content">
          <Chart 
            bind:status={connectionStatus} 
            granularity={selectedGranularity} 
            period={selectedPeriod} 
            onGranularityChange={handleChartGranularityChange} 
          />
          <div class="period-buttons">
            <button class="period-btn" class:active={selectedPeriod === '1H'} on:click={() => selectPeriod('1H')}>1H</button>
            <button class="period-btn" class:active={selectedPeriod === '4H'} on:click={() => selectPeriod('4H')}>4H</button>
            <button class="period-btn" class:active={selectedPeriod === '5D'} on:click={() => selectPeriod('5D')}>5D</button>
            <button class="period-btn" class:active={selectedPeriod === '1M'} on:click={() => selectPeriod('1M')}>1M</button>
            <button class="period-btn" class:active={selectedPeriod === '3M'} on:click={() => selectPeriod('3M')}>3M</button>
            <button class="period-btn" class:active={selectedPeriod === '6M'} on:click={() => selectPeriod('6M')}>6M</button>
            <button class="period-btn" class:active={selectedPeriod === '1Y'} on:click={() => selectPeriod('1Y')}>1Y</button>
            <button class="period-btn" class:active={selectedPeriod === '5Y'} on:click={() => selectPeriod('5Y')}>5Y</button>
          </div>
        </div>
      </div>
      
      <!-- Strategy Configuration -->
      <div class="panel strategy-panel">
        <div class="panel-header">
          <h2>Strategy Configuration</h2>
        </div>
        <div class="panel-content">
          <div class="config-section">
            <label>
              Strategy
              <select bind:value={strategy}>
                {#each strategies as strat}
                  <option value={strat.value}>{strat.label}</option>
                {/each}
              </select>
            </label>
          </div>
          
          <div class="config-section">
            <label>
              Starting Balance
              <input type="number" bind:value={startBalance} min="100" step="100" />
            </label>
          </div>
          
          {#if strategy === 'sma-cross'}
            <div class="config-section">
              <label>
                Fast MA Period
                <input type="number" bind:value={fastMA} min="5" max="50" />
              </label>
            </div>
            
            <div class="config-section">
              <label>
                Slow MA Period
                <input type="number" bind:value={slowMA} min="10" max="200" />
              </label>
            </div>
          {/if}
          
          <div class="config-section">
            <label>
              Stop Loss (%)
              <input type="number" bind:value={stopLoss} min="0.5" max="10" step="0.5" />
            </label>
          </div>
          
          <div class="config-section">
            <label>
              Take Profit (%)
              <input type="number" bind:value={takeProfit} min="1" max="20" step="0.5" />
            </label>
          </div>
          
          <div class="backtest-buttons">
            <button class="run-btn" on:click={runBacktest} disabled={isRunning}>
              {isRunning ? 'Running...' : 'Run Backtest'}
            </button>
            <button class="clear-btn" on:click={clearResults} disabled={!backtestResults || isRunning}>
              Clear Results
            </button>
          </div>
        </div>
      </div>
      
      <!-- Results Panel -->
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
            <div class="results-summary">
              <div class="result-item">
                <span class="result-label">Total Trades</span>
                <span class="result-value">{backtestResults.totalTrades}</span>
              </div>
              <div class="result-item">
                <span class="result-label">Win Rate</span>
                <span class="result-value">{backtestResults.winRate}%</span>
              </div>
              <div class="result-item">
                <span class="result-label">Total Return</span>
                <span class="result-value profit">
                  ${backtestResults.totalReturn.toFixed(2)} ({backtestResults.returnPercent}%)
                </span>
              </div>
              <div class="result-item">
                <span class="result-label">Max Drawdown</span>
                <span class="result-value loss">{backtestResults.maxDrawdown}%</span>
              </div>
              <div class="result-item">
                <span class="result-label">Sharpe Ratio</span>
                <span class="result-value">{backtestResults.sharpeRatio}</span>
              </div>
              <div class="result-item">
                <span class="result-label">Winning Trades</span>
                <span class="result-value profit">{backtestResults.winningTrades}</span>
              </div>
              <div class="result-item">
                <span class="result-label">Losing Trades</span>
                <span class="result-value loss">{backtestResults.losingTrades}</span>
              </div>
            </div>
            
            <h3>Recent Trades</h3>
            <div class="trades-list">
              {#each backtestResults.trades as trade}
                <div class="trade-item" class:buy={trade.type === 'BUY'} class:sell={trade.type === 'SELL'}>
                  <div class="trade-header">
                    <span class="trade-type">{trade.type}</span>
                    <span class="trade-date">{trade.date}</span>
                  </div>
                  <div class="trade-details">
                    <span>Price: ${trade.price.toLocaleString()}</span>
                    <span>Size: {trade.size} BTC</span>
                    {#if trade.profit !== undefined}
                      <span class:profit={trade.profit > 0} class:loss={trade.profit < 0}>
                        P&L: ${trade.profit.toFixed(2)} ({trade.profitPercent}%)
                      </span>
                    {/if}
                    <span class="trade-reason">{trade.reason}</span>
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      </div>
    </div>
  </main>
</div>

<style>
  .dashboard-layout {
    display: flex;
    height: 100vh;
    background: #0a0a0a;
    color: #d1d4dc;
  }
  
  .dashboard-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    margin-left: 250px;
    transition: margin-left 0.3s ease;
    overflow: hidden;
  }
  
  .dashboard-content.expanded {
    margin-left: 80px;
  }
  
  .header {
    padding: 20px;
    background: #0f0f0f;
    border-bottom: 1px solid rgba(74, 0, 224, 0.3);
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  .header h1 {
    margin: 0;
    font-size: 24px;
    color: #a78bfa;
  }
  
  .header-stats {
    display: flex;
    gap: 30px;
  }
  
  .stat-item {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }
  
  .stat-label {
    font-size: 12px;
    color: #758696;
    text-transform: uppercase;
  }
  
  .stat-value {
    font-size: 18px;
    font-weight: 600;
  }
  
  .stat-value.price {
    color: #26a69a;
  }
  
  .stat-value.status {
    font-size: 14px;
  }
  
  .stat-value.connected {
    color: #26a69a;
  }
  
  .stat-value.disconnected,
  .stat-value.error {
    color: #ef5350;
  }
  
  .stat-value.loading {
    color: #ffa726;
  }
  
  .backtest-grid {
    flex: 1;
    display: grid;
    grid-template-columns: 2fr 1fr;
    grid-template-rows: auto 1fr;
    gap: 20px;
    padding: 20px;
    overflow: hidden;
  }
  
  .panel {
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(74, 0, 224, 0.3);
    border-radius: 8px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  
  .chart-panel {
    grid-row: span 2;
    position: relative;
  }
  
  .panel-header {
    padding: 15px 20px;
    background: rgba(74, 0, 224, 0.1);
    border-bottom: 1px solid rgba(74, 0, 224, 0.3);
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
    display: flex;
    flex-direction: column;
  }
  
  .chart-panel .panel-content {
    padding: 0;
    display: flex;
    flex-direction: column;
  }
  
  .chart-panel .panel-content > :global(.chart-container) {
    flex: 1;
  }
  
  .granularity-transition {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: rgba(74, 0, 224, 0.9);
    color: white;
    padding: 10px 20px;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 500;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.3s ease;
    z-index: 10;
  }
  
  .granularity-transition.active {
    opacity: 1;
  }
  
  .chart-controls {
    display: flex;
    gap: 10px;
  }
  
  .granularity-buttons {
    display: flex;
    gap: 5px;
  }
  
  .granularity-btn {
    padding: 6px 12px;
    background: rgba(74, 0, 224, 0.2);
    border: 1px solid rgba(74, 0, 224, 0.3);
    color: #9ca3af;
    border-radius: 4px;
    font-size: 12px;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .granularity-btn:hover:not(:disabled) {
    background: rgba(74, 0, 224, 0.3);
    color: #d1d4dc;
  }
  
  .granularity-btn.active {
    background: rgba(74, 0, 224, 0.4);
    color: #a78bfa;
    border-color: #a78bfa;
  }
  
  .granularity-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }
  
  .period-buttons {
    display: flex;
    gap: 10px;
    padding: 15px 20px;
    background: rgba(74, 0, 224, 0.05);
    border-top: 1px solid rgba(74, 0, 224, 0.3);
  }
  
  .period-btn {
    padding: 8px 16px;
    background: rgba(74, 0, 224, 0.2);
    border: 1px solid rgba(74, 0, 224, 0.3);
    color: #9ca3af;
    border-radius: 4px;
    font-size: 13px;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .period-btn:hover {
    background: rgba(74, 0, 224, 0.3);
    color: #d1d4dc;
  }
  
  .period-btn.active {
    background: rgba(74, 0, 224, 0.4);
    color: #a78bfa;
    border-color: #a78bfa;
  }
  
  .config-section {
    margin-bottom: 15px;
  }
  
  .config-section label {
    display: flex;
    flex-direction: column;
    gap: 8px;
    font-size: 14px;
    color: #d1d4dc;
  }
  
  .config-section input,
  .config-section select {
    padding: 8px 12px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(74, 0, 224, 0.3);
    border-radius: 4px;
    color: #d1d4dc;
    font-size: 14px;
  }
  
  .config-section input:focus,
  .config-section select:focus {
    outline: none;
    border-color: #a78bfa;
  }
  
  .backtest-buttons {
    display: flex;
    gap: 10px;
    margin-top: 20px;
  }
  
  .run-btn, .clear-btn {
    flex: 1;
    padding: 12px;
    border: none;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .run-btn {
    background: #a78bfa;
    color: white;
  }
  
  .run-btn:hover:not(:disabled) {
    background: #8b5cf6;
  }
  
  .clear-btn {
    background: rgba(74, 0, 224, 0.2);
    color: #a78bfa;
    border: 1px solid rgba(74, 0, 224, 0.3);
  }
  
  .clear-btn:hover:not(:disabled) {
    background: rgba(74, 0, 224, 0.3);
  }
  
  .run-btn:disabled, .clear-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .no-results {
    text-align: center;
    color: #758696;
    padding: 40px 20px;
  }
  
  .results-summary {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
    margin-bottom: 20px;
  }
  
  .result-item {
    display: flex;
    justify-content: space-between;
    padding: 10px;
    background: rgba(255, 255, 255, 0.02);
    border-radius: 4px;
    font-size: 14px;
  }
  
  .result-label {
    color: #758696;
  }
  
  .result-value {
    font-weight: 600;
    color: #d1d4dc;
  }
  
  .result-value.profit {
    color: #26a69a;
  }
  
  .result-value.loss {
    color: #ef5350;
  }
  
  .results-panel h3 {
    margin: 20px 0 10px 0;
    font-size: 14px;
    color: #a78bfa;
  }
  
  .trades-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  
  .trade-item {
    padding: 12px;
    background: rgba(255, 255, 255, 0.02);
    border-radius: 6px;
    border: 1px solid rgba(74, 0, 224, 0.2);
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
    margin-bottom: 8px;
  }
  
  .trade-type {
    font-weight: 600;
    font-size: 14px;
  }
  
  .trade-item.buy .trade-type {
    color: #26a69a;
  }
  
  .trade-item.sell .trade-type {
    color: #ef5350;
  }
  
  .trade-date {
    font-size: 12px;
    color: #758696;
  }
  
  .trade-details {
    display: flex;
    gap: 15px;
    font-size: 13px;
    color: #d1d4dc;
    flex-wrap: wrap;
  }
  
  .trade-details span.profit {
    color: #26a69a;
    font-weight: 600;
  }
  
  .trade-details span.loss {
    color: #ef5350;
    font-weight: 600;
  }
  
  .trade-reason {
    color: #758696;
    font-style: italic;
    font-size: 12px;
  }
</style>