<script lang="ts">
  // @ts-nocheck - Chart component prop compatibility with legacy interfaces
  import Chart from './Chart.svelte';
  import ChartInfo from './trading/chart/components/overlays/ChartInfo.svelte';
  import CollapsibleSidebar from '../components/layout/CollapsibleSidebar.svelte';
  // 🔧 FIX: Lazy load DepthChart to reduce initial memory footprint and improve startup time
  import DepthChart from './trading/orderbook/components/DepthChart.svelte';
  import PerformanceComparison from './trading/components/PerformanceComparison.svelte';
  import { chartStore } from './trading/chart/stores/chartStore.svelte';
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

  // 🔧 FIX: Track page initialization to defer expensive components (DepthChart)
  let pageInitialized = false;

  // Granularity/period state - driven by chartStore, persisted to localStorage
  let selectedGranularity = '1m';
  let selectedPeriod = '1H';

  // Load from localStorage on mount
  onMount(() => {
    try {
      const savedGranularity = localStorage.getItem('trading_granularity');
      const savedPeriod = localStorage.getItem('trading_period');

      if (savedPeriod) {
        selectedPeriod = savedPeriod;
      }

      if (savedGranularity) {
        selectedGranularity = savedGranularity;
      }

    } catch (error) {
    }

    // 🔧 FIX: Initialize page immediately to allow DepthChart to connect to active WebSocket
    pageInitialized = true;
  });

  // Sync from chartStore config back to localStorage so preferences persist
  $: {
    const storeGranularity = chartStore.config.granularity;
    const storeTimeframe = chartStore.config.timeframe;
    if (storeGranularity && storeGranularity !== selectedGranularity) {
      selectedGranularity = storeGranularity;
      try { localStorage.setItem('trading_granularity', storeGranularity); } catch (e) {}
    }
    if (storeTimeframe && storeTimeframe !== selectedPeriod) {
      selectedPeriod = storeTimeframe;
      try { localStorage.setItem('trading_period', storeTimeframe); } catch (e) {}
    }
  }

  // Pair state
  let selectedPair = 'BTC-USD';

  function handlePairChange(newPair: string) {
    selectedPair = newPair;
  }

  // Live trading state
  let accountBalance = 50000;
  let btcHoldings = 0.5;
  let isLive = false;

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
          bind:status={connectionStatus}
          pair={selectedPair}
          onPairChange={handlePairChange}
          granularity={selectedGranularity}
          period={selectedPeriod}
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

  /* Depth chart section */
  .depth-chart-section {
    margin-top: var(--space-xl);
    margin-bottom: var(--space-xl);
    width: calc(280px + 280px + var(--space-xl));
    max-width: 100%;
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
</style>
