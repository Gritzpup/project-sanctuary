<script lang="ts">
  /**
   * @file PaperTradingWrapper.svelte
   * @description Main wrapper for paper trading - consolidated from PaperTradingContainer
   * Phase 5B: Unified entry point for all paper trading functionality
   */

  import CollapsibleSidebar from '../../components/layout/CollapsibleSidebar.svelte';
  import TradingPanels from './components/TradingPanels.svelte';
  import BottomPanels from './components/BottomPanels.svelte';
  import { PaperTradingStateManager } from './services/PaperTradingState.svelte';
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import { dataStore } from '../../pages/trading/chart/stores/dataStore.svelte';

  // 🔧 DEBUG: Log at very top of script

  // Props using Svelte 5 runes syntax
  let {
    sidebarCollapsed = false,
    connectionStatus = 'loading'
  }: {
    sidebarCollapsed?: boolean;
    connectionStatus?: 'connected' | 'disconnected' | 'error' | 'loading';
  } = $props();


  // 🔧 FIX: Use same ticker price as chart from dataStore
  // Both header and chart show the SAME live ticker price (matches/trades)
  // dataStore.latestPrice is a $state that updates from ticker WebSocket
  let currentPrice = $derived(dataStore.latestPrice || 0);

  const dispatch = createEventDispatcher();

  // Initialize state manager - use $state to make it reactive
  let stateManager = $state<PaperTradingStateManager | null>(null);
  let tradingState = $state<any>({});
  let backendState = $state<any>({});
  // 🔧 FIX: Add reactive state for botTabs and activeBotInstance
  let botTabs = $state<any[]>([]);
  let activeBotInstance = $state<any>(null);

  // Component state - all need $state() for Svelte 5 reactivity
  let selectedPair = $state<string>('BTC-USD');
  let selectedGranularity = $state<string>('1m');
  let selectedPeriod = $state<string>('1H');
  let chartSpeed = $state<string>('1x');
  let selectedTestDateString = $state<string>('');
  let chartComponent = $state<any>(null);

  function toggleSidebar() {
    dispatch('toggle');
  }

  function handleNavigation(event: CustomEvent) {
    dispatch('navigate', event.detail);
  }

  // Event handlers that forward to state manager
  function handleStrategyChange(event: CustomEvent) {
    const { value } = event.detail;
    stateManager.handleStrategyChange(value);
  }

  function handleBalanceChange(event: CustomEvent) {
    const { balance } = event.detail;
    stateManager.handleBalanceChange(balance);
  }

  function handleStartTrading() {
    stateManager.handleStartTrading();
  }

  function handlePauseTrading() {
    stateManager.handlePauseTrading();
  }

  function handleResumeTrading() {
    stateManager.handleResumeTrading();
  }

  function handleStopTrading() {
    stateManager.handleStopTrading();
  }

  function handleReset() {
    stateManager.handleReset(chartComponent);
  }

  function handleBotTabSelect(event: CustomEvent) {
    const { botId } = event.detail;
    stateManager.handleBotTabSelect(botId);
  }

  function handleChartEvents(event: CustomEvent) {
    // Handle various chart events (granularity, period changes, etc.)

    if (event.type === 'pairChange') {
      selectedPair = event.detail.pair;
    } else if (event.type === 'granularityChange') {
      const newGranularity = event.detail.granularity;
      selectedGranularity = newGranularity;

      // Trigger chart reload for new granularity
      if (chartComponent && typeof chartComponent.reloadForGranularity === 'function') {
        chartComponent.reloadForGranularity(newGranularity).catch((err: any) => {
        });
      }
    } else if (event.type === 'periodChange') {
      selectedPeriod = event.detail.period;
    } else if (event.type === 'speedChange') {
      chartSpeed = event.detail.speed;
    } else if (event.type === 'dateChange') {
      selectedTestDateString = event.detail.date;
    }
  }

  // Trigger chart resize when state manager is ready
  $effect(() => {
    if (typeof window !== 'undefined' && stateManager?.tradingState && chartComponent) {
      // Just trigger a single chart resize
      setTimeout(() => {
        updateLayout();
      }, 200);
    }
  });

  // Pass chart component to state manager when available
  $effect(() => {
    if (stateManager && chartComponent) {
      stateManager.setChartComponent(chartComponent);
    }
  });

  // Function to trigger chart resize when layout changes
  function updateLayout() {
    // Just trigger chart resize without forcing CSS - let CSS media queries handle layout
    setTimeout(() => {
      if (chartComponent && chartComponent.resizeChart) {
        chartComponent.resizeChart();
      }
      // Trigger a window resize event to force chart redraw
      window.dispatchEvent(new Event('resize'));
    }, 100);
  }

  onMount(() => {
    // Initialize state manager
    stateManager = new PaperTradingStateManager();

    // Subscribe to the reactive stores
    const unsubscribeTradingState = stateManager.tradingState.subscribe(state => {
      tradingState = state;
    });

    // Subscribe to backend state store
    const unsubscribeBackendState = stateManager.backendState.subscribe(state => {
      backendState = state;
    });

    // 🔧 FIX: Subscribe to botTabs and activeBotInstance stores for reactivity
    const unsubscribeBotTabs = stateManager.botTabsStore.subscribe(state => {
      botTabs = state;
    });

    const unsubscribeActiveBotInstance = stateManager.activeBotInstanceStore.subscribe(state => {
      activeBotInstance = state;
    });

    // Add resize listener for responsive layout
    window.addEventListener('resize', updateLayout);

    return () => {
      unsubscribeTradingState();
      unsubscribeBackendState();
      unsubscribeBotTabs();
      unsubscribeActiveBotInstance();
      window.removeEventListener('resize', updateLayout);
      stateManager.destroy();
    };
  });

  onDestroy(() => {
    if (stateManager) stateManager.destroy();
  });
