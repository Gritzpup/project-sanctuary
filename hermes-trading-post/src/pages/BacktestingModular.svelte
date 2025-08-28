<script lang="ts">
  import CollapsibleSidebar from './CollapsibleSidebar.svelte';
  import BacktestingChart from './Backtesting/BacktestingChart.svelte';
  import BacktestingControlsModular from './Backtesting/BacktestingControlsModular.svelte';
  import BacktestingResults from './Backtesting/BacktestingResults.svelte';
  import BacktestingStrategyParams from './Backtesting/BacktestingStrategyParams.svelte';
  import BacktestingBackups from './Backtesting/BacktestingBackups.svelte';
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
  import '../styles/backtesting.css';
  
  export let currentPrice: number = 0;
  export let connectionStatus: 'connected' | 'disconnected' | 'error' | 'loading' = 'loading';
  export let sidebarCollapsed = false;
  
  const dispatch = createEventDispatcher();
  
  // Chart settings
  let selectedGranularity = '1m';
  let selectedPeriod = '1H';
  let autoGranularityActive = false;
  let isLoadingChart = false;
  
  // Backtesting state
  let selectedStrategyType = 'reverse-ratio';
  let startBalance = 1000;
  let backtestResults: BacktestResult | null = null;
  let isRunning = false;
  let backtestingEngine: BacktestingEngine;
  let currentStrategy: Strategy | null = null;
  let historicalCandles: CandleData[] = [];
  
  // Fee configuration
  let makerFeePercent = 0.35;
  let takerFeePercent = 0.75;
  let feeRebatePercent = 25;
  
  // Visual feedback
  let showSaveSuccess = false;
  let showSyncSuccess = false;
  
  // Strategy management
  let savedBackups: Array<any> = [];
  let customStrategies: Array<any> = [];
  let customPresets: Array<any> = JSON.parse(localStorage.getItem('reverseRatioPresets') || '[]');
  let selectedPresetIndex: number = 0;
  
  // Sync state
  let isSynced = false;
  let paperTradingActive = false;
  
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
      maxPositionPercent: 96,
      vaultConfig: {
        btcVaultPercent: 14.3,
        usdGrowthPercent: 14.3,
        usdcVaultPercent: 71.4,
        compoundFrequency: 'trade',
        minCompoundAmount: 0.01,
        autoCompound: true,
        btcVaultTarget: 0.1,
        usdcVaultTarget: 10000,
        rebalanceThreshold: 5
      }
    }
  };
  
  function toggleSidebar() {
    dispatch('toggle');
  }
  
  function handleNavigation(event: CustomEvent) {
    dispatch('navigate', event.detail);
  }
  
  function syncToPaperTrading() {
    // Sync implementation
    showSyncSuccess = true;
    setTimeout(() => showSyncSuccess = false, 2000);
  }
  
  async function runBacktest() {
    isRunning = true;
    // Backtest implementation
    setTimeout(() => isRunning = false, 3000);
  }
  
  function updateStrategy() {
    // Update strategy implementation
  }
  
  function handleStrategyEvent(event: CustomEvent) {
    // Handle strategy events
  }
  
  onMount(() => {
    backtestingEngine = new BacktestingEngine();
  });
  
  onDestroy(() => {
    // Cleanup
  });
</script>

<div class="backtesting-container">
  <CollapsibleSidebar 
    {sidebarCollapsed} 
    activeSection="backtesting"
    on:toggle={toggleSidebar}
    on:navigate={handleNavigation}
  />
  
  <div class="main-content" class:sidebar-collapsed={sidebarCollapsed}>
    <div class="backtesting-header">
      <div class="header-left">
        <h1>Backtesting</h1>
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
    
    <div class="backtesting-content">
      <div class="left-column">
        <BacktestingControlsModular
          bind:selectedStrategyType
          {strategies}
          {strategyParams}
          bind:startBalance
          bind:makerFeePercent
          bind:takerFeePercent
          bind:feeRebatePercent
          {isSynced}
          {paperTradingActive}
          {isRunning}
          {currentPrice}
          {customPresets}
          {selectedPresetIndex}
          {showSaveSuccess}
          {showSyncSuccess}
          on:syncToPaperTrading={syncToPaperTrading}
          on:runBacktest={runBacktest}
          on:updateStrategy={updateStrategy}
          on:saveCurrentStrategy={handleStrategyEvent}
          on:importStrategy={handleStrategyEvent}
          on:exportStrategy={handleStrategyEvent}
          on:editStrategy={handleStrategyEvent}
          on:deleteStrategy={handleStrategyEvent}
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
          <div slot="backups-content">
            <BacktestingBackups
              {savedBackups}
              on:loadBackup={handleStrategyEvent}
              on:deleteBackup={handleStrategyEvent}
              on:exportBackup={handleStrategyEvent}
            />
          </div>
        </BacktestingControlsModular>
        
        {#if backtestResults}
          <BacktestingResults
            results={backtestResults}
            {startBalance}
          />
        {/if}
      </div>
      
      <div class="right-column">
        <BacktestingChart
          {historicalCandles}
          {backtestResults}
          {selectedGranularity}
          {selectedPeriod}
          {autoGranularityActive}
          {isLoadingChart}
          on:granularityChange={handleStrategyEvent}
          on:periodChange={handleStrategyEvent}
        />
      </div>
    </div>
  </div>
</div>

<style>
  .backtesting-container {
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
  
  .backtesting-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20px;
    background: rgba(15, 15, 15, 0.95);
    border-bottom: 1px solid rgba(74, 0, 224, 0.3);
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
  
  .backtesting-content {
    flex: 1;
    display: flex;
    gap: 20px;
    padding: 20px;
    overflow: hidden;
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
  
  @media (max-width: 1400px) {
    .backtesting-content {
      flex-direction: column;
    }
    
    .left-column {
      width: 100%;
    }
  }
</style>