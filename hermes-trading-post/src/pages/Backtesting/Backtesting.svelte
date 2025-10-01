<script lang="ts">
  // Layout Components
  import CollapsibleSidebar from '../../components/layout/CollapsibleSidebar.svelte';
  import BacktestingLayout from '../../components/backtesting/layout/BacktestingLayout.svelte';
  import BacktestingHeader from '../../components/backtesting/layout/BacktestingHeader.svelte';
  import PanelsRow from '../../components/backtesting/layout/PanelsRow.svelte';
  
  // Control Components
  import StrategyPanel from '../../components/backtesting/controls/StrategyPanel.svelte';
  import StrategyTabs from '../../components/backtesting/controls/StrategyTabs.svelte';
  
  // Tab Components
  import ConfigTab from '../../components/backtesting/tabs/ConfigTab.svelte';
  import CodeTab from '../../components/backtesting/tabs/CodeTab.svelte';
  import BackupsTab from '../../components/backtesting/tabs/BackupsTab.svelte';
  
  // Existing Components
  import BacktestingChart from '../Backtesting/BacktestingChart.svelte';
  import BacktestingResults from '../../components/backtesting/BacktestingResults.svelte';
  import BacktestingStrategyParams from '../../components/backtesting/BacktestingStrategyParams.svelte';
  import BacktestingBackups from '../Backtesting/BacktestingBackups.svelte';
  
  // Service Components
  import BacktestingControls from './components/BacktestingControls.svelte';
  import { createStrategy, getAllStrategies, loadStrategySourceCode, defaultStrategyParams } from './services/StrategyService.svelte';
  import { runBacktest } from './services/BacktestingRunner.svelte';
  
  // Services & Stores
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import type { Strategy } from '../../strategies/base/Strategy';
  import type { BacktestResult } from '../../strategies/base/StrategyTypes';
  import type { CandleData } from '../../types/coinbase';
  import { strategyStore, syncStatus } from '../../stores/strategyStore';
  
  export let currentPrice: number = 50000;
  export let connectionStatus: 'connected' | 'disconnected' | 'error' | 'loading' = 'loading';
  export let sidebarCollapsed = false;

  const dispatch = createEventDispatcher();

  function toggleSidebar() {
    dispatch('toggle');
  }

  function handleNavigation(event: CustomEvent) {
    dispatch('navigate', event.detail);
  }

  // Chart state
  let selectedGranularity = '1m';
  let selectedPeriod = '1H';
  let autoGranularityActive = false;
  let isLoadingChart = false;
  let historicalCandles: CandleData[] = [];
  let refreshInterval: number | null = null;
  
  // Backtesting state
  let selectedStrategyType = 'reverse-ratio';
  let startBalance = 1000;
  let backtestResults: BacktestResult | null = null;
  let isRunning = false;
  let currentStrategy: Strategy | null = null;
  
  // Fee configuration
  let makerFeePercent = 0.35;
  let takerFeePercent = 0.75;
  let feeRebatePercent = 25;
  
  // Tab state
  let activeTab: 'config' | 'code' | 'backups' = 'config';
  let strategySourceCode = '';
  
  // Visual feedback state
  let showSaveSuccess = false;
  let showSyncSuccess = false;
  
  // Sync state
  let isSynced = false;
  let paperTradingActive = false;
  
  // Backups and custom strategies
  let savedBackups: Array<any> = [];
  let customStrategies: Array<any> = [];
  let customPresets: Array<any> = [];
  let selectedPresetIndex: number = 0;
  
  // Strategy parameters
  let strategyParams: Record<string, any> = { ...defaultStrategyParams };
  
  $: strategies = getAllStrategies(customStrategies);
  
  // React to strategy type changes (but not during initial mount)
  let mounted = false;
  $: if (selectedStrategyType && mounted) {
    updateStrategy();
  }
  
  // Chart controls component
  let chartControls: BacktestingControls;
  
  function syncToPaperTrading() {
    showSyncSuccess = true;
    isSynced = true;
    setTimeout(() => showSyncSuccess = false, 2000);
  }
  
  async function handleRunBacktest() {
    if (!currentStrategy) {
      console.error('Strategy not initialized');
      alert('Strategy not initialized. Please select a strategy.');
      return;
    }
    
    isRunning = true;
    backtestResults = null;
    
    try {
      backtestResults = await runBacktest(currentStrategy, historicalCandles, {
        startBalance,
        makerFeePercent,
        takerFeePercent,
        feeRebatePercent
      });
    } catch (error) {
      console.error('Backtest failed:', error);
      alert(`Backtest failed: ${error.message}`);
    } finally {
      isRunning = false;
    }
  }
  
  function updateStrategy() {
    try {
      console.log('Updating strategy to:', selectedStrategyType);
      currentStrategy = createStrategy(selectedStrategyType, strategyParams[selectedStrategyType], customStrategies);
      console.log('Strategy created successfully:', currentStrategy.getName());
      strategySourceCode = loadStrategySourceCode(selectedStrategyType, customStrategies);
    } catch (error) {
      console.error('Failed to update strategy:', error);
      currentStrategy = null;
      alert(`Failed to create strategy: ${error.message}`);
    }
  }
  
  function handleStrategyAction(event: CustomEvent) {
    console.log('Strategy action:', event.type, event.detail);
  }
  
  function handleDataUpdated(event: CustomEvent) {
    historicalCandles = event.detail.historicalCandles;
    connectionStatus = event.detail.connectionStatus;
  }
  
  onMount(async () => {
    console.log('Backtesting component mounted');
    console.log('Initial state:', { selectedStrategyType, selectedPeriod, selectedGranularity });
    
    // Initialize strategy first
    try {
      currentStrategy = createStrategy(selectedStrategyType, strategyParams[selectedStrategyType], customStrategies);
      console.log('Strategy initialized:', currentStrategy.getName());
      strategySourceCode = loadStrategySourceCode(selectedStrategyType, customStrategies);
    } catch (error) {
      console.error('Failed to initialize strategy:', error);
    }
    
    // Load chart data
    console.log('Loading initial chart data...');
    await chartControls?.loadData(true);
    
    // Set up auto-refresh for short periods
    if (['1H', '4H', '5D'].includes(selectedPeriod)) {
      refreshInterval = setInterval(async () => {
        console.log('Auto-refreshing chart data...');
        await chartControls?.loadData(false);
      }, 30000) as unknown as number;
    }
    
    // Subscribe to strategy store
    const unsubscribe = strategyStore.subscribe(state => {
      if (state.balance !== undefined) {
        startBalance = state.balance;
      }
      if (state.fees) {
        makerFeePercent = state.fees.maker * 100;
        takerFeePercent = state.fees.taker * 100;
      }
      paperTradingActive = state.paperTradingActive || false;
    });
    
    // Mark as mounted to enable reactive statements
    mounted = true;
    
    return () => {
      unsubscribe();
      if (refreshInterval) {
        clearInterval(refreshInterval);
        refreshInterval = null;
      }
    };
  });
  
  onDestroy(() => {
    if (refreshInterval) {
      clearInterval(refreshInterval);
      refreshInterval = null;
    }
  });
