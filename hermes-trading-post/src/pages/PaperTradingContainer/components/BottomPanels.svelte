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
      positions={tradingState.positions}
      recentHigh={tradingState.recentHigh}
      recentLow={tradingState.recentLow}
      isRunning={tradingState.isRunning}
    />
  </div>
</div>

<style>
  .panels-row-bottom {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 20px;
    margin-top: 0px;
    height: 300px;
  }

  .market-gauge-panel {
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(74, 0, 224, 0.3);
    border-radius: 8px;
    overflow: hidden;
  }

  /* Mobile responsive layout */
  @media (max-width: 768px) {
    .panels-row-bottom {
      grid-template-columns: 1fr;
      grid-template-rows: 1fr 1fr 1fr;
      height: 900px;
    }
  }
</style>