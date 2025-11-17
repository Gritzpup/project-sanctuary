<script lang="ts">
  // Layout Components
  import CollapsibleSidebar from '../../components/layout/CollapsibleSidebar.svelte';
  import BacktestingLayout from '../../components/backtesting/layout/BacktestingLayout.svelte';
  import PanelsRow from '../../components/backtesting/layout/PanelsRow.svelte';
  
  // Control Components
  import StrategyPanel from '../../components/backtesting/controls/StrategyPanel.svelte';
  import StrategyTabs from '../../components/backtesting/controls/StrategyTabs.svelte';
  
  // Tab Components (moved to controls/)
  import ConfigTab from '../../components/backtesting/controls/ConfigurationTab.svelte';
  import CodeTab from '../../components/backtesting/controls/CodeEditorTab.svelte';
  import BackupsTab from '../../components/backtesting/controls/BackupsTab.svelte';
  
  // Existing Components
  import TradingChart from '../../features/paper-trading/components/TradingChart.svelte';
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
  let selectedPair = 'BTC-USD';
  let selectedGranularity = '1m';
  let selectedPeriod = '1H';
  let chartSpeed = '1x';
  let selectedTestDateString = '';
  let autoGranularityActive = false;
  let isLoadingChart = false;
  let historicalCandles: CandleData[] = [];
  let refreshInterval: number | null = null;
  let chartRefreshKey = Date.now();
  let chartComponent: any = null;
  let botTabs: any[] = [];
  let activeBotInstance: any = null;
  
  // Backtesting state
  let selectedStrategyType = 'reverse-descending-grid';
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
      alert(`Backtest failed: ${error.message}`);
    } finally {
      isRunning = false;
    }
  }
  
  function updateStrategy() {
    try {
      currentStrategy = createStrategy(selectedStrategyType, strategyParams[selectedStrategyType], customStrategies);
      strategySourceCode = loadStrategySourceCode(selectedStrategyType, customStrategies);
    } catch (error) {
      currentStrategy = null;
      alert(`Failed to create strategy: ${error.message}`);
    }
  }
  
  function handleStrategyAction(event: CustomEvent) {
  }
  
  function handleDataUpdated(event: CustomEvent) {
    historicalCandles = event.detail.historicalCandles;
    connectionStatus = event.detail.connectionStatus;
  }
  
  onMount(async () => {
    
    // Initialize strategy first
    try {
      currentStrategy = createStrategy(selectedStrategyType, strategyParams[selectedStrategyType], customStrategies);
      strategySourceCode = loadStrategySourceCode(selectedStrategyType, customStrategies);
    } catch (error) {
    }
    
    // Load chart data
    await chartControls?.loadData(true);
    
    // Set up auto-refresh for short periods
    if (['1H', '4H', '5D'].includes(selectedPeriod)) {
      refreshInterval = setInterval(async () => {
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

  <div slot="content">
    <PanelsRow>
      <div slot="chart" class="chart-container">
        <TradingChart
          bind:chartComponent
          {chartRefreshKey}
          {selectedPair}
          {selectedGranularity}
          {selectedPeriod}
          {chartSpeed}
          {selectedTestDateString}
          {botTabs}
          {activeBotInstance}
          {isRunning}
          isPaused={false}
          trades={backtestResults?.trades || []}
          isPaperTestRunning={false}
          {currentPrice}
          priceChange24h={0}
          priceChangePercent24h={0}
          tradingData={{}}
          hideProgressBar={true}
          hidePlaybackControls={true}
        />
      </div>
      
      <div slot="controls" class="strategy-container">
        <StrategyPanel
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
      </div>
    </PanelsRow>

    <BacktestingResults
      {backtestResults}
      {selectedStrategyType}
      {strategyParams}
      {selectedGranularity}
      {startBalance}
    />
  </div>
</BacktestingLayout>

<style>
  /* Component-specific styles only - global layout styles are in layout-system.css */
</style>