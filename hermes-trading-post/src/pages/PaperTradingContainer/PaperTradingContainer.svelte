<script lang="ts">
  import CollapsibleSidebar from '../../components/layout/CollapsibleSidebar.svelte';
  import TradingPanels from './components/TradingPanels.svelte';
  import BottomPanels from './components/BottomPanels.svelte';
  import { PaperTradingStateManager } from './services/PaperTradingState.svelte';
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  
  export let sidebarCollapsed = false;
  export let currentPrice: number = 0;

  const dispatch = createEventDispatcher();

  // Initialize state manager
  let stateManager: PaperTradingStateManager;
  let tradingState: any = {};
  let backendState: any = {};
  
  // Component state
  let selectedPair = 'BTC-USD';
  let selectedGranularity = '1m';
  let selectedPeriod = '1H';
  let chartSpeed = '1x';
  let selectedTestDateString = '';
  let chartComponent: any = null;

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
    console.log('Chart event:', event.type, event.detail);
    
    if (event.type === 'pairChange') {
      selectedPair = event.detail.pair;
    } else if (event.type === 'granularityChange') {
      selectedGranularity = event.detail.granularity;
    } else if (event.type === 'periodChange') {
      selectedPeriod = event.detail.period;
    } else if (event.type === 'speedChange') {
      chartSpeed = event.detail.speed;
    } else if (event.type === 'dateChange') {
      selectedTestDateString = event.detail.date;
    }
  }

  // Trigger chart resize when state manager is ready
  $: {
    if (typeof window !== 'undefined' && stateManager?.tradingState && chartComponent) {
      // Just trigger a single chart resize
      setTimeout(() => {
        updateLayout();
      }, 200);
    }
  }

  // Pass chart component to state manager when available
  $: {
    if (stateManager && chartComponent) {
      stateManager.setChartComponent(chartComponent);
    }
  }

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
    
    // Add resize listener for responsive layout
    window.addEventListener('resize', updateLayout);
    
    return () => {
      unsubscribeTradingState();
      unsubscribeBackendState();
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
            botTabs={stateManager.botTabs}
            activeBotInstance={stateManager.activeBotInstance}
            {tradingState}
            {backendState}
            strategies={stateManager.strategies}
            on:pairChange={handleChartEvents}
            on:granularityChange={handleChartEvents}
            on:periodChange={handleChartEvents}
            on:speedChange={handleChartEvents}
            on:dateChange={handleChartEvents}
            on:botTabSelect={handleBotTabSelect}
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
    min-height: 100vh;
    background: var(--bg-main);
    color: var(--text-primary);
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
    padding: var(--space-xl);
  }

  .paper-trading-grid {
    display: flex;
    flex-direction: column;
    gap: var(--space-xl);
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