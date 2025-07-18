<script lang="ts">
  import Chart from './Chart.svelte';
  import CollapsibleSidebar from './CollapsibleSidebar.svelte';
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import { paperTradingService } from '../services/paperTradingService';
  import { ReverseRatioStrategy } from '../strategies/implementations/ReverseRatioStrategy';
  import { GridTradingStrategy } from '../strategies/implementations/GridTradingStrategy';
  import { RSIMeanReversionStrategy } from '../strategies/implementations/RSIMeanReversionStrategy';
  import { DCAStrategy } from '../strategies/implementations/DCAStrategy';
  import { VWAPBounceStrategy } from '../strategies/implementations/VWAPBounceStrategy';
  import type { Strategy } from '../strategies/base/Strategy';
  
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
  
  let selectedGranularity = '1m';
  let selectedPeriod = '1H';
  let autoGranularityActive = false;
  
  // Paper trading state
  let isRunning = false;
  let selectedStrategyType = 'reverse-ratio';
  let currentStrategy: Strategy | null = null;
  let statusInterval: NodeJS.Timer | null = null;
  
  // Current balances and metrics
  let balance = 10000;
  let btcBalance = 0;
  let vaultBalance = 0;
  let trades: any[] = [];
  let positions: any[] = [];
  let totalReturn = 0;
  let winRate = 0;
  
  const strategies = [
    { value: 'reverse-ratio', label: 'Reverse Ratio Buying' },
    { value: 'grid-trading', label: 'Grid Trading' },
    { value: 'rsi-mean-reversion', label: 'RSI Mean Reversion' },
    { value: 'dca', label: 'Dollar Cost Averaging' },
    { value: 'vwap-bounce', label: 'VWAP Bounce' }
  ];
  
  function createStrategy(type: string): Strategy {
    // Use default parameters for now
    switch (type) {
      case 'reverse-ratio':
        return new ReverseRatioStrategy({});
      case 'grid-trading':
        return new GridTradingStrategy({});
      case 'rsi-mean-reversion':
        return new RSIMeanReversionStrategy({});
      case 'dca':
        return new DCAStrategy({});
      case 'vwap-bounce':
        return new VWAPBounceStrategy({});
      default:
        throw new Error(`Unknown strategy type: ${type}`);
    }
  }
  
  onMount(() => {
    updateStatus();
  });
  
  onDestroy(() => {
    if (statusInterval) {
      clearInterval(statusInterval);
    }
    if (isRunning) {
      paperTradingService.stop();
    }
  });
  
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
  
  async function startTrading() {
    if (!paperTradingService || isRunning) return;
    
    currentStrategy = createStrategy(selectedStrategyType);
    paperTradingService.start(currentStrategy, 'BTC-USD', balance);
    isRunning = true;
    
    // Start periodic status updates
    statusInterval = setInterval(updateStatus, 1000);
  }
  
  function stopTrading() {
    if (!paperTradingService || !isRunning) return;
    
    paperTradingService.stop();
    isRunning = false;
    
    if (statusInterval) {
      clearInterval(statusInterval);
      statusInterval = null;
    }
    
    updateStatus();
  }
  
  function updateStatus() {
    if (!paperTradingService) return;
    
    const status = paperTradingService.getStatus();
    balance = status.usdBalance;
    btcBalance = status.btcBalance;
    vaultBalance = status.vaultBalance;
    positions = status.positions;
    trades = status.trades;
    
    // Calculate metrics
    if (trades.length > 0) {
      const closedTrades = trades.filter(t => t.side === 'sell');
      const profitableTrades = closedTrades.filter(t => t.profit && t.profit > 0);
      winRate = closedTrades.length > 0 ? (profitableTrades.length / closedTrades.length) * 100 : 0;
      
      const initialBalance = 10000;
      const currentTotal = balance + (btcBalance * currentPrice) + vaultBalance;
      totalReturn = currentTotal - initialBalance;
    }
  }
  
  $: totalValue = balance + (btcBalance * currentPrice) + vaultBalance;
  $: unrealizedPnl = positions.reduce((total, pos) => {
    return total + ((currentPrice - pos.entryPrice) * pos.size);
  }, 0);
  $: returnPercent = ((totalValue - 10000) / 10000) * 100;
