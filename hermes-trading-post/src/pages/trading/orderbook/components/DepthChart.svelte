<script lang="ts">
  /**
   * @file DepthChart.svelte
   * @description Main depth chart component - orchestrates data, rendering, and UI
   */
  import { onMount, onDestroy } from 'svelte';
  import { useDepthChartData } from './useDepthChartData';
  import { useDepthChartRendering } from './useDepthChartRendering';
  import DepthChartOverlays from './DepthChartOverlays.svelte';
  import OrderbookList from './OrderbookList.svelte';

  let chartContainer: HTMLDivElement;

  // Data management hook
  const dataHook = useDepthChartData();

  // Chart rendering hook (initialized in onMount)
  let renderingHook: ReturnType<typeof useDepthChartRendering> | null = null;

  onMount(() => {
    // Initialize rendering after chartContainer is available
    renderingHook = useDepthChartRendering(
      chartContainer,
      dataHook.handleLevel2Message
    );

    const cleanupChart = renderingHook.initializeChart();

    // Connect to WebSocket (retry until connection is available)
    const connectInterval = setInterval(() => {
      if (dataHook.connectWebSocket()) {
        clearInterval(connectInterval);
      }
    }, 500);

    return () => {
      clearInterval(connectInterval);
      cleanupChart?.();
    };
  });

  onDestroy(() => {
    dataHook.cleanup();
    renderingHook?.cleanup();
  });
</script>

<div class="panel depth-chart-panel">
  <div class="panel-header">
    <div class="header-left">
      <h2>Order Book Depth</h2>
    </div>
    <div class="depth-chart-legend">
      <span class="legend-item bid">
        <span class="legend-color bid"></span>
        Bids
      </span>
      <span class="legend-item ask">
        <span class="legend-color ask"></span>
        Asks
      </span>
    </div>
  </div>
  <div class="panel-content">
    <div
      bind:this={chartContainer}
      class="depth-chart"
      on:mousemove={renderingHook?.handleMouseMove}
      on:mouseleave={renderingHook?.handleMouseLeave}
      role="img"
      aria-label="Orderbook depth chart"
    >
      {#if renderingHook}
        <DepthChartOverlays
          isHovering={renderingHook.hoverState.isHovering}
          mouseX={renderingHook.hoverState.mouseX}
          mouseY={renderingHook.hoverState.mouseY}
          hoverPrice={renderingHook.hoverState.hoverPrice}
          hoverVolume={renderingHook.hoverState.hoverVolume}
          volumeHotspot={dataHook.volumeHotspot}
          volumeRange={dataHook.volumeRange}
          priceRange={dataHook.priceRange}
        />
      {/if}
    </div>

    <OrderbookList
      bidsWithCumulative={dataHook.bidsWithCumulative}
      asksWithCumulative={dataHook.asksWithCumulative}
      maxBidSize={dataHook.maxBidSize}
      maxAskSize={dataHook.maxAskSize}
    />
  </div>
</div>

<style>
  /* Panel styling matching other trading panels */
  .panel {
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(74, 0, 224, 0.3);
    border-radius: 8px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    height: 100%;
    max-width: 100%;
  }

  .panel-header {
    background: var(--bg-primary-subtle);
    padding: 15px 20px;
    border-bottom: 1px solid var(--border-primary);
    display: flex;
    justify-content: space-between;
    align-items: center;
    min-height: 50px;
    flex-shrink: 0;
  }

  .panel-header h2 {
    margin: 0;
    font-size: 16px;
    color: #a78bfa;
    font-weight: 500;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .panel-content {
    padding: 15px;
    overflow-y: auto;
    flex: 1;
    display: flex;
    flex-direction: column;
  }

  .depth-chart-legend {
    display: flex;
    gap: 12px;
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: #c4b5fd;
  }

  .legend-color {
    width: 16px;
    height: 3px;
    border-radius: 2px;
  }

  .legend-color.bid {
    background: rgba(38, 166, 154, 1);
  }

  .legend-color.ask {
    background: rgba(239, 83, 80, 1);
  }

  .depth-chart {
    width: 100%;
    height: 230px;
    position: relative;
    margin-bottom: 15px;
    overflow: hidden;
    border: 1px solid rgba(74, 0, 224, 0.3);
    border-radius: 6px;
    background: #1a1a1a;
  }

  .depth-chart :global(.tv-lightweight-charts) {
    width: 100% !important;
    height: 100% !important;
  }

  /* Hide TradingView watermark */
  .depth-chart :global(.tv-lightweight-charts) :global([class*="watermark"]) {
    display: none !important;
    visibility: hidden !important;
    opacity: 0 !important;
  }

  .depth-chart :global(.tv-lightweight-charts div[style*="cursor: pointer"]) {
    display: none !important;
    visibility: hidden !important;
    opacity: 0 !important;
  }

  .depth-chart :global(.tv-lightweight-charts svg) {
    display: none !important;
  }

  .depth-chart :global(.tv-lightweight-charts div[style*="position: absolute"][style*="right"][style*="bottom"]) {
    display: none !important;
  }

  .depth-chart :global(div[style*="background-image"]) {
    background-image: none !important;
  }

  /* Responsive */
  @media (max-width: 768px) {
    .panel-content {
      padding: 10px;
    }

    .depth-chart {
      height: 250px;
    }
  }
</style>
