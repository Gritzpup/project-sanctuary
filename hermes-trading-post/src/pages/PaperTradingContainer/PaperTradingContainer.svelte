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

  // Force grid layout aggressively
  $: {
    if (typeof window !== 'undefined' && stateManager?.tradingState) {
      // Force it multiple times
      for (let i = 0; i < 5; i++) {
        setTimeout(() => {
          const panelsRow = document.querySelector('.main-panels-row');
          if (panelsRow) {
            (panelsRow as HTMLElement).style.cssText = 'display: grid; grid-template-columns: 2fr 1fr; gap: 20px;';
          }
        }, i * 100);
      }
    }
  }

  // Pass chart component to state manager when available
  $: {
    if (stateManager && chartComponent) {
      stateManager.setChartComponent(chartComponent);
    }
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
    
    return () => {
      unsubscribeTradingState();
      unsubscribeBackendState();
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
    background: #0a0a0a;
    color: #d1d4dc;
  }

  .dashboard-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    margin-left: 250px;
    width: calc(100% - 250px);
    transition: all 0.3s ease;
  }

  .dashboard-content.expanded {
    margin-left: 80px;
    width: calc(100% - 80px);
  }

  .content-wrapper {
    flex: 1;
    overflow-y: auto;
    padding: 20px;
  }

  .paper-trading-grid {
    display: flex;
    flex-direction: column;
    gap: 20px;
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
      padding: 25px 10px;
    }
    
    .paper-trading-grid {
      gap: 5px;
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
      padding: 15px;
    }
  }
</style>