</script>

<div class="dashboard-layout">
  <CollapsibleSidebar
    {currentPrice}
    {sidebarCollapsed}
    activeSection="paper-trading"
    on:toggle={toggleSidebar}
    on:navigate={handleNavigation}
  />

  <main class="dashboard-content" class:expanded={sidebarCollapsed}>
    <div class="content-wrapper">
      <div class="paper-trading-grid" class:trading-active={tradingState?.isRunning}>
        {#if stateManager}
          <TradingPanels
            bind:chartComponent
            {selectedPair}
            {selectedGranularity}
            {selectedPeriod}
            {chartSpeed}
            {selectedTestDateString}
            {botTabs}
            {activeBotInstance}
            {tradingState}
            {backendState}
            strategies={stateManager.strategies}
            on:pairChange={handleChartEvents}
            on:granularityChange={handleChartEvents}
            on:periodChange={handleChartEvents}
            on:speedChange={handleChartEvents}
            on:dateChange={handleChartEvents}
            on:botSelect={handleBotTabSelect}
            on:strategyChange={handleStrategyChange}
            on:balanceChange={handleBalanceChange}
            on:start={handleStartTrading}
            on:pause={handlePauseTrading}
            on:resume={handleResumeTrading}
            on:stop={handleStopTrading}
            on:selectBot={handleBotTabSelect}
            on:reset={handleReset}
          />

          <BottomPanels
            {tradingState}
            {backendState}
          />
        {/if}
      </div>
    </div>
  </main>
</div>

<style>
  .dashboard-layout {
    display: flex;
    height: 100vh;
    background: var(--bg-main);
    color: var(--text-primary);
    overflow: hidden;
  }

  .dashboard-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    margin-left: 250px;
    width: calc(100% - 250px);
    transition: all var(--transition-slow);
  }

  .dashboard-content.expanded {
    margin-left: 80px;
    width: calc(100% - 80px);
  }

  .content-wrapper {
    flex: 1;
    overflow-y: auto;
    padding: var(--space-xl) var(--space-xl) 0 0;
  }

  .paper-trading-grid {
    display: flex;
    flex-direction: column;
    gap: var(--space-xl);
    padding-bottom: 40px;
  }

  /* Mobile responsive layout */
  @media (max-width: 768px) {
    .dashboard-content,
    .dashboard-content.expanded {
      margin-left: 0;
      width: 100%;
      margin-top: 60px; /* Account for mobile header */
    }

    .content-wrapper {
      padding: var(--space-lg) var(--space-sm);
    }

    .paper-trading-grid {
      gap: var(--space-xs);
    }
  }

  /* Tablet responsive layout */
  @media (max-width: 1024px) and (min-width: 769px) {
    .dashboard-content {
      margin-left: 80px;
      width: calc(100% - 80px);
    }

    .dashboard-content.expanded {
      margin-left: 60px;
      width: calc(100% - 60px);
    }

    .content-wrapper {
      padding: var(--space-lg);
    }
  }
</style>
