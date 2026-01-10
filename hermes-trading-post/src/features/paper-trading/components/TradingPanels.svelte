<script lang="ts">
  import TradingChart from './TradingChart.svelte';
  import StrategyControls from './StrategyControls.svelte';
  import DepthChart from '../../../pages/trading/orderbook/components/DepthChart.svelte';
  import FixedOrderbookList from '../../../pages/trading/orderbook/components/FixedOrderbookList.svelte';
  import MarketGauge from '../../../components/trading/MarketGauge.svelte';
  import { createEventDispatcher, onMount } from 'svelte';
  // orderbookStore and aggregateOrderbookLevels imports removed - orderbook disconnected from live API

  // Props using Svelte 5 runes syntax
  let {
    chartComponent = $bindable(null),
    selectedPair,
    selectedGranularity,
    selectedPeriod,
    chartSpeed,
    selectedTestDateString,
    botTabs,
    activeBotInstance,
    tradingState,
    backendState,
    strategies
  }: {
    chartComponent?: any;
    selectedPair: string;
    selectedGranularity: string;
    selectedPeriod: string;
    chartSpeed: string;
    selectedTestDateString: string;
    botTabs: any[];
    activeBotInstance: any;
    tradingState: any;
    backendState: any;
    strategies: any[];
  } = $props();

  // Event types for dispatch
  type Events = {
    pairChange: { pair: string };
    granularityChange: { granularity: string };
    periodChange: { period: string };
    speedChange: { speed: string };
    dateChange: { date: string };
    botSelect: { botId: string };
    strategyChange: { strategy: string };
    balanceChange: { balance: number };
    start: void;
    pause: void;
    resume: void;
    stop: void;
    selectBot: { botId: string };
    reset: void;
  };

  const dispatch = createEventDispatcher<Events>();

  // ⚡ SEAMLESS REFRESH: Key changes on every page load to refresh only chart canvases
  let chartRefreshKey = $state(Date.now());

  onMount(() => {
  });

  function forwardEvent(event: CustomEvent) {
    dispatch(event.type as keyof Events, event.detail);
  }

  // Orderbook data - DISCONNECTED from live API for performance
  // Using empty arrays instead of orderbookStore to prevent WebSocket connections
  let bids: any[] = [];
  let asks: any[] = [];
  let bidsWithCumulative: any[] = [];
  let asksWithCumulative: any[] = [];
  let maxBidSize = 0;
  let maxAskSize = 0;

</script>

<div class="panels-row main-panels-row">
  <!-- Chart Panel - 🔒 PERSISTENT: Header/footer stay, only canvas refreshes -->
  <div class="chart-container">
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
    on:botSelect={forwardEvent}
    />
  </div>

  <!-- Middle Column: Orderbook - Displayed but DISCONNECTED from live API -->
  <div class="middle-column">
    <DepthChart {chartRefreshKey}>
      {#snippet children()}
        <FixedOrderbookList {chartRefreshKey} />
      {/snippet}
    </DepthChart>
  </div>

  <!-- Strategy Controls Panel - 🔒 PERSISTENT: Never refreshes, maintains state -->
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
    startingBalance={10000}
    totalFees={tradingState.totalFees}
    totalRebates={tradingState.totalRebates}
    nextBuyDistance={backendState.nextBuyDistance}
    nextSellDistance={backendState.nextSellDistance}
    nextBuyPrice={backendState.nextBuyPrice}
    nextSellPrice={backendState.nextSellPrice}
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

  .middle-column {
    width: 100%;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 20px;
    order: 2;
  }

  .strategy-container {
    width: 100%;
    min-width: 0;
    height: auto;
    order: 3;
    margin-top: 0;
  }

  /* Desktop enhancement: 3-column layout (orderbook displayed but disconnected) */
  @media (min-width: 769px) {
    .panels-row,
    .main-panels-row {
      display: grid;
      grid-template-columns: 2fr 1fr 1fr;
      gap: 20px;
    }

    .chart-container {
      grid-column: 1;
      grid-row: 1;
      height: 600px;
      order: unset;
    }

    .middle-column {
      grid-column: 2;
      grid-row: 1;
      height: 600px;
      order: unset;
    }

    .strategy-container {
      grid-column: 3;
      grid-row: 1;
      height: 600px;
      order: unset;
      margin-top: unset;
    }

    .main-panels-row {
      height: auto;
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
