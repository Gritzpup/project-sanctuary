<script lang="ts">
  import OpenPositions from '../../../components/papertrading/OpenPositions.svelte';
  import TradingHistory from '../../../components/papertrading/TradingHistory.svelte';
  import MarketGauge from '../../../components/trading/MarketGauge.svelte';

  export let tradingState: any;
  export let backendState: any;
</script>

<!-- Three-panel row: Open Positions, Trading History, and Market Gauge -->
<div class="panels-row-bottom">
  <OpenPositions
    positions={tradingState.positions || []}
    currentPrice={backendState.currentPrice || 0}
    isRunning={tradingState.isRunning || false}
  />
  <TradingHistory trades={tradingState.trades || []} />
  <div class="market-gauge-panel">
    <MarketGauge
      currentPrice={backendState.currentPrice}
      nextBuyPrice={backendState.nextBuyPrice}
      nextSellPrice={backendState.nextSellPrice}
      recentHigh={backendState.recentHigh || tradingState.recentHigh || 0}
      isRunning={tradingState.isRunning}
      trades={tradingState.trades || []}
      positions={tradingState.positions || []}
      nextBuyDistance={backendState.nextBuyDistance || 0}
    />
  </div>
</div>

<style>
  .panels-row-bottom {
    display: grid;
    /* Open Positions (1fr) + Trading History (1fr) + Market Gauge (1fr) */
    grid-template-columns: 1fr 1fr 1fr;
    gap: 20px;
    margin-top: 0px;
    margin-bottom: 40px;
    height: 400px;
  }

  /* First panel (Open Positions) - smaller */
  .panels-row-bottom > :first-child {
    grid-column: 1;
  }

  /* Second panel (Trading History) - aligns with depth chart */
  .panels-row-bottom > :nth-child(2) {
    grid-column: 2;
  }

  /* Third panel (Market Gauge) - aligns with strategy controls */
  .market-gauge-panel {
    grid-column: 3;
  }

  /* Mobile responsive layout */
  @media (max-width: 768px) {
    .panels-row-bottom {
      grid-template-columns: 1fr;
      grid-template-rows: 1fr 1fr 1fr;
      height: 1200px;
    }

    .panels-row-bottom > :first-child,
    .panels-row-bottom > :nth-child(2),
    .market-gauge-panel {
      grid-column: 1;
    }
  }

  /* Desktop layout - custom sizing */
  @media (min-width: 769px) {
    .panels-row-bottom {
      /* Open Positions (1.5fr), Trading History (1.5fr), Market Gauge (1fr) */
      grid-template-columns: 1.5fr 1.5fr 1fr;
    }

    .panels-row-bottom > :first-child {
      grid-column: 1; /* Open Positions */
    }

    .panels-row-bottom > :nth-child(2) {
      grid-column: 2; /* Trading History */
    }

    .market-gauge-panel {
      grid-column: 3; /* Market Gauge - narrower */
    }
  }
</style>
