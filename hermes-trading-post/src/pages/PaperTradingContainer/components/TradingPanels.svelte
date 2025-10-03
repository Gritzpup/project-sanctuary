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
    tradingData={backendState}
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
    nextBuyDistance={backendState.nextBuyDistance}
    nextSellDistance={backendState.nextSellDistance}
    on:strategyChange={forwardEvent}
    on:balanceChange={forwardEvent}
    on:start={forwardEvent}
    on:pause={forwardEvent}
    on:resume={forwardEvent}
    on:stop={forwardEvent}
    on:selectBot={forwardEvent}
    on:reset={forwardEvent}
    />
  </div>
</div>

<style>
  /* Mobile-first design: Default flex layout */
  .panels-row {
    display: flex;
    flex-direction: column;
    gap: 20px;
    width: 100%;
    min-width: 0;
  }

  .main-panels-row {
    display: flex;
    flex-direction: column;
    gap: 20px;
    width: 100%;
    min-width: 0;
    align-items: stretch;
  }

  .chart-container {
    width: 100%;
    min-width: 0;
    height: 500px; /* Default height */
    order: 1;
    overflow: hidden;
    position: relative;
  }

  .strategy-container {
    width: 100%;
    min-width: 0;
    height: auto;
    order: 2;
    margin-top: 0;
  }

  /* Desktop enhancement: Grid layout for larger screens */
  @media (min-width: 769px) {
    .panels-row,
    .main-panels-row {
      display: grid;
      grid-template-columns: 2fr 1fr;
      gap: 20px;
    }

    .main-panels-row {
      height: 600px;
    }

    .chart-container {
      height: 100%; /* Full height on desktop in grid */
      order: unset;
    }

    .strategy-container {
      height: 100%;
      order: unset;
      margin-top: unset;
    }
  }

  /* Mobile-specific adjustments */
  @media (max-width: 768px) {
    .chart-container {
      height: 650px; /* 50px taller than 600px */
      min-height: 500px;
    }
    
    .strategy-container {
      min-height: 200px;
    }
  }

  /* Tablet responsive layout - adjust grid ratio */
  @media (min-width: 769px) and (max-width: 1024px) {
    .panels-row,
    .main-panels-row {
      grid-template-columns: 1.5fr 1fr;
    }
  }
</style>