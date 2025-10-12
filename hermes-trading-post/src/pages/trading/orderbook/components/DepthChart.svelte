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

  onMount(() => {
    // Initialize chart
    chart = createChart(chartContainer, {
      layout: {
        background: { type: ColorType.Solid, color: '#1a1a1a' },
        textColor: '#d1d4dc',
      },
      grid: {
        vertLines: { color: '#2b2b2b' },
        horzLines: { color: '#2b2b2b' },
      },
      width: chartContainer.clientWidth,
      height: chartContainer.clientHeight || 280,
      timeScale: {
        visible: false, // Depth chart doesn't use time
      },
      rightPriceScale: {
        visible: true,
        borderColor: '#2b2b2b',
      },
      crosshair: {
        vertLine: {
          labelVisible: true,
        },
        horzLine: {
          labelVisible: true,
        },
      },
    });

    // Create bid series (green mountain on left)
    bidSeries = chart.addAreaSeries({
      topColor: 'rgba(38, 166, 154, 0.4)',
      bottomColor: 'rgba(38, 166, 154, 0.0)',
      lineColor: 'rgba(38, 166, 154, 1)',
      lineWidth: 2,
      priceLineVisible: false,
    });

    // Create ask series (red mountain on right)
    askSeries = chart.addAreaSeries({
      topColor: 'rgba(239, 83, 80, 0.4)',
      bottomColor: 'rgba(239, 83, 80, 0.0)',
      lineColor: 'rgba(239, 83, 80, 1)',
      lineWidth: 2,
      priceLineVisible: false,
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
          width: chartContainer.clientWidth,
          height: chartContainer.clientHeight || 280,
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

    // Get depth data from store
    const { bids, asks } = orderbookStore.getDepthData(50);

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

<div class="depth-chart-container">
  <div class="depth-chart-header">
    <h3>Order Book Depth</h3>
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
  <div bind:this={chartContainer} class="depth-chart"></div>
</div>

<style>
  .depth-chart-container {
    width: 100%;
    background: var(--color-surface);
    border-radius: var(--border-radius);
    padding: var(--space-md);
    border: 1px solid var(--color-border);
  }

  .depth-chart-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--space-md);
  }

  .depth-chart-header h3 {
    font-size: var(--font-size-lg);
    font-weight: 600;
    color: var(--text-primary);
    margin: 0;
  }

  .depth-chart-legend {
    display: flex;
    gap: var(--space-md);
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: var(--space-xs);
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
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
    height: 300px;
    position: relative;
  }

  /* Responsive */
  @media (max-width: 768px) {
    .depth-chart-container {
      padding: var(--space-sm);
    }

    .depth-chart {
      height: 250px;
    }
  }
</style>
