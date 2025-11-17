<script lang="ts">
  import Chart from './Chart.svelte';
  import ChartInfo from './trading/chart/components/overlays/ChartInfo.svelte';
  import CollapsibleSidebar from '../components/layout/CollapsibleSidebar.svelte';
  // 🔧 FIX: Lazy load DepthChart to reduce initial memory footprint and improve startup time
  import DepthChart from './trading/orderbook/components/DepthChart.svelte';
  import PerformanceComparison from './trading/components/PerformanceComparison.svelte';
  import { onMount, createEventDispatcher } from 'svelte';
  
  export let currentPrice: number = 0;
  export let connectionStatus: 'connected' | 'disconnected' | 'error' | 'loading' = 'loading';
  export let sidebarCollapsed = false;
  
  const dispatch = createEventDispatcher();
  
  function toggleSidebar() {
    dispatch('toggle');
  }
  
  function handleNavigation(event: CustomEvent) {
    dispatch('navigate', event.detail);
  }

  // Chart reference for triggering data reloads
  let chart: any;

  // 🔧 FIX: Track page initialization to defer expensive components (DepthChart)
  let pageInitialized = false;

  // Load saved preferences from localStorage, fallback to defaults
  let selectedGranularity = '1m';
  let selectedPeriod = '1H';
  let autoGranularityActive = false;


  // Load from localStorage on mount
  onMount(() => {
    try {
      const savedGranularity = localStorage.getItem('trading_granularity');
      const savedPeriod = localStorage.getItem('trading_period');

      if (savedPeriod && validGranularities[savedPeriod]) {
        selectedPeriod = savedPeriod;
      }

      if (savedGranularity && isGranularityValid(savedGranularity, selectedPeriod)) {
        selectedGranularity = savedGranularity;
      }

    } catch (error) {
    }

    // 🔧 FIX: Initialize page immediately to allow DepthChart to connect to active WebSocket
    // Startup performance is now good enough due to reduced initial candle load (300 max)
    pageInitialized = true;
  });
  
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

      // Trigger chart data reload
      if (chart && typeof chart.reloadForGranularity === 'function') {
        chart.reloadForGranularity(granularity).catch((err: any) => {
        });
      } else {
      }

      // Save to localStorage
      try {
        localStorage.setItem('trading_granularity', granularity);
      } catch (error) {
      }
    }
  }

  function selectPeriod(period: string) {
    selectedPeriod = period;

    // Save to localStorage
    try {
      localStorage.setItem('trading_period', period);
    } catch (error) {
    }

    if (!isGranularityValid(selectedGranularity, period)) {
      const validOptions = validGranularities[period];
      if (validOptions && validOptions.length > 0) {
        const middleIndex = Math.floor(validOptions.length / 2);
        selectedGranularity = validOptions[middleIndex];
        // Save the auto-adjusted granularity
        try {
          localStorage.setItem('trading_granularity', selectedGranularity);
        } catch (error) {
        }
      }
    }
  }
  
  function handleChartGranularityChange(newGranularity: string) {
    if (selectedGranularity !== newGranularity) {
      selectedGranularity = newGranularity;
      autoGranularityActive = true;

      // Trigger chart reload for the new granularity
      if (chart && typeof chart.reloadForGranularity === 'function') {
        chart.reloadForGranularity(newGranularity).catch((err: any) => {
        });
      }

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
    {currentPrice}
    {sidebarCollapsed} 
    activeSection="trading"
    on:toggle={toggleSidebar} 
    on:navigate={handleNavigation} 
  />
  
  <main class="dashboard-content" class:expanded={sidebarCollapsed}>
    <div class="header">
      <h1>Live Trading</h1>
      <div class="header-stats">
        <div class="stat-item">
          <span class="stat-label">Current Price:</span>
          <span class="stat-value">${currentPrice.toLocaleString()}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Account Balance:</span>
          <span class="stat-value">${accountBalance.toLocaleString()}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">BTC Holdings:</span>
          <span class="stat-value">{btcHoldings} BTC</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Total Value:</span>
          <span class="stat-value">${(accountBalance + (btcHoldings * currentPrice)).toLocaleString()}</span>
        </div>
      </div>
    </div>
    
    <div class="trading-container">
      <div class="controls-section">
        <div class="period-controls">
          <h3>Time Period</h3>
          <div class="button-group" style="flex-wrap: wrap; max-width: 100%; overflow: visible;">
            {#each ['1H', '4H', '5D', '1M', '3M', '6M', '1Y', '5Y'] as period}
              <button
                class="btn-base btn-sm btn-timeframe"
                class:active={selectedPeriod === period}
                style="{period === '5Y' ? 'border: 3px solid red !important; background: yellow !important; color: black !important;' : ''}"
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
                class="btn-base btn-sm btn-timeframe" 
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
      
      <!-- Performance Comparison Test -->
      <PerformanceComparison />

      <!-- Orderbook Depth Chart - Market Position Visualization -->
      <!-- 🔧 FIX: Defer rendering DepthChart until after initial page load for faster startup -->
      <div class="depth-chart-section">
        {#if pageInitialized}
          <DepthChart />
        {/if}
      </div>

      <div class="panel chart-panel">
        <Chart
          bind:this={chart}
          bind:status={connectionStatus}
          granularity={selectedGranularity}
          period={selectedPeriod}
          onGranularityChange={handleChartGranularityChange}
          showInfo={false}
        />
      </div>
      
      <div class="live-trading-section">
        <div class="warning-box">
          <h3>⚠️ Live Trading Warning</h3>
          <p>Live trading involves real money and carries significant risk. Only trade with funds you can afford to lose.</p>
          <p>Current Status: <span class="status-badge">{isLive ? 'LIVE' : 'DEMO MODE'}</span></p>
        </div>
        
        <div class="panel">
          <div class="panel-header">
            <h3>Exchange Connection</h3>
          </div>
          <div class="panel-content">
            <p>Connect your exchange account to enable live trading with automated strategies.</p>
            <button class="btn-base btn-md btn-primary" on:click={connectLiveAccount}>
              Connect Coinbase Account
            </button>
          </div>
        </div>
        
        <div class="panel">
          <div class="panel-header">
            <h3>Available Features (When Connected)</h3>
          </div>
          <div class="panel-content">
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
    </div>
  </main>
</div>

<style>
  /* Use framework classes - these styles are duplicated in layout-system.css */

  /* Component-specific overrides only */
  @media (max-width: 768px) {
    .header {
      display: none;
    }
  }
  
  /* Trading page specific styles only */
  .controls-section {
    display: flex;
    gap: var(--space-xl);
    margin-bottom: var(--space-xl);
    width: fit-content; /* Constrain to content width */
  }

  .period-controls,
  .granularity-controls {
    flex: 1;
    min-width: 280px; /* Ensure consistent width */
  }

  .auto-granularity-notice {
    margin-top: var(--space-md);
    font-size: var(--font-size-xs);
    color: var(--color-warning);
    animation: fadeIn var(--transition-slow);
  }

  /* Depth chart section - match width of controls section exactly */
  .depth-chart-section {
    margin-top: var(--space-xl);
    margin-bottom: var(--space-xl);
    /* Match the controls section: 2 controls at 280px each + gap */
    width: calc(280px + 280px + var(--space-xl));
    max-width: 100%; /* Don't overflow on small screens */
  }
  
  .live-trading-section {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: var(--space-xl);
    margin-top: var(--space-xl);
  }
  
  /* Use framework classes - these should be in utility-system.css */
  .warning-box {
    background: var(--color-error-bg);
    border: 1px solid var(--color-error);
    border-radius: var(--radius-lg);
    padding: var(--space-xl);
  }
  
  .status-badge {
    display: inline-block;
    padding: var(--space-xs) var(--space-md);
    background: var(--color-warning-bg);
    border: 1px solid var(--color-warning);
    border-radius: var(--radius-sm);
    color: var(--color-warning);
    font-weight: var(--font-weight-medium);
    font-size: var(--font-size-xs);
  }
  
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
</style>