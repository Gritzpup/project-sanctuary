<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { createChart, type IChartApi, type ISeriesApi, ColorType } from 'lightweight-charts';
  import { orderbookStore } from '../stores/orderbookStore.svelte';
  import { dataStore } from '../../chart/stores/dataStore.svelte';

  let chartContainer: HTMLDivElement;
  let chart: IChartApi;
  let bidSeries: ISeriesApi<'Area'>;
  let askSeries: ISeriesApi<'Area'>;
  let ws: WebSocket | null = null;

  // Reactive orderbook data for display
  let bids = $derived(orderbookStore.getBids(10));
  let asks = $derived(orderbookStore.getAsks(10));
  let maxBidSize = $derived(Math.max(...bids.map(b => b.size), 0.001));
  let maxAskSize = $derived(Math.max(...asks.map(a => a.size), 0.001));

  onMount(() => {
    // Initialize chart
    chart = createChart(chartContainer, {
      layout: {
        background: { type: ColorType.Solid, color: '#1a1a1a' },
        textColor: '#d1d4dc',
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { visible: false },
      },
      width: chartContainer.clientWidth + 20, // Add 20px to stretch chart slightly
      height: chartContainer.clientHeight || 230,
      timeScale: {
        visible: false, // Hide bottom scale (was showing confusing numbers)
      },
      leftPriceScale: {
        visible: true,
        borderVisible: false,
        mode: 1, // Normal price scale mode
        entireTextOnly: false,
        alignLabels: true,
        scaleMargins: {
          top: 0.1,
          bottom: 0.1,
        },
        minimumWidth: 0, // Remove minimum width to allow overlay
      },
      rightPriceScale: {
        visible: false,
      },
      crosshair: {
        vertLine: {
          labelVisible: true,
        },
        horzLine: {
          labelVisible: true,
        },
      },
      watermark: {
        visible: false, // Hide TradingView watermark
      },
    });

    // Create bid series (green mountain on left)
    bidSeries = chart.addAreaSeries({
      topColor: 'rgba(38, 166, 154, 0.4)',
      bottomColor: 'rgba(38, 166, 154, 0.0)',
      lineColor: 'rgba(38, 166, 154, 1)',
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false, // Remove price tag
      priceScaleId: 'left',
    });

    // Create ask series (red mountain on right)
    askSeries = chart.addAreaSeries({
      topColor: 'rgba(239, 83, 80, 0.4)',
      bottomColor: 'rgba(239, 83, 80, 0.0)',
      lineColor: 'rgba(239, 83, 80, 1)',
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false, // Remove price tag
      priceScaleId: 'left',
    });

    // Connect to WebSocket for orderbook data (retry until connection is available)
    const connectInterval = setInterval(() => {
      if (connectWebSocket()) {
        clearInterval(connectInterval);
      }
    }, 500); // Retry every 500ms

    // Cleanup interval on unmount
    return () => {
      clearInterval(connectInterval);
    };

    // Handle resize
    const resizeObserver = new ResizeObserver(() => {
      if (chart && chartContainer) {
        chart.applyOptions({
          width: chartContainer.clientWidth + 20, // Add 20px to stretch chart slightly
          height: chartContainer.clientHeight || 230,
        });
      }
    });
    resizeObserver.observe(chartContainer);

    // Cleanup
    return () => {
      resizeObserver.disconnect();
      if (ws) ws.close();
      if (chart) chart.remove();
    };
  });

  function connectWebSocket(): boolean {
    // Use the same WebSocket connection as the main chart
    ws = dataStore.getWebSocket();

    if (!ws) {
      return false; // WebSocket not ready yet
    }

    console.log('📊 DepthChart: Connected to WebSocket, listening for level2 messages');

    // Listen for level2 messages
    const originalOnMessage = ws.onmessage;
    ws.onmessage = (event) => {
      // Call original handler first
      if (originalOnMessage) originalOnMessage.call(ws, event);

      // Handle level2 messages for depth chart
      try {
        const message = JSON.parse(event.data);
        if (message.type === 'level2') {
          console.log('📊 DepthChart: Received level2 message with', message.data?.bids?.length, 'bids and', message.data?.asks?.length, 'asks');
          handleLevel2Message(message.data);
        }
      } catch (error) {
        console.error('Error parsing level2 message:', error);
      }
    };

    return true; // Successfully connected
  }

  function handleLevel2Message(data: any) {
    if (data.type === 'snapshot') {
      // Initial orderbook snapshot
      orderbookStore.processSnapshot(data);
      updateChart();
    } else if (data.type === 'update') {
      // Incremental update
      orderbookStore.processUpdate(data);
      updateChart();
    }
  }

  function updateChart() {
    if (!bidSeries || !askSeries) return;

    // Get depth data from store (more levels = smoother walls, less fluctuation)
    const { bids, asks } = orderbookStore.getDepthData(150);

    if (bids.length === 0 || asks.length === 0) {
      console.warn('⚠️ No depth data available yet');
      return;
    }

    // Convert to LightweightCharts format
    // Note: We use price as the "time" axis for depth chart
    const bidData = bids.map(level => ({
      time: level.price as any,  // Use price as x-axis
      value: level.depth
    }));

    const askData = asks.map(level => ({
      time: level.price as any,  // Use price as x-axis
      value: level.depth
    }));

    // Add gap in the middle - add extra price points between highest bid and lowest ask
    if (bids.length > 0 && asks.length > 0) {
      const highestBidPrice = bids[bids.length - 1].price;
      const lowestAskPrice = asks[0].price;
      const gapSize = (lowestAskPrice - highestBidPrice) * 0.2; // 20% of spread as padding

      // Add padding point to bid data (drops to 0 at edge)
      bidData.push({
        time: (highestBidPrice + gapSize) as any,
        value: 0
      });

      // Add padding point to ask data (drops to 0 at edge)
      askData.unshift({
        time: (lowestAskPrice - gapSize) as any,
        value: 0
      });
    }

    // Update chart series
    bidSeries.setData(bidData);
    askSeries.setData(askData);

    // Fit content to show both mountains
    chart.timeScale().fitContent();
  }

  onDestroy(() => {
    if (chart) {
      chart.remove();
    }
  });
