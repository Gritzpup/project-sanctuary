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
  
  let selectedGranularity = '1m';
  let selectedPeriod = '1H';
  let autoGranularityActive = false;
  
  // Live trading state
  let accountBalance = 50000;
  let btcHoldings = 0.5;
  let isLive = false;
  
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
  
  function connectLiveAccount() {
    // Placeholder for connecting to live trading account
    alert('Live trading connection would be implemented here. This is a demo mode.');
    isLive = false;
  }
</script>

<div class="dashboard-layout">
  <CollapsibleSidebar 
    {sidebarCollapsed} 
    activeSection="trading"
    on:toggle={toggleSidebar} 
    on:navigate={handleNavigation} 
  />
  
  <main class="dashboard-content" class:expanded={sidebarCollapsed}>
    <div class="header">
      <h1>Live Trading</h1>
      <div class="header-stats">
        <div class="stat">
          <span class="label">Current Price:</span>
          <span class="value">${currentPrice.toLocaleString()}</span>
        </div>
        <div class="stat">
          <span class="label">Account Balance:</span>
          <span class="value">${accountBalance.toLocaleString()}</span>
        </div>
        <div class="stat">
          <span class="label">BTC Holdings:</span>
          <span class="value">{btcHoldings} BTC</span>
        </div>
        <div class="stat">
          <span class="label">Total Value:</span>
          <span class="value">${(accountBalance + (btcHoldings * currentPrice)).toLocaleString()}</span>
        </div>
      </div>
    </div>
    
    <div class="trading-container">
      <div class="controls-section">
        <div class="period-controls">
          <h3>Time Period</h3>
          <div class="button-group">
            {#each ['1H', '4H', '5D', '1M', '3M', '6M', '1Y', '5Y'] as period}
              <button 
                class="period-btn" 
                class:active={selectedPeriod === period}
                on:click={() => selectPeriod(period)}
              >
                {period}
              </button>
            {/each}
          </div>
        </div>
        
        <div class="granularity-controls">
          <h3>Granularity</h3>
          <div class="button-group">
            {#each ['1m', '5m', '15m', '1h', '6h', '1D'] as granularity}
              <button 
                class="granularity-btn" 
                class:active={selectedGranularity === granularity}
                class:disabled={!isGranularityValid(granularity, selectedPeriod)}
                on:click={() => selectGranularity(granularity)}
                disabled={!isGranularityValid(granularity, selectedPeriod)}
              >
                {granularity}
              </button>
            {/each}
          </div>
          {#if autoGranularityActive}
            <div class="auto-granularity-notice">
              Auto-adjusted to {selectedGranularity}
            </div>
          {/if}
        </div>
      </div>
      
      <div class="chart-section">
        <Chart {selectedGranularity} {selectedPeriod} on:granularityChange={(e) => handleChartGranularityChange(e.detail)} />
      </div>
      
      <div class="live-trading-section">
        <div class="warning-box">
          <h3>⚠️ Live Trading Warning</h3>
          <p>Live trading involves real money and carries significant risk. Only trade with funds you can afford to lose.</p>
          <p>Current Status: <span class="status-badge">{isLive ? 'LIVE' : 'DEMO MODE'}</span></p>
        </div>
        
        <div class="connection-section">
          <h3>Exchange Connection</h3>
          <p>Connect your exchange account to enable live trading with automated strategies.</p>
          <button class="connect-btn" on:click={connectLiveAccount}>
            Connect Coinbase Account
          </button>
        </div>
        
        <div class="info-section">
          <h3>Available Features (When Connected)</h3>
          <ul>
            <li>Execute strategies from backtesting in live markets</li>
            <li>Real-time position monitoring</li>
            <li>Automated stop-loss and take-profit</li>
            <li>Performance tracking and analytics</li>
            <li>Risk management controls</li>
          </ul>
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
  }
  
  .dashboard-content {
    flex: 1;
    margin-left: 250px;
    transition: margin-left 0.3s ease;
    overflow-y: auto;
    padding: 20px;
  }
  
  .dashboard-content.expanded {
    margin-left: 80px;
  }
  
  .header {
    margin-bottom: 30px;
  }
  
  .header h1 {
    font-size: 28px;
    margin: 0 0 20px 0;
    color: #d1d4dc;
  }
  
  .header-stats {
    display: flex;
    gap: 30px;
    flex-wrap: wrap;
  }
  
  .stat {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }
  
  .stat .label {
    font-size: 12px;
    color: #888;
    text-transform: uppercase;
  }
  
  .stat .value {
    font-size: 20px;
    color: #d1d4dc;
    font-weight: 500;
  }
  
  .trading-container {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }
  
  .controls-section {
    display: flex;
    gap: 20px;
    margin-bottom: 20px;
  }
  
  .period-controls,
  .granularity-controls {
    flex: 1;
  }
  
  .period-controls h3,
  .granularity-controls h3 {
    font-size: 14px;
    margin: 0 0 10px 0;
    color: #888;
    text-transform: uppercase;
  }
  
  .button-group {
    display: flex;
    gap: 5px;
    flex-wrap: wrap;
  }
  
  .period-btn,
  .granularity-btn {
    padding: 8px 16px;
    background: rgba(74, 0, 224, 0.1);
    border: 1px solid rgba(74, 0, 224, 0.3);
    color: #a78bfa;
    cursor: pointer;
    border-radius: 4px;
    font-size: 12px;
    transition: all 0.2s;
  }
  
  .period-btn:hover,
  .granularity-btn:hover:not(.disabled) {
    background: rgba(74, 0, 224, 0.2);
  }
  
  .period-btn.active,
  .granularity-btn.active {
    background: rgba(74, 0, 224, 0.3);
    border-color: #a78bfa;
  }
  
  .granularity-btn.disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }
  
  .auto-granularity-notice {
    margin-top: 10px;
    font-size: 12px;
    color: #ffa726;
    animation: fadeIn 0.3s ease-in-out;
  }
  
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  
  .chart-section {
    background: #0f0f0f;
    border: 1px solid rgba(74, 0, 224, 0.2);
    border-radius: 8px;
    padding: 20px;
    min-height: 400px;
  }
  
  .live-trading-section {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 20px;
    margin-top: 20px;
  }
  
  .warning-box {
    background: rgba(239, 83, 80, 0.1);
    border: 1px solid rgba(239, 83, 80, 0.3);
    border-radius: 8px;
    padding: 20px;
  }
  
  .warning-box h3 {
    margin: 0 0 10px 0;
    color: #ef5350;
  }
  
  .warning-box p {
    margin: 10px 0;
    color: #d1d4dc;
    line-height: 1.5;
  }
  
  .status-badge {
    display: inline-block;
    padding: 4px 12px;
    background: rgba(255, 167, 38, 0.2);
    border: 1px solid rgba(255, 167, 38, 0.4);
    border-radius: 4px;
    color: #ffa726;
    font-weight: 500;
    font-size: 12px;
  }
  
  .connection-section,
  .info-section {
    background: #0f0f0f;
    border: 1px solid rgba(74, 0, 224, 0.2);
    border-radius: 8px;
    padding: 20px;
  }
  
  .connection-section h3,
  .info-section h3 {
    margin: 0 0 15px 0;
    color: #d1d4dc;
  }
  
  .connection-section p {
    color: #888;
    margin-bottom: 20px;
  }
  
  .connect-btn {
    background: rgba(74, 0, 224, 0.2);
    border: 1px solid rgba(74, 0, 224, 0.4);
    color: #a78bfa;
    padding: 12px 24px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
    transition: all 0.2s;
  }
  
  .connect-btn:hover {
    background: rgba(74, 0, 224, 0.3);
    transform: translateY(-1px);
  }
  
  .info-section ul {
    margin: 0;
    padding-left: 20px;
    color: #888;
  }
  
  .info-section li {
    margin: 8px 0;
    line-height: 1.5;
  }
</style>