<script lang="ts">
  import OpenPositions from '../../../components/papertrading/OpenPositions.svelte';
  import TradingHistory from '../../../components/papertrading/TradingHistory.svelte';
  import MarketGauge from '../../../components/trading/MarketGauge.svelte';

  export let tradingState: any;
  export let backendState: any;
</script>

<!-- Two-panel row matching chart/strategy layout -->
<div class="panels-row-bottom">
  <!-- Left section: Open Positions and Trading History under chart -->
  <div class="left-panels">
    <OpenPositions
      positions={tradingState.positions || []}
      currentPrice={backendState.currentPrice || 0}
      isRunning={tradingState.isRunning || false}
    />
    <TradingHistory trades={tradingState.trades || []} />
  </div>
  
  <!-- Right section: Market Gauge under strategy controls -->
  <div class="right-panel">
    <div class="panel gauge-panel">
      <MarketGauge 
        currentPrice={backendState.currentPrice}
        positions={tradingState.positions}
        recentHigh={tradingState.recentHigh}
        recentLow={tradingState.recentLow}
        isRunning={tradingState.isRunning}
      />
    </div>
  </div>
</div>

<style>
  .panels-row-bottom {
    display: grid;
    grid-template-columns: 2fr 1fr;
    gap: 20px;
    margin-top: 0px;
    height: 300px;
  }
  
  .left-panels {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
    height: 100%;
  }
  
  .right-panel {
    display: flex;
    height: 100%;
  }
  
  .gauge-panel {
    width: 100%;
    height: 100%;
  }

  /* Mobile responsive layout */
  @media (max-width: 768px) {
    .panels-row-bottom {
      grid-template-columns: 1fr;
      grid-template-rows: auto auto;
      height: auto;
    }
    
    .left-panels {
      grid-template-columns: 1fr;
      grid-template-rows: 1fr 1fr;
      height: 600px;
    }
    
    .right-panel {
      height: 300px;
    }
  }

  /* Tablet responsive layout */
  @media (max-width: 1024px) and (min-width: 769px) {
    .panels-row-bottom {
      grid-template-columns: 1.5fr 1fr;
    }
    
    .left-panels {
      grid-template-columns: 1fr;
      grid-template-rows: 1fr 1fr;
    }
  }
</style>