</script>

<div class="dashboard-layout">
  <CollapsibleSidebar 
    {sidebarCollapsed} 
    activeSection="paper-trading"
    on:toggle={toggleSidebar} 
    on:navigate={handleNavigation} 
  />
  
  <main class="dashboard-content" class:expanded={sidebarCollapsed}>
    <div class="header">
      <h1>Paper Trading</h1>
      <div class="header-stats">
        <div class="stat-item">
          <span class="stat-label">BTC/USD</span>
          <span class="stat-value price">${currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Total Value</span>
          <span class="stat-value">${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Total Return</span>
          <span class="stat-value" class:profit={totalReturn > 0} class:loss={totalReturn < 0}>
            ${totalReturn.toFixed(2)} ({returnPercent.toFixed(2)}%)
          </span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Win Rate</span>
          <span class="stat-value">{winRate.toFixed(1)}%</span>
        </div>
      </div>
    </div>
    
    <div class="trading-grid">
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
      
      <!-- Trading Controls -->
      <div class="panel trading-panel">
        <div class="panel-header">
          <h2>Automated Trading</h2>
        </div>
        <div class="panel-content">
          <div class="strategy-section">
            <label>
              Strategy
              <select bind:value={selectedStrategyType} disabled={isRunning}>
                {#each strategies as strat}
                  <option value={strat.value}>{strat.label}</option>
                {/each}
              </select>
            </label>
          </div>
          
          <div class="balances">
            <div class="balance-item">
              <span>USD Balance:</span>
              <span>${balance.toFixed(2)}</span>
            </div>
            <div class="balance-item">
              <span>BTC Balance:</span>
              <span>{btcBalance.toFixed(8)} BTC</span>
            </div>
            <div class="balance-item">
              <span>Vault Balance:</span>
              <span class="vault">${vaultBalance.toFixed(2)}</span>
            </div>
            <div class="balance-item">
              <span>Unrealized P&L:</span>
              <span class:profit={unrealizedPnl > 0} class:loss={unrealizedPnl < 0}>
                ${unrealizedPnl.toFixed(2)}
              </span>
            </div>
          </div>
          
          <div class="control-buttons">
            {#if !isRunning}
              <button class="start-btn" on:click={startTrading}>
                Start Automated Trading
              </button>
            {:else}
              <button class="stop-btn" on:click={stopTrading}>
                Stop Trading
              </button>
            {/if}
          </div>
          
          {#if isRunning}
            <div class="status-indicator">
              <span class="status-dot"></span>
              <span>Strategy Running</span>
            </div>
          {/if}
        </div>
      </div>
      
      <!-- Positions Panel -->
      <div class="panel positions-panel">
        <div class="panel-header">
          <h2>Open Positions</h2>
        </div>
        <div class="panel-content">
          <div class="positions-list">
            {#if positions.length === 0}
              <p class="no-positions">No open positions</p>
            {:else}
              {#each positions as position}
                <div class="position-item">
                  <div class="position-header">
                    <span>Entry: ${position.entryPrice.toFixed(2)}</span>
                    <span>{position.size.toFixed(8)} BTC</span>
                  </div>
                  <div class="position-details">
                    <span>Current: ${currentPrice.toFixed(2)}</span>
                    <span class:profit={(currentPrice - position.entryPrice) > 0} 
                          class:loss={(currentPrice - position.entryPrice) < 0}>
                      P&L: ${((currentPrice - position.entryPrice) * position.size).toFixed(2)}
                    </span>
                  </div>
                </div>
              {/each}
            {/if}
          </div>
        </div>
      </div>
      
      <!-- Trade History -->
      <div class="panel history-panel">
        <div class="panel-header">
          <h2>Trade History</h2>
        </div>
        <div class="panel-content">
          <div class="trades-list">
            {#if trades.length === 0}
              <p class="no-trades">No trades yet</p>
            {:else}
              {#each trades.slice(-20).reverse() as trade}
                <div class="trade-item" class:buy={trade.side === 'buy'} class:sell={trade.side === 'sell'}>
                  <div class="trade-header">
                    <span class="trade-type">{trade.side.toUpperCase()}</span>
                    <span class="trade-time">{new Date(trade.timestamp).toLocaleString()}</span>
                  </div>
                  <div class="trade-details">
                    <span>Price: ${trade.price.toFixed(2)}</span>
                    <span>Size: {trade.size.toFixed(8)} BTC</span>
                    <span>Value: ${(trade.price * trade.size).toFixed(2)}</span>
                    {#if trade.profit !== undefined}
                      <span class:profit={trade.profit > 0} class:loss={trade.profit < 0}>
                        P&L: ${trade.profit.toFixed(2)}
                      </span>
                    {/if}
                    {#if trade.profitToVault}
                      <span class="vault-allocation">Vault: ${trade.profitToVault.toFixed(2)}</span>
                    {/if}
                  </div>
                </div>
              {/each}
            {/if}
          </div>
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
  
  .stat-value.profit {
    color: #26a69a;
  }
  
  .stat-value.loss {
    color: #ef5350;
  }
  
  .trading-grid {
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
  
  .balances {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-bottom: 20px;
  }
  
  .balance-item {
    display: flex;
    justify-content: space-between;
    padding: 10px;
    background: rgba(255, 255, 255, 0.02);
    border-radius: 4px;
    font-size: 14px;
  }
  
  .balance-item span:last-child {
    font-weight: 600;
  }
  
  .balance-item span.long {
    color: #26a69a;
  }
  
  .balance-item span.vault {
    color: #a78bfa;
    font-weight: 600;
  }
  
  .balance-item span.profit {
    color: #26a69a;
  }
  
  .balance-item span.loss {
    color: #ef5350;
  }
  
  .strategy-section {
    margin-bottom: 20px;
  }
  
  .strategy-section label {
    display: flex;
    flex-direction: column;
    gap: 8px;
    font-size: 14px;
    color: #d1d4dc;
  }
  
  .strategy-section select {
    padding: 8px 12px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(74, 0, 224, 0.3);
    border-radius: 4px;
    color: #d1d4dc;
    font-size: 14px;
  }
  
  .control-buttons {
    margin-top: 20px;
  }
  
  .start-btn, .stop-btn {
    width: 100%;
    padding: 15px;
    border: none;
    border-radius: 6px;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .start-btn {
    background: #a78bfa;
    color: white;
  }
  
  .start-btn:hover {
    background: #8b5cf6;
  }
  
  .stop-btn {
    background: #ef5350;
    color: white;
  }
  
  .stop-btn:hover {
    background: #d32f2f;
  }
  
  .status-indicator {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 15px;
    padding: 10px;
    background: rgba(74, 0, 224, 0.1);
    border-radius: 4px;
    font-size: 14px;
    color: #a78bfa;
  }
  
  .status-dot {
    width: 8px;
    height: 8px;
    background: #a78bfa;
    border-radius: 50%;
    animation: pulse 2s infinite;
  }
  
  @keyframes pulse {
    0% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
    100% {
      opacity: 1;
    }
  }
  
  .positions-panel {
    overflow: hidden;
  }
  
  .positions-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  
  .no-positions {
    text-align: center;
    color: #758696;
    padding: 20px;
  }
  
  .position-item {
    padding: 12px;
    background: rgba(255, 255, 255, 0.02);
    border-radius: 6px;
    border: 1px solid rgba(74, 0, 224, 0.2);
  }
  
  .position-header {
    display: flex;
    justify-content: space-between;
    margin-bottom: 8px;
    font-size: 14px;
    font-weight: 600;
  }
  
  .position-details {
    display: flex;
    justify-content: space-between;
    font-size: 13px;
    color: #d1d4dc;
  }
  
  .position-details span.profit {
    color: #26a69a;
  }
  
  .position-details span.loss {
    color: #ef5350;
  }
  
  .trades-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  
  .no-trades {
    text-align: center;
    color: #758696;
    padding: 20px;
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
  
  .trade-time {
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
  
  .vault-allocation {
    color: #a78bfa;
    font-size: 12px;
  }
</style>