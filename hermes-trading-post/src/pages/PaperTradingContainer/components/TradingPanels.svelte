<script lang="ts">
  import TradingChart from '../../PaperTrading/components/TradingChart.svelte';
  import StrategyControls from '../../../components/papertrading/StrategyControls.svelte';
  import { createEventDispatcher } from 'svelte';

  export let chartComponent: any = null;
  export let selectedPair: string;
  export let selectedGranularity: string;
  export let selectedPeriod: string;
  export let chartSpeed: string;
  export let selectedTestDateString: string;
  export let botTabs: any[];
  export let activeBotInstance: any;
  export let tradingState: any;
  export let backendState: any;
  export let strategies: any[];

  const dispatch = createEventDispatcher();

  function forwardEvent(event: CustomEvent) {
    dispatch(event.type, event.detail);
  }
  
</script>

<div class="panels-row main-panels-row">
  <!-- Chart Panel -->
  <div class="chart-container">
    <TradingChart
    bind:chartComponent
    {selectedPair}
    {selectedGranularity}
    {selectedPeriod}
    {chartSpeed}
    {selectedTestDateString}
    {botTabs}
    {activeBotInstance}
    isRunning={tradingState.isRunning}
    isPaused={tradingState.isPaused}
    trades={tradingState.trades}
    isPaperTestRunning={false}
    currentPrice={backendState.currentPrice || 0}
    priceChange24h={backendState.priceChange24h || 0}
    priceChangePercent24h={backendState.priceChangePercent24h || 0}
    on:pairChange={forwardEvent}
    on:granularityChange={forwardEvent}
    on:periodChange={forwardEvent}
    on:speedChange={forwardEvent}
    on:dateChange={forwardEvent}
    on:botTabSelect={forwardEvent}
    />
  </div>
  
  <!-- Strategy Controls Panel -->
  <div class="strategy-container">
    <StrategyControls
    selectedStrategyType={tradingState.selectedStrategyType}
    {strategies}
    isRunning={tradingState.isRunning}
    isPaused={tradingState.isPaused}
    balance={tradingState.balance}
    btcBalance={tradingState.btcBalance}
    vaultBalance={tradingState.vaultBalance}
    btcVaultBalance={tradingState.btcVaultBalance}
    positions={tradingState.positions}
    currentPrice={backendState.currentPrice}
    {botTabs}
    {activeBotInstance}
    totalTrades={tradingState.trades?.length || 0}
    totalReturn={tradingState.totalReturn}
    startingBalance={10000}
    totalFees={tradingState.totalFees}
    totalRebates={tradingState.totalRebates}
    totalRebalance={tradingState.totalRebalance}
    on:strategyChange={forwardEvent}
    on:balanceChange={forwardEvent}
    on:start={forwardEvent}
    on:pause={forwardEvent}
    on:resume={forwardEvent}
    on:selectBot={forwardEvent}
    on:reset={forwardEvent}
    />
  </div>
</div>

<style>
  .panels-row {
    display: grid;
    grid-template-columns: 2fr 1fr;
    gap: 20px;
    width: 100%;
    min-width: 0;
  }

  .main-panels-row {
    display: grid;
    grid-template-columns: 2fr 1fr;
    gap: 20px;
    height: 600px;
    width: 100%;
    min-width: 0;
    align-items: stretch;
  }

  .chart-container {
    width: 100%;
    min-width: 0;
    height: 100%;
  }

  .strategy-container {
    width: 100%;
    min-width: 0;
    height: 100%;
  }

  /* Mobile responsive layout - stack strategy controls below chart */
  @media (max-width: 768px) {
    .panels-row,
    .main-panels-row {
      display: flex !important;
      flex-direction: column !important;
      grid-template-columns: none !important;
      grid-template-rows: none !important;
      grid-template-areas: none !important;
      height: auto !important;
    }

    .chart-container {
      width: 100%;
      height: 600px;
      order: 1;
    }

    .strategy-container {
      width: 100%;
      height: auto;
      order: 2;
      margin-top: 0;
    }
  }

  /* Tablet responsive layout - adjust ratio */
  @media (max-width: 1024px) and (min-width: 769px) {
    .panels-row,
    .main-panels-row {
      grid-template-columns: 1.5fr 1fr;
    }
  }
</style>