</script>

<div class="panel depth-chart-panel">
  <div class="panel-header">
    <h2>Order Book Depth</h2>
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
    <div bind:this={chartContainer} class="depth-chart"></div>

  <!-- Orderbook List -->
  <div class="orderbook-list">
    <div class="orderbook-side bids">
      <div class="orderbook-header">
        <span>Quantity</span>
        <span>Buy Price</span>
      </div>
      <div class="orderbook-rows">
        {#each bids as bid}
          <div class="orderbook-row bid-row" style="--volume-width: {(bid.size / maxBidSize * 100)}%">
            <div class="volume-bar bid-bar"></div>
            <span class="quantity">{bid.size.toFixed(5)}</span>
            <span class="price">{Math.floor(bid.price).toLocaleString('en-US')}</span>
          </div>
        {/each}
      </div>
    </div>

    <div class="orderbook-side asks">
      <div class="orderbook-header">
        <span>Sell Price</span>
        <span>Quantity</span>
      </div>
      <div class="orderbook-rows">
        {#each asks as ask}
          <div class="orderbook-row ask-row" style="--volume-width: {(ask.size / maxAskSize * 100)}%">
            <div class="volume-bar ask-bar"></div>
            <span class="price">{Math.floor(ask.price).toLocaleString('en-US')}</span>
            <span class="quantity">{ask.size.toFixed(5)}</span>
          </div>
        {/each}
      </div>
    </div>
  </div>
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

  .panel-content {
    padding: 15px 0px 15px 15px; /* No padding on right side */
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
    overflow: hidden; /* Prevent chart from extending beyond container */
  }

  /* Make table row relative for absolute positioning */
  .depth-chart :global(.tv-lightweight-charts tr) {
    position: relative;
  }

  /* First TD - price scale - position absolute to overlay on chart */
  .depth-chart :global(.tv-lightweight-charts tr > td:first-child) {
    position: absolute !important;
    left: 0 !important;
    top: 0 !important;
    z-index: 10 !important;
    pointer-events: none !important;
  }

  /* Hide the grey background canvas of price scale */
  .depth-chart :global(.tv-lightweight-charts tr > td:first-child canvas[style*="z-index: 1"]) {
    opacity: 0 !important;
  }

  /* Second TD - main chart - shift left to center the wider chart */
  .depth-chart :global(.tv-lightweight-charts tr > td:nth-child(2)) {
    position: relative !important;
    left: -10px !important;
  }

  /* Hide TradingView watermark - aggressive approach */
  .depth-chart :global(.tv-lightweight-charts) :global([class*="watermark"]) {
    display: none !important;
    visibility: hidden !important;
    opacity: 0 !important;
  }

  .depth-chart :global(canvas + div) {
    display: none !important;
    visibility: hidden !important;
    opacity: 0 !important;
  }

  /* Hide any SVG watermarks */
  .depth-chart :global(svg) {
    display: none !important;
  }

  /* Hide divs after canvas that might contain watermarks */
  .depth-chart :global(div[style*="position"]) {
    background-image: none !important;
  }

  /* Orderbook List */
  .orderbook-list {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    padding: 10px 5px;
    background: rgba(74, 0, 224, 0.05);
    border: 1px solid rgba(74, 0, 224, 0.2);
    border-radius: 6px;
    margin: 0 5px 0 5px; /* Narrow by 5px on each side */
  }

  .orderbook-side {
    display: flex;
    flex-direction: column;
  }

  .orderbook-header {
    display: flex;
    justify-content: space-between;
    padding: 6px 8px;
    font-size: 11px;
    font-weight: 600;
    color: #c4b5fd;
    border-bottom: 1px solid rgba(74, 0, 224, 0.3);
    margin-bottom: 6px;
  }

  .orderbook-rows {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .orderbook-row {
    display: flex;
    justify-content: space-between;
    padding: 3px 8px;
    font-size: 11px;
    font-family: 'Monaco', 'Courier New', monospace;
    position: relative;
    border-radius: 3px;
  }

  /* Volume bars behind text */
  .volume-bar {
    position: absolute;
    top: 0;
    bottom: 0;
    width: var(--volume-width);
    z-index: 0;
    opacity: 0.3;
  }

  .bid-bar {
    right: 0;
    background: rgba(38, 166, 154, 0.8);
  }

  .ask-bar {
    left: 0;
    background: rgba(239, 83, 80, 0.8);
  }

  .bid-row {
    background: rgba(38, 166, 154, 0.1);
  }

  .bid-row .price {
    color: rgba(38, 166, 154, 1);
    font-weight: 600;
    position: relative;
    z-index: 1;
  }

  .bid-row .quantity {
    position: relative;
    z-index: 1;
  }

  .ask-row {
    background: rgba(239, 83, 80, 0.1);
  }

  .ask-row .price {
    color: rgba(239, 83, 80, 1);
    font-weight: 600;
    position: relative;
    z-index: 1;
  }

  .ask-row .quantity {
    position: relative;
    z-index: 1;
  }

  .orderbook-row .quantity {
    color: #9ca3af;
  }

  /* Responsive */
  @media (max-width: 768px) {
    .panel-content {
      padding: 10px;
    }

    .depth-chart {
      height: 250px;
    }

    .orderbook-list {
      grid-template-columns: 1fr;
    }
  }
</style>
