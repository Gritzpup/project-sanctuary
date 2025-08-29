<script lang="ts">
  // Layout Components
  import CollapsibleSidebar from './CollapsibleSidebar.svelte';
  import BacktestingLayout from '../components/backtesting/layout/BacktestingLayout.svelte';
  import BacktestingHeader from '../components/backtesting/layout/BacktestingHeader.svelte';
  import PanelsRow from '../components/backtesting/layout/PanelsRow.svelte';
  
  // Control Components
  import StrategyPanel from '../components/backtesting/controls/StrategyPanel.svelte';
  import StrategyTabs from '../components/backtesting/controls/StrategyTabs.svelte';
  
  // Tab Components
  import ConfigTab from '../components/backtesting/tabs/ConfigTab.svelte';
  import CodeTab from '../components/backtesting/tabs/CodeTab.svelte';
  import BackupsTab from '../components/backtesting/tabs/BackupsTab.svelte';
  
  // Existing Components
  import BacktestingChart from './Backtesting/BacktestingChart.svelte';
  import BacktestingResults from './Backtesting/BacktestingResults.svelte';
  import BacktestingStrategyParams from './Backtesting/BacktestingStrategyParams.svelte';
  import BacktestingBackups from './Backtesting/BacktestingBackups.svelte';
  
  // Services & Stores
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import { BacktestingEngine } from '../services/backtestingEngine';
  import { ReverseRatioStrategy } from '../strategies/implementations/ReverseRatioStrategy';
  import { GridTradingStrategy } from '../strategies/implementations/GridTradingStrategy';
  import { RSIMeanReversionStrategy } from '../strategies/implementations/RSIMeanReversionStrategy';
  import { DCAStrategy } from '../strategies/implementations/DCAStrategy';
  import { VWAPBounceStrategy } from '../strategies/implementations/VWAPBounceStrategy';
  import { MicroScalpingStrategy } from '../strategies/implementations/MicroScalpingStrategy';
  import type { Strategy } from '../strategies/base/Strategy';
  import type { BacktestConfig, BacktestResult } from '../strategies/base/StrategyTypes';
  import type { CandleData } from '../types/coinbase';
  import { historicalDataService, HistoricalDataService } from '../services/historicalDataService';
  import { strategyStore, syncStatus } from '../stores/strategyStore';
  
  export let currentPrice: number = 0;
  export let connectionStatus: 'connected' | 'disconnected' | 'error' | 'loading' = 'loading';
  export let sidebarCollapsed = false;
  
  const dispatch = createEventDispatcher();
  
  // Chart state
  let selectedGranularity = '1m';
  let selectedPeriod = '1H';
  let autoGranularityActive = false;
  let isLoadingChart = false;
  let historicalCandles: CandleData[] = [];
  
  // Backtesting state
  let selectedStrategyType = 'reverse-ratio';
  let startBalance = 1000;
  let backtestResults: BacktestResult | null = null;
  let isRunning = false;
  let backtestingEngine: BacktestingEngine;
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
  
  // Backups
  let savedBackups: Array<any> = [];
  let customStrategies: Array<any> = [];
  
  // Built-in strategies
  const builtInStrategies = [
    { value: 'reverse-ratio', label: 'Reverse Ratio', description: 'Grid trading with reverse position sizing', isCustom: false },
    { value: 'grid-trading', label: 'Grid Trading', description: 'Classic grid trading strategy', isCustom: false },
    { value: 'rsi-mean-reversion', label: 'RSI Mean Reversion', description: 'Trade RSI oversold/overbought', isCustom: false },
    { value: 'dca', label: 'Dollar Cost Averaging', description: 'Regular periodic purchases', isCustom: false },
    { value: 'vwap-bounce', label: 'VWAP Bounce', description: 'Trade VWAP support/resistance', isCustom: false },
    { value: 'micro-scalping', label: 'Micro Scalping (1H)', description: 'High-frequency 1H trading with 0.8% entries', isCustom: false },
    { value: 'proper-scalping', label: 'Proper Scalping', description: 'Professional scalping with RSI, MACD, and stop losses', isCustom: false }
  ];
  
  $: strategies = [...builtInStrategies, ...customStrategies];
  
  // Strategy parameters
  let strategyParams: Record<string, any> = {
    'reverse-ratio': {
      initialDropPercent: 0.02,
      levelDropPercent: 0.015,
      ratioMultiplier: 1.0,
      profitTarget: 0.85,
      maxLevels: 12,
      lookbackPeriod: 3,
      positionSizeMode: 'percentage',
      basePositionPercent: 8,
      basePositionAmount: 50,
      maxPositionPercent: 96
    }
  };
  
  let customPresets: Array<any> = [];
  let selectedPresetIndex: number = 0;
  
  function toggleSidebar() {
    dispatch('toggle');
  }
  
  function handleNavigation(event: CustomEvent) {
    dispatch('navigate', event.detail);
  }
  
  function syncToPaperTrading() {
    showSyncSuccess = true;
    isSynced = true;
    setTimeout(() => showSyncSuccess = false, 2000);
  }
  
  function runBacktest() {
    isRunning = true;
    // Run backtest logic here
    setTimeout(() => isRunning = false, 3000);
  }
  
  function updateStrategy() {
    // Update strategy logic
  }
  
  function handleStrategyAction(event: CustomEvent) {
    // Handle various strategy actions
    console.log('Strategy action:', event.type, event.detail);
  }
  
  onMount(() => {
    backtestingEngine = new BacktestingEngine();
  });
</script>

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
      <div slot="chart">
        <BacktestingChart
          {historicalCandles}
          {backtestResults}
          {selectedGranularity}
          {selectedPeriod}
          {autoGranularityActive}
          {isLoadingChart}
        />
      </div>
      
      <div slot="controls">
        <StrategyPanel 
          {isSynced}
          {paperTradingActive}
          {isRunning}
          {showSyncSuccess}
          on:syncToPaperTrading={syncToPaperTrading}
          on:runBacktest={runBacktest}
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
        
        {#if backtestResults}
          <BacktestingResults
            results={backtestResults}
            {startBalance}
          />
        {/if}
      </div>
    </PanelsRow>
  </div>
</BacktestingLayout>