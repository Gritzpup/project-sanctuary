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
  let bids = $derived(orderbookStore.getBids(12));
  let asks = $derived(orderbookStore.getAsks(12));
  let maxBidSize = $derived(Math.max(...bids.map(b => b.size), 0.001));
  let maxAskSize = $derived(Math.max(...asks.map(a => a.size), 0.001));

  // Calculate price range for custom gauge labels
  let priceRange = $derived(() => {
    if (bids.length === 0 || asks.length === 0) return [];
    const minPrice = Math.min(...bids.map(b => b.price));
    const maxPrice = Math.max(...asks.map(a => a.price));
    const range = maxPrice - minPrice;
    const step = range / 5; // 5 labels
    return Array.from({length: 6}, (_, i) => minPrice + (step * i));
  });

  function formatPrice(price: number): string {
    if (price >= 1000000) return `$${(price / 1000000).toFixed(1)}M`;
    if (price >= 1000) return `$${Math.round(price / 1000)}k`;
    return `$${price.toFixed(0)}`;
  }

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
      width: chartContainer.clientWidth + 30, // Add 30px to stretch chart to match orderbook width
      height: chartContainer.clientHeight || 230,
      timeScale: {
        visible: true, // Show volume scale on bottom
        borderVisible: false,
        timeVisible: false,
        secondsVisible: false,
      },
      leftPriceScale: {
        visible: false, // Disable built-in price scale - we'll create our own overlay
      },
      localization: {
        // Custom price formatter to show abbreviated values like "99k"
        priceFormatter: (price: number) => {
          if (price >= 1000000) {
            return `$${(price / 1000000).toFixed(1)}M`;
          } else if (price >= 1000) {
            return `$${Math.round(price / 1000)}k`;
          }
          return `$${price.toFixed(0)}`;
        },
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
          width: chartContainer.clientWidth + 30, // Add 30px to stretch chart to match orderbook width
          height: chartContainer.clientHeight || 230,
        });
      }
    });
    resizeObserver.observe(chartContainer);

    // Cleanup
    return () => {
      resizeObserver.disconnect();
      // Clean up WebSocket event listener (don't close the WebSocket - it's shared!)
      if (ws && (ws as any).__depthChartHandler) {
        ws.removeEventListener('message', (ws as any).__depthChartHandler);
        delete (ws as any).__depthChartHandler;
      }
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

    // Use addEventListener instead of wrapping onmessage to avoid breaking the main chart
    const messageHandler = (event: MessageEvent) => {
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

    ws.addEventListener('message', messageHandler);

    // Store the handler for cleanup
    (ws as any).__depthChartHandler = messageHandler;

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
    // Clean up WebSocket event listener
    if (ws && (ws as any).__depthChartHandler) {
      ws.removeEventListener('message', (ws as any).__depthChartHandler);
      delete (ws as any).__depthChartHandler;
    }

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
    <div bind:this={chartContainer} class="depth-chart">
      <!-- Custom price gauge overlay -->
      <div class="price-gauge-overlay">
        {#each priceRange() as price, i}
          <div class="price-label" style="top: {(i / 5) * 100}%">
            {formatPrice(price)}
          </div>
        {/each}
      </div>
    </div>

  <!-- Orderbook List -->
  <div class="orderbook-list">
    <div class="orderbook-side bids">
      <div class="orderbook-header">
        <span>Quantity</span>
        <span>Buy Price</span>
      </div>
      <div class="orderbook-rows">
        {#each orderbookStore.getBids(12) as bid, i}
          <div class="orderbook-row bid-row" class:top-order={i === 0} style="--volume-width: {(bid.size / maxBidSize * 100)}%">
            <div class="volume-bar bid-bar"></div>
            <span class="quantity">{bid.size.toFixed(5)}</span>
            <span class="price">${Math.floor(bid.price).toLocaleString('en-US')}</span>
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
        {#each orderbookStore.getAsks(12) as ask, i}
          <div class="orderbook-row ask-row" class:top-order={i === 0} style="--volume-width: {(ask.size / maxAskSize * 100)}%">
            <div class="volume-bar ask-bar"></div>
            <span class="price">${Math.floor(ask.price).toLocaleString('en-US')}</span>
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
    max-width: 100%; /* Allow container to control width */
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
    padding: 15px; /* Restore padding */
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
    background: #1a1a1a; /* Fill background */
  }

  /* Remove internal chart padding */
  .depth-chart :global(.tv-lightweight-charts) {
    width: 100% !important;
    height: 100% !important;
  }

  /* Custom price gauge overlay */
  .price-gauge-overlay {
    position: absolute;
    left: 5px;
    top: 0;
    bottom: 0;
    width: 60px;
    pointer-events: none;
    z-index: 100;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }

  .price-label {
    position: absolute;
    left: 0;
    color: #ffffff;
    font-size: 11px;
    font-weight: 600;
    text-shadow:
      0 0 3px rgba(0, 0, 0, 1),
      0 0 5px rgba(0, 0, 0, 0.8),
      0 0 8px rgba(0, 0, 0, 0.6);
    transform: translateY(-50%);
  }

  /* Hide TradingView watermark - targeted approach */
  .depth-chart :global(.tv-lightweight-charts) :global([class*="watermark"]) {
    display: none !important;
    visibility: hidden !important;
    opacity: 0 !important;
  }

  /* Hide watermark div specifically (usually has cursor: pointer) */
  .depth-chart :global(.tv-lightweight-charts div[style*="cursor: pointer"]) {
    display: none !important;
    visibility: hidden !important;
    opacity: 0 !important;
  }

  /* Hide watermark SVG */
  .depth-chart :global(.tv-lightweight-charts svg) {
    display: none !important;
  }

  /* Hide watermark by position (usually bottom-right corner) */
  .depth-chart :global(.tv-lightweight-charts div[style*="position: absolute"][style*="right"][style*="bottom"]) {
    display: none !important;
  }

  /* Remove background images that might be watermarks */
  .depth-chart :global(div[style*="background-image"]) {
    background-image: none !important;
  }

  /* Orderbook List */
  .orderbook-list {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    padding: 10px;
    background: rgba(74, 0, 224, 0.05);
    border: 1px solid rgba(74, 0, 224, 0.2);
    border-radius: 6px;
    margin: 0; /* No margin - fill container width */
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
    font-size: 10px;
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

  /* Highlight top orders (best bid/ask) */
  .top-order {
    font-size: 13px !important;
    padding: 4px 8px !important;
  }

  .top-order .price {
    font-weight: 700 !important;
  }

  .top-order .quantity {
    color: #ffffff !important;
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