</script>

<BacktestingControls
  bind:this={chartControls}
  bind:selectedGranularity
  bind:selectedPeriod
  bind:historicalCandles
  bind:isLoadingChart
  bind:connectionStatus
  on:dataUpdated={handleDataUpdated}
/>

<BacktestingLayout {sidebarCollapsed}>
  <div slot="sidebar">
    <CollapsibleSidebar 
      {sidebarCollapsed}
      activeSection="backtesting"
      on:toggle={toggleSidebar}
      on:navigate={handleNavigation}
    />
  </div>
  
  <div slot="header">
    <BacktestingHeader {currentPrice} {connectionStatus} />
  </div>
  
  <div slot="content">
    <PanelsRow>
      <BacktestingChart
        slot="chart"
        {historicalCandles}
        backtestTrades={backtestResults?.trades || []}
        {selectedGranularity}
        {selectedPeriod}
        {autoGranularityActive}
        {isLoadingChart}
        on:selectGranularity={(e) => chartControls?.selectGranularity(e.detail.granularity)}
        on:selectPeriod={(e) => chartControls?.selectPeriod(e.detail.period)}
      />
      
      <StrategyPanel
        slot="controls" 
        {isSynced}
        {paperTradingActive}
        {isRunning}
        {showSyncSuccess}
        on:syncToPaperTrading={syncToPaperTrading}
        on:runBacktest={handleRunBacktest}
      >
        <div slot="tabs">
          <StrategyTabs bind:activeTab />
        </div>
        
        <div slot="content">
          {#if activeTab === 'config'}
            <ConfigTab
              bind:selectedStrategyType
              {strategies}
              {showSaveSuccess}
              bind:startBalance
              bind:makerFeePercent
              bind:takerFeePercent
              bind:feeRebatePercent
              on:updateStrategy={updateStrategy}
              on:saveCurrentStrategy={handleStrategyAction}
              on:importStrategy={handleStrategyAction}
              on:exportStrategy={handleStrategyAction}
              on:editStrategy={handleStrategyAction}
              on:deleteStrategy={handleStrategyAction}
            >
              <div slot="strategy-params">
                <BacktestingStrategyParams
                  {selectedStrategyType}
                  bind:strategyParams
                  {currentPrice}
                  {startBalance}
                  {customPresets}
                  {selectedPresetIndex}
                />
              </div>
            </ConfigTab>
          {:else if activeTab === 'code'}
            <CodeTab 
              {selectedStrategyType}
              {strategySourceCode}
            />
          {:else if activeTab === 'backups'}
            <BackupsTab {savedBackups}>
              <BacktestingBackups
                {savedBackups}
              />
            </BackupsTab>
          {/if}
        </div>
      </StrategyPanel>
    </PanelsRow>
    
    {#if backtestResults}
      <BacktestingResults
        {backtestResults}
        {selectedStrategyType}
        {strategyParams}
        {selectedGranularity}
        {startBalance}
      />
    {/if}
  </div>
</BacktestingLayout>

<style>
  /* Force grid layout for panels */
  :global(.panels-row) {
    display: grid;
    grid-template-columns: 2fr 1fr;
    gap: 20px;
    height: 600px;
    width: 100%;
    align-items: start;
  }
  
  /* Direct child selectors to ensure grid items are positioned correctly */
  :global(.panels-row > *:nth-child(1)) {
    grid-column: 1;
  }
  
  :global(.panels-row > *:nth-child(2)) {
    grid-column: 2;
  }

  /* Ensure panels have proper styling */
  :global(.panel) {
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(74, 0, 224, 0.3);
    border-radius: 8px;
    display: flex;
    flex-direction: column;
  }

  :global(.chart-panel) {
    height: 100%;
    min-height: 0;
    overflow: hidden;
  }

  :global(.strategy-panel) {
    min-height: 500px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  /* Main layout styles */
  :global(.dashboard-layout) {
    display: flex;
    min-height: 100vh;
    background: #0a0a0a;
    color: #d1d4dc;
  }

  :global(.dashboard-content) {
    flex: 1;
    display: flex;
    flex-direction: column;
    margin-left: 250px;
    width: calc(100% - 250px);
    transition: all 0.3s ease;
  }

  :global(.dashboard-content.expanded) {
    margin-left: 80px;
    width: calc(100% - 80px);
  }

  :global(.content-wrapper) {
    flex: 1;
    overflow-y: auto;
  }

  :global(.backtest-grid) {
    display: flex;
    flex-direction: column;
    gap: 20px;
    padding: 20px;
  }

  :global(.panel-header) {
    padding: 15px 20px;
    background: rgba(74, 0, 224, 0.1);
    border-bottom: none;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  :global(.panel-header h2) {
    margin: 0;
    font-size: 16px;
    color: #a78bfa;
  }
</style>