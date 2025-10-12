<script lang="ts">
  import OpenPositions from '../../../components/papertrading/OpenPositions.svelte';
  import TradingHistory from '../../../components/papertrading/TradingHistory.svelte';
  import MarketGauge from '../../../components/trading/MarketGauge.svelte';

  export let tradingState: any;
  export let backendState: any;
</script>

<!-- Two-panel row: Open Positions and Trading History -->
<div class="panels-row-bottom">
  <OpenPositions
    positions={tradingState.positions || []}
    currentPrice={backendState.currentPrice || 0}
    isRunning={tradingState.isRunning || false}
  />
  <TradingHistory trades={tradingState.trades || []} />
</div>

<style>
  .panels-row-bottom {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
    margin-top: 0px;
    height: 300px;
  }

  /* Mobile responsive layout */
  @media (max-width: 768px) {
    .panels-row-bottom {
      grid-template-columns: 1fr;
      grid-template-rows: 1fr 1fr;
      height: 600px;
    }
  }
</style>