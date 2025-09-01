<script lang="ts">
  import CollapsibleSidebar from './CollapsibleSidebar.svelte';
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import '../styles/paper-trading.css';
  
  export let currentPrice: number = 0;
  export let connectionStatus: 'connected' | 'disconnected' | 'error' | 'loading' = 'loading';
  export let sidebarCollapsed = false;
  
  const dispatch = createEventDispatcher();
  
  // Trading state
  let isTrading = false;
  let isPaused = false;
  let currentBalance = 1000;
  let totalPnL = 0;
  let openPositions: Array<any> = [];
  let tradeHistory: Array<any> = [];
  
  function toggleSidebar() {
    dispatch('toggle');
  }
  
  function handleNavigation(event: CustomEvent) {
    dispatch('navigate', event.detail);
  }
  
  function startTrading() {
    isTrading = true;
    isPaused = false;
  }
  
  function pauseTrading() {
    isPaused = true;
  }
  
  function stopTrading() {
    isTrading = false;
    isPaused = false;
  }
  
  function clearHistory() {
    if (confirm('Are you sure you want to clear all trade history?')) {
      tradeHistory = [];
    }
  }
</script>

<div class="paper-trading-container">
  <CollapsibleSidebar 
    {sidebarCollapsed} 
    activeSection="paper-trading"
    on:toggle={toggleSidebar}
    on:navigate={handleNavigation}
  />
  
  <div class="main-content" class:sidebar-collapsed={sidebarCollapsed}>
    <div class="paper-trading-header">
      <div class="header-left">
        <h1>Paper Trading</h1>
        <div class="price-display">
          BTC/USD: ${currentPrice.toFixed(2)}
        </div>
      </div>
      <div class="header-right">
        <div class="connection-status" class:connected={connectionStatus === 'connected'}>
          {connectionStatus === 'connected' ? '🟢' : '🔴'} {connectionStatus}
        </div>
      </div>
    </div>
    
    <div class="paper-trading-content">
      <div class="left-column">
        <!-- Control Panel -->
        <div class="control-panel">
          <div class="trading-controls">
            <button 
              class="trading-btn" 
              class:active={isTrading && !isPaused}
              on:click={startTrading}
              disabled={isTrading && !isPaused}
            >
              {isTrading && !isPaused ? 'Trading Active' : 'Start Trading'}
            </button>
            <button 
              class="trading-btn" 
              class:warning={isPaused}
              on:click={pauseTrading}
              disabled={!isTrading || isPaused}
            >
              {isPaused ? 'Paused' : 'Pause'}
            </button>
            <button 
              class="trading-btn warning" 
              on:click={stopTrading}
              disabled={!isTrading}
            >
              Stop Trading
            </button>
          </div>
          
          <!-- Status Display -->
          <div class="status-panel">
            <div class="status-grid">
              <div class="status-item">
                <div class="status-label">Balance</div>
                <div class="status-value">${currentBalance.toFixed(2)}</div>
              </div>
              <div class="status-item">
                <div class="status-label">Total P&L</div>
                <div class="status-value" class:positive={totalPnL > 0} class:negative={totalPnL < 0}>
                  {totalPnL > 0 ? '+' : ''}{totalPnL.toFixed(2)}
                </div>
              </div>
              <div class="status-item">
                <div class="status-label">Open Positions</div>
                <div class="status-value">{openPositions.length}</div>
              </div>
              <div class="status-item">
                <div class="status-label">Win Rate</div>
                <div class="status-value">0%</div>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Open Positions -->
        <div class="positions-panel">
          <div class="positions-header">
            <div class="positions-title">Open Positions</div>
            <div class="positions-count">{openPositions.length} active</div>
          </div>
          {#if openPositions.length === 0}
            <div class="no-positions">No open positions</div>
          {:else}
            {#each openPositions as position}
              <div class="position-item">
                <div class="position-header">
                  <div class="position-level">Level {position.level}</div>
                  <div class="position-pnl" class:profit={position.pnl > 0} class:loss={position.pnl < 0}>
                    {position.pnl > 0 ? '+' : ''}{position.pnl.toFixed(2)}
                  </div>
                </div>
                <div class="position-details">
                  <div class="position-detail">
                    <span>Entry:</span>
                    <span class="position-detail-value">${position.entryPrice}</span>
                  </div>
                  <div class="position-detail">
                    <span>Size:</span>
                    <span class="position-detail-value">{position.size} BTC</span>
                  </div>
                  <div class="position-detail">
                    <span>Value:</span>
                    <span class="position-detail-value">${position.value}</span>
                  </div>
                  <div class="position-detail">
                    <span>Target:</span>
                    <span class="position-detail-value">${position.targetPrice}</span>
                  </div>
                </div>
              </div>
            {/each}
          {/if}
        </div>
        
        <!-- Trade History -->
        <div class="history-panel">
          <div class="history-header">
            <div class="history-title">Trade History</div>
            <button class="clear-history-btn" on:click={clearHistory}>
              Clear History
            </button>
          </div>
          {#if tradeHistory.length === 0}
            <div class="no-trades">No trades executed yet</div>
          {:else}
            {#each tradeHistory as trade}
              <div class="trade-item">
                <div class="trade-type" class:buy={trade.type === 'buy'} class:sell={trade.type === 'sell'}>
                  {trade.type.toUpperCase()}
                </div>
                <div class="trade-details">
                  <span>${trade.price}</span>
                  <span>{trade.amount} BTC</span>
                  <span class:positive={trade.pnl > 0} class:negative={trade.pnl < 0}>
                    {trade.pnl > 0 ? '+' : ''}{trade.pnl}
                  </span>
                </div>
                <div class="trade-time">{trade.time}</div>
              </div>
            {/each}
          {/if}
        </div>
      </div>
      
      <div class="right-column">
        <!-- Chart -->
        <div class="chart-panel">
          <div class="chart-controls">
            <div class="timeframe-selector">
              <button class="timeframe-btn active">1m</button>
              <button class="timeframe-btn">5m</button>
              <button class="timeframe-btn">15m</button>
              <button class="timeframe-btn">1H</button>
              <button class="timeframe-btn">4H</button>
              <button class="timeframe-btn">1D</button>
            </div>
            <div class="chart-info">
              <span>Paper Trading Chart</span>
            </div>
          </div>
          <div class="chart-wrapper">
            <!-- Chart will be rendered here -->
          </div>
        </div>
      </div>
    </div>
  </div>
</div>

<style>
  .paper-trading-container {
    display: flex;
    height: 100vh;
    background: #0a0a0a;
  }
  
  .main-content {
    flex: 1;
    margin-left: 250px;
    transition: margin-left 0.3s ease;
    display: flex;
    flex-direction: column;
  }
  
  .main-content.sidebar-collapsed {
    margin-left: 80px;
  }
  
  .header-left {
    display: flex;
    align-items: center;
    gap: 20px;
  }
  
  .header-left h1 {
    margin: 0;
    font-size: 24px;
    color: #a78bfa;
  }
  
  .price-display {
    font-size: 16px;
    color: #d1d4dc;
    font-weight: 500;
  }
  
  .header-right {
    display: flex;
    align-items: center;
    gap: 20px;
  }
  
  .connection-status {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 14px;
    color: #888;
  }
  
  .connection-status.connected {
    color: #26a69a;
  }
  
  .left-column {
    width: 450px;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }
  
  .right-column {
    flex: 1;
    display: flex;
    flex-direction: column;
  }
  
  .no-positions,
  .no-trades {
    text-align: center;
    padding: 40px;
    color: #666;
    font-size: 14px;
  }
  
  .positive {
    color: #26a69a;
  }
  
  .negative {
    color: #ef4444;
  }
</style>