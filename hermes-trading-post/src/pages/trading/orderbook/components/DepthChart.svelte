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

  // Hover tracking
  let mouseX = $state(0);
  let mouseY = $state(0);
  let isHovering = $state(false);
  let hoverPrice = $state(0);
  let hoverVolume = $state(0);

  // L2 Data flow status indicator
  let l2Status = $state({
    state: 'disconnected', // 'disconnected', 'waiting', 'active', 'error'
    label: 'Connecting',
    message: 'Connecting to L2 data stream...',
    lastUpdate: 0,
    updatesPerSecond: 0
  });

  // Track L2 data flow
  let lastL2UpdateTime = 0;
  let l2UpdateCount = 0;
  let l2UpdateTimer: NodeJS.Timeout | null = null;

  // Monitor L2 data flow status
  function updateL2Status() {
    const now = Date.now();
    const timeSinceUpdate = now - lastL2UpdateTime;
    const metrics = orderbookStore.metrics;

    // Determine status based on update frequency and timing
    if (!orderbookStore.isReady) {
      l2Status = {
        state: 'waiting',
        label: 'Waiting',
        message: 'Waiting for orderbook data...',
        lastUpdate: lastL2UpdateTime,
        updatesPerSecond: 0
      };
    } else if (timeSinceUpdate > 2000) {
      // No updates for 2 seconds
      l2Status = {
        state: 'error',
        label: 'No Data',
        message: `No updates for ${(timeSinceUpdate / 1000).toFixed(1)}s`,
        lastUpdate: lastL2UpdateTime,
        updatesPerSecond: 0
      };
    } else if (metrics.updatesPerSecond >= 20) {
      // High frequency = WebSocket
      l2Status = {
        state: 'active',
        label: `WebSocket (${metrics.updatesPerSecond}/s)`,
        message: `Real-time WebSocket: ${metrics.updatesPerSecond} updates/sec, ${metrics.avgLatency.toFixed(0)}ms latency`,
        lastUpdate: lastL2UpdateTime,
        updatesPerSecond: metrics.updatesPerSecond
      };
    } else if (metrics.updatesPerSecond >= 8 && metrics.updatesPerSecond <= 12) {
      // ~10/s = Polling
      l2Status = {
        state: 'waiting',
        label: `Polling (${metrics.updatesPerSecond}/s)`,
        message: `Using polling fallback: ${metrics.updatesPerSecond} updates/sec, ${metrics.avgLatency.toFixed(0)}ms latency`,
        lastUpdate: lastL2UpdateTime,
        updatesPerSecond: metrics.updatesPerSecond
      };
    } else if (metrics.updatesPerSecond > 0) {
      // Some updates
      l2Status = {
        state: 'active',
        label: `Active (${metrics.updatesPerSecond}/s)`,
        message: `Receiving updates: ${metrics.updatesPerSecond} updates/sec`,
        lastUpdate: lastL2UpdateTime,
        updatesPerSecond: metrics.updatesPerSecond
      };
    }
  }

  // Start monitoring L2 status
  $effect(() => {
    if (!l2UpdateTimer) {
      l2UpdateTimer = setInterval(updateL2Status, 500);
    }

    return () => {
      if (l2UpdateTimer) {
        clearInterval(l2UpdateTimer);
        l2UpdateTimer = null;
      }
    };
  });

  // Use reactive getters for smooth updates
  let bidsWithCumulative = $derived.by(() => {
    const bids = orderbookStore.getBids(12);
    let cumulative = 0;
    return bids.map((bid, index) => {
      cumulative += bid.size;
      return {
        price: bid.price,
        size: bid.size,
        cumulative,
        key: `bid-${index}` // Use index as stable key to prevent re-renders
      };
    });
  });

  let asksWithCumulative = $derived.by(() => {
    const asks = orderbookStore.getAsks(12);
    let cumulative = 0;
    return asks.map((ask, index) => {
      cumulative += ask.size;
      return {
        price: ask.price,
        size: ask.size,
        cumulative,
        key: `ask-${index}` // Use index as stable key to prevent re-renders
      };
    });
  });

  // Reactive derived values for volume bar widths
  let maxBidSize = $derived.by(() => {
    return bidsWithCumulative.length > 0
      ? Math.max(...bidsWithCumulative.map(b => b.size), 0.001)
      : 0.001;
  });

  let maxAskSize = $derived.by(() => {
    return asksWithCumulative.length > 0
      ? Math.max(...asksWithCumulative.map(a => a.size), 0.001)
      : 0.001;
  });

  let volumeRange = $derived.by(() => {
    const depthData = orderbookStore.getDepthData(10000);
    if (depthData.bids.length > 0 && depthData.asks.length > 0) {
      const maxBidDepth = depthData.bids[depthData.bids.length - 1]?.depth || 0;
      const maxAskDepth = depthData.asks[depthData.asks.length - 1]?.depth || 0;
      const maxDepth = Math.max(maxBidDepth, maxAskDepth);

      return Array.from({length: 4}, (_, i) => ({
        position: (i + 1) * 25,
        value: (maxDepth / 4) * (i + 1)
      }));
    }
    return [];
  });

  let priceRange = $derived.by(() => {
    const summary = orderbookStore.summary;
    if (summary.bestBid && summary.bestAsk) {
      const midPrice = (summary.bestBid + summary.bestAsk) / 2;
      return {
        left: midPrice - 10000,
        center: midPrice,
        right: midPrice + 10000
      };
    }
    return { left: 0, center: 0, right: 0 };
  });

  // Find the point of highest volume accumulation closest to current price
  let volumeHotspot = $derived.by(() => {
    const summary = orderbookStore.summary;
    if (!summary.bestBid || !summary.bestAsk) {
      return {
        offset: 50,
        price: 0,
        side: 'neutral',
        volume: 0
      };
    }

    const midPrice = (summary.bestBid + summary.bestAsk) / 2;

    // Get depth data for analysis
    const depthData = orderbookStore.getDepthData(100);

    // Find the highest volume point within reasonable range of current price
    let maxBidVolume = 0;
    let maxBidPrice = summary.bestBid;
    let maxBidIndex = -1;

    // Check bids (sorted by price descending, so closest to spread is first)
    depthData.bids.forEach((bid, index) => {
      // Only consider bids within 2% of current price
      if (bid.price > midPrice * 0.98 && bid.depth > maxBidVolume) {
        maxBidVolume = bid.depth;
        maxBidPrice = bid.price;
        maxBidIndex = index;
      }
    });

    let maxAskVolume = 0;
    let maxAskPrice = summary.bestAsk;
    let maxAskIndex = -1;

    // Check asks (sorted by price ascending, so closest to spread is first)
    depthData.asks.forEach((ask, index) => {
      // Only consider asks within 2% of current price
      if (ask.price < midPrice * 1.02 && ask.depth > maxAskVolume) {
        maxAskVolume = ask.depth;
        maxAskPrice = ask.price;
        maxAskIndex = index;
      }
    });

    // Determine which side has stronger support/resistance
    const strongerSide = maxBidVolume > maxAskVolume ? 'bid' : 'ask';
    const strongerPrice = strongerSide === 'bid' ? maxBidPrice : maxAskPrice;
    const strongerVolume = strongerSide === 'bid' ? maxBidVolume : maxAskVolume;

    // Calculate position on chart (assuming 20k range centered on midPrice)
    const rangeStart = midPrice - 10000;
    const rangeEnd = midPrice + 10000;
    const positionInRange = (strongerPrice - rangeStart) / (rangeEnd - rangeStart);
    const offset = Math.max(10, Math.min(90, positionInRange * 100));

    return {
      offset,
      price: strongerPrice,
      side: strongerSide === 'bid' ? 'bullish' : 'bearish',
      volume: strongerVolume,
      type: strongerSide === 'bid' ? 'Support' : 'Resistance'
    };
  });

  function formatPrice(price: number): string {
    if (price >= 1000000) return `$${(price / 1000000).toFixed(1)}M`;
    if (price >= 1000) return `$${Math.floor(price / 1000)}k`;
    return `$${price.toFixed(0)}`;
  }

  function formatVolume(volume: number): string {
    if (volume >= 1000) return `${(volume / 1000).toFixed(1)}k`;
    return volume.toFixed(1);
  }

  // Handle mouse movement for fallback hover tracking
  function handleMouseMove(event: MouseEvent) {
    // This is a fallback - primary tracking is done via crosshair subscription
    if (!isHovering && chartContainer) {
      const rect = chartContainer.getBoundingClientRect();
      mouseX = event.clientX - rect.left;
      mouseY = event.clientY - rect.top;
    }
  }

  function handleMouseLeave() {
    isHovering = false;
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
      width: chartContainer.clientWidth,
      height: (chartContainer.clientHeight || 230) - 5, // Reduce height by 5px to lift bottom
      timeScale: {
        visible: false, // Hide built-in time scale - we'll use custom overlay
        borderVisible: false,
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
            return `$${Math.floor(price / 1000)}k`;
          }
          return `$${price.toFixed(0)}`;
        },
      },
      rightPriceScale: {
        visible: false,
      },
      crosshair: {
        mode: 1, // Magnet mode for better tracking
        vertLine: {
          labelVisible: false, // We'll use our custom label
          color: 'rgba(255, 255, 255, 0.3)',
          width: 1,
          style: 2, // Dashed
        },
        horzLine: {
          labelVisible: false, // We'll use our custom label
          color: 'rgba(255, 255, 255, 0.3)',
          width: 1,
          style: 2, // Dashed
        },
      },
      watermark: {
        visible: false, // Hide TradingView watermark
      },
    });

    // Create bid series (green mountain on left) with smooth animations
    bidSeries = chart.addAreaSeries({
      topColor: 'rgba(38, 166, 154, 0.4)',
      bottomColor: 'rgba(38, 166, 154, 0.0)',
      lineColor: 'rgba(38, 166, 154, 1)',
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false, // Remove price tag
      priceScaleId: 'left',
      crosshairMarkerVisible: false, // Reduce visual noise
      lineStyle: 0, // Solid line
      lineType: 2, // Curved line for smoother appearance
    });

    // Create ask series (red mountain on right) with smooth animations
    askSeries = chart.addAreaSeries({
      topColor: 'rgba(239, 83, 80, 0.4)',
      bottomColor: 'rgba(239, 83, 80, 0.0)',
      lineColor: 'rgba(239, 83, 80, 1)',
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false, // Remove price tag
      priceScaleId: 'left',
      crosshairMarkerVisible: false, // Reduce visual noise
      lineStyle: 0, // Solid line
      lineType: 2, // Curved line for smoother appearance
    });

    // Subscribe to crosshair movement for custom hover display
    chart.subscribeCrosshairMove((param) => {
      if (!param || param.point === undefined) {
        isHovering = false;
        return;
      }

      const { x, y } = param.point;
      mouseX = x;
      mouseY = y;

      // Get price from the crosshair parameter
      if (param.time !== undefined) {
        hoverPrice = param.time as number; // In depth chart, time axis is price

        // Find the volume at this price
        const depthData = orderbookStore.getDepthData(500);
        let foundVolume = 0;

        // Check if it's in bids
        const bidPoint = depthData.bids.find(b => Math.abs(b.price - hoverPrice) < 50);
        if (bidPoint) {
          foundVolume = bidPoint.depth;
        } else {
          // Check asks
          const askPoint = depthData.asks.find(a => Math.abs(a.price - hoverPrice) < 50);
          if (askPoint) {
            foundVolume = askPoint.depth;
          }
        }

        hoverVolume = foundVolume;
        isHovering = true;
      }
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
        const newWidth = chartContainer.clientWidth;
        const newHeight = (chartContainer.clientHeight || 230) - 5;

        chart.applyOptions({
          width: newWidth,
          height: newHeight,
        });

        // Re-fit the visible range after resize to maintain proper view
        const summary = orderbookStore.summary;
        if (summary.bestBid && summary.bestAsk) {
          const midPrice = (summary.bestBid + summary.bestAsk) / 2;
          chart.timeScale().setVisibleRange({
            from: (midPrice - 10000) as any,
            to: (midPrice + 10000) as any
          });
        }
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

    // Silent connection - no console spam
    // Use addEventListener instead of wrapping onmessage to avoid breaking the main chart
    const messageHandler = (event: MessageEvent) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === 'level2') {
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

  let updatePending = false;

  function handleLevel2Message(data: any) {
    // Track that we received an update
    lastL2UpdateTime = Date.now();
    l2UpdateCount++;

    if (data.type === 'snapshot') {
      // Initial orderbook snapshot
      orderbookStore.processSnapshot(data);
      // Update chart immediately without requestAnimationFrame for snapshots
      updateChart();
    } else if (data.type === 'update') {
      // Incremental update
      orderbookStore.processUpdate(data);
      // Batch chart updates using requestAnimationFrame only if not already pending
      if (!updatePending) {
        updatePending = true;
        requestAnimationFrame(() => {
          updateChart();
          updatePending = false;
        });
      }
    }
  }

  // Cache to reduce unnecessary chart updates
  let lastBidCount = 0;
  let lastAskCount = 0;
  let chartUpdateCount = 0;

  function updateChart() {
    if (!bidSeries || !askSeries) return;

    // Get depth data from store (use reasonable number of levels for performance)
    // 500 levels is enough to show immediate depth while maintaining performance
    const { bids, asks } = orderbookStore.getDepthData(500);

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

    // Only update chart if data actually changed (check length and edge values)
    const bidsChanged = bids.length !== lastBidCount ||
                       (bids.length > 0 && (bids[0].depth !== bidData[0]?.value));
    const asksChanged = asks.length !== lastAskCount ||
                       (asks.length > 0 && (asks[0].depth !== askData[0]?.value));

    if (bidsChanged || asksChanged) {
      chartUpdateCount++;

      // Log every 20th update to track performance
      if (chartUpdateCount % 20 === 0) {
        console.log(`📈 Chart update #${chartUpdateCount} - Bids: ${bids.length}, Asks: ${asks.length}`);
      }

      // For depth charts, always use setData since prices can change dramatically
      // The chart library doesn't support updating with out-of-order prices
      bidSeries.setData(bidData);
      askSeries.setData(askData);

      lastBidCount = bids.length;
      lastAskCount = asks.length;
    }

    // Always keep chart centered on the spread with consistent range
    try {
      const summary = orderbookStore.summary;
      if (summary.bestBid && summary.bestAsk) {
        const midPrice = (summary.bestBid + summary.bestAsk) / 2;

        // Always show 20k range centered on spread
        chart.timeScale().setVisibleRange({
          from: (midPrice - 10000) as any,
          to: (midPrice + 10000) as any
        });
      }
    } catch (e) {
      // If setting range fails, try to fit content
      try {
        chart.timeScale().fitContent();
      } catch (e2) {
        // Ignore if chart not ready
      }
    }
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
    <div class="header-left">
      <h2>Order Book Depth</h2>
      <!-- L2 Data Flow Traffic Light -->
      <div class="l2-status-indicator" title="L2 Data Status: {l2Status.message}">
        <div class="traffic-light traffic-light-{l2Status.state}"></div>
        <span class="status-text">{l2Status.label}</span>
      </div>
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
      on:mousemove={handleMouseMove}
      on:mouseleave={handleMouseLeave}
      role="img"
      aria-label="Orderbook depth chart"
    >
      <!-- Mid price indicator line (shows balance of power) -->
      <div class="mid-price-line"></div>

      <!-- Dynamic volume hotspot indicator -->
      <div class="valley-indicator valley-{volumeHotspot.side}" style="left: {volumeHotspot.offset}%">
        <div class="valley-price-label">
          <span class="price-type">{volumeHotspot.type}</span>
          <span class="price-value">${Math.floor(volumeHotspot.price).toLocaleString('en-US')}</span>
          <span class="volume-value">{volumeHotspot.volume.toFixed(2)} BTC</span>
        </div>
        <div class="valley-point"></div>
        <div class="valley-line"></div>
      </div>

      <!-- Hover overlay -->
      {#if isHovering}
        <div class="hover-overlay" style="left: {mouseX}px">
          <div class="hover-line"></div>
          <div class="hover-circle" style="top: {mouseY}px"></div>
          <div class="hover-price-label">
            <span class="hover-price">${Math.floor(hoverPrice).toLocaleString('en-US')}</span>
            {#if hoverVolume > 0}
              <span class="hover-volume">{hoverVolume.toFixed(3)} BTC</span>
            {/if}
          </div>
        </div>
      {/if}

      <!-- Custom volume gauge overlay (left side) - linear scale -->
      <div class="volume-gauge-overlay">
        {#each volumeRange as item}
          <div class="volume-label" style="top: {100 - item.position}%">
            {formatVolume(item.value)}
          </div>
        {/each}
      </div>

      <!-- Custom price gauge overlay (bottom) - 3 prices spanning 20k -->
      <div class="price-gauge-overlay">
        <!-- Left price -->
        <div class="price-label" style="left: 10%">
          {formatPrice(priceRange.left)}
        </div>

        <!-- Center price -->
        <div class="price-label price-label-center" style="left: 50%">
          {formatPrice(priceRange.center)}
        </div>

        <!-- Right price -->
        <div class="price-label" style="left: 90%">
          {formatPrice(priceRange.right)}
        </div>
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
        {#each bidsWithCumulative as bid, i (bid.key)}
          <div class="orderbook-row bid-row"
               class:top-order={i === 0}
               style="--volume-width: {(bid.size / maxBidSize * 100)}%"
               data-price={bid.price}>
            <div class="volume-bar bid-bar"></div>
            <span class="quantity">{bid.cumulative.toFixed(5)}</span>
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
        {#each asksWithCumulative as ask, i (ask.key)}
          <div class="orderbook-row ask-row"
               class:top-order={i === 0}
               style="--volume-width: {(ask.size / maxAskSize * 100)}%"
               data-price={ask.price}>
            <div class="volume-bar ask-bar"></div>
            <span class="price">${Math.floor(ask.price).toLocaleString('en-US')}</span>
            <span class="quantity">{ask.cumulative.toFixed(5)}</span>
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

  .header-left {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  /* L2 Status Traffic Light */
  .l2-status-indicator {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 8px;
    background: rgba(0, 0, 0, 0.3);
    border-radius: 4px;
    border: 1px solid rgba(74, 0, 224, 0.2);
  }

  .traffic-light {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    border: 2px solid rgba(255, 255, 255, 0.2);
    transition: all 0.3s ease;
  }

  .traffic-light-disconnected {
    background: #666;
    box-shadow: none;
  }

  .traffic-light-waiting {
    background: #ffa500;
    animation: pulse-slow 2s ease-in-out infinite;
    box-shadow: 0 0 8px rgba(255, 165, 0, 0.6);
  }

  .traffic-light-active {
    background: #4caf50;
    animation: pulse-fast 0.5s ease-in-out infinite;
    box-shadow: 0 0 12px rgba(76, 175, 80, 0.8);
  }

  .traffic-light-error {
    background: #f44336;
    animation: pulse-slow 3s ease-in-out infinite;
    box-shadow: 0 0 8px rgba(244, 67, 54, 0.6);
  }

  @keyframes pulse-slow {
    0%, 100% {
      opacity: 1;
      transform: scale(1);
    }
    50% {
      opacity: 0.6;
      transform: scale(1.1);
    }
  }

  @keyframes pulse-fast {
    0%, 100% {
      opacity: 1;
      transform: scale(1);
    }
    50% {
      opacity: 0.8;
      transform: scale(1.15);
    }
  }

  .status-text {
    font-size: 11px;
    color: #c4b5fd;
    font-weight: 500;
    white-space: nowrap;
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

  /* Mid-price vertical line (balance of power indicator) */
  .mid-price-line {
    position: absolute;
    left: 50%;
    top: 0;
    bottom: 0;
    width: 2px;
    background: rgba(255, 255, 255, 0.1);
    transform: translateX(-50%);
    pointer-events: none;
    z-index: 99;
  }

  /* Hover overlay */
  .hover-overlay {
    position: absolute;
    top: 0;
    bottom: 0;
    pointer-events: none;
    z-index: 102;
    transform: translateX(-1px);
  }

  .hover-line {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 1px;
    background: rgba(255, 255, 255, 0.5);
    box-shadow: 0 0 4px rgba(255, 255, 255, 0.3);
  }

  .hover-circle {
    position: absolute;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: white;
    border: 2px solid #a78bfa;
    transform: translate(-50%, -50%);
    left: 0;
    box-shadow: 0 0 6px rgba(167, 139, 250, 0.8);
  }

  .hover-price-label {
    position: absolute;
    top: 10px;
    left: 10px;
    background: rgba(0, 0, 0, 0.9);
    border: 1px solid rgba(167, 139, 250, 0.5);
    border-radius: 4px;
    padding: 4px 8px;
    display: flex;
    flex-direction: column;
    gap: 2px;
    font-size: 11px;
    white-space: nowrap;
    color: white;
  }

  .hover-price {
    font-weight: 700;
    font-size: 12px;
    color: #a78bfa;
  }

  .hover-volume {
    font-size: 10px;
    opacity: 0.8;
  }

  /* Dynamic valley indicator that moves with price */
  .valley-indicator {
    position: absolute;
    bottom: 0;
    height: 100%;
    transform: translateX(-50%);
    transition: left 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94);
    pointer-events: none;
    z-index: 100;
  }

  .valley-price-label {
    position: absolute;
    top: 20px;  /* Changed from bottom to top positioning */
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0, 0, 0, 0.9);
    border: 1px solid currentColor;
    border-radius: 6px;
    padding: 6px 10px;
    display: flex;
    flex-direction: column;
    align-items: center;
    font-size: 11px;
    white-space: nowrap;
    z-index: 101;
    pointer-events: none;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
  }

  .valley-price-label .price-type {
    font-size: 9px;
    opacity: 0.8;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 2px;
  }

  .valley-price-label .price-value {
    font-weight: 700;
    font-size: 12px;
    margin-bottom: 2px;
  }

  .valley-price-label .volume-value {
    font-size: 10px;
    opacity: 0.9;
  }

  .valley-point {
    position: absolute;
    bottom: 8px;
    left: 50%;
    transform: translateX(-50%);
    width: 0;
    height: 0;
    border-left: 8px solid transparent;
    border-right: 8px solid transparent;
    border-top: 12px solid #a78bfa;
    filter: drop-shadow(0 0 6px rgba(167, 139, 250, 1));
    animation: valleyPulse 2s ease-in-out infinite;
  }

  .valley-line {
    position: absolute;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    width: 2px;
    height: calc(100% - 25px);
    background: linear-gradient(180deg,
      transparent 0%,
      rgba(167, 139, 250, 0.2) 30%,
      rgba(167, 139, 250, 0.5) 100%
    );
  }

  @keyframes valleyPulse {
    0%, 100% {
      opacity: 0.7;
      transform: translateX(-50%) translateY(0);
    }
    50% {
      opacity: 1;
      transform: translateX(-50%) translateY(-3px);
    }
  }

  /* Volume hotspot color variations */
  .valley-bullish .valley-point {
    border-top-color: #26a69a;
    filter: drop-shadow(0 0 6px rgba(38, 166, 154, 1));
  }

  .valley-bullish .valley-line {
    background: linear-gradient(180deg,
      transparent 0%,
      rgba(38, 166, 154, 0.2) 30%,
      rgba(38, 166, 154, 0.5) 100%
    );
  }

  .valley-bullish .valley-price-label {
    color: #26a69a;
    border-color: rgba(38, 166, 154, 0.5);
    background: rgba(0, 0, 0, 0.95);
  }

  .valley-bearish .valley-point {
    border-top-color: #ef5350;
    filter: drop-shadow(0 0 6px rgba(239, 83, 80, 1));
  }

  .valley-bearish .valley-line {
    background: linear-gradient(180deg,
      transparent 0%,
      rgba(239, 83, 80, 0.2) 30%,
      rgba(239, 83, 80, 0.5) 100%
    );
  }

  .valley-bearish .valley-price-label {
    color: #ef5350;
    border-color: rgba(239, 83, 80, 0.5);
    background: rgba(0, 0, 0, 0.95);
  }

  .valley-neutral .valley-point {
    border-top-color: #a78bfa;
    filter: drop-shadow(0 0 6px rgba(167, 139, 250, 1));
  }

  .valley-neutral .valley-line {
    background: linear-gradient(180deg,
      transparent 0%,
      rgba(167, 139, 250, 0.2) 30%,
      rgba(167, 139, 250, 0.5) 100%
    );
  }

  .valley-neutral .valley-price-label {
    color: #a78bfa;
    border-color: rgba(167, 139, 250, 0.5);
    background: rgba(0, 0, 0, 0.95);
  }

  /* Custom volume gauge overlay (left side) */
  .volume-gauge-overlay {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 60px;
    pointer-events: none;
    z-index: 100;
    display: flex;
    flex-direction: column;
  }

  .volume-label {
    position: absolute;
    left: 0;
    color: #ffffff;
    font-size: 10px;
    font-weight: 600;
    text-shadow:
      0 0 3px rgba(0, 0, 0, 1),
      0 0 5px rgba(0, 0, 0, 0.8),
      0 0 8px rgba(0, 0, 0, 0.6);
    transform: translateY(-50%);
    line-height: 1;
    /* Smooth transitions for position and opacity */
    transition: top 0.2s cubic-bezier(0.4, 0, 0.2, 1),
                opacity 0.2s ease-out;
  }

  .volume-label-center {
    color: rgba(255, 255, 255, 0.5);
    font-size: 9px;
  }

  /* Custom price gauge overlay (bottom) */
  .price-gauge-overlay {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: 15px;
    pointer-events: none;
    z-index: 100;
    display: flex;
    justify-content: space-between;
  }

  .price-label {
    position: absolute;
    bottom: 0;
    color: #ffffff;
    font-size: 11px;
    font-weight: 600;
    text-shadow:
      0 0 3px rgba(0, 0, 0, 1),
      0 0 5px rgba(0, 0, 0, 0.8),
      0 0 8px rgba(0, 0, 0, 0.6);
    transform: translateX(-50%);
    line-height: 1;
    /* Smooth transitions for price changes */
    transition: opacity 0.15s ease-out,
                color 0.15s ease-out;
  }

  .price-label-center {
    color: #a78bfa;
    font-weight: 700;
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
    /* Ultra-fast transitions with will-change for GPU acceleration */
    will-change: transform, opacity;
    transition: transform 0.15s cubic-bezier(0.25, 0.46, 0.45, 0.94),
                opacity 0.1s ease-out,
                background-color 0.1s ease-out;
    transform: translateY(0);
  }

  /* Stagger row animations for wave effect */
  .orderbook-rows {
    --stagger-delay: 0.02s;
  }

  .orderbook-row:nth-child(1) { animation-delay: calc(0 * var(--stagger-delay)); }
  .orderbook-row:nth-child(2) { animation-delay: calc(1 * var(--stagger-delay)); }
  .orderbook-row:nth-child(3) { animation-delay: calc(2 * var(--stagger-delay)); }
  .orderbook-row:nth-child(4) { animation-delay: calc(3 * var(--stagger-delay)); }
  .orderbook-row:nth-child(5) { animation-delay: calc(4 * var(--stagger-delay)); }
  .orderbook-row:nth-child(6) { animation-delay: calc(5 * var(--stagger-delay)); }
  .orderbook-row:nth-child(7) { animation-delay: calc(6 * var(--stagger-delay)); }
  .orderbook-row:nth-child(8) { animation-delay: calc(7 * var(--stagger-delay)); }
  .orderbook-row:nth-child(9) { animation-delay: calc(8 * var(--stagger-delay)); }
  .orderbook-row:nth-child(10) { animation-delay: calc(9 * var(--stagger-delay)); }
  .orderbook-row:nth-child(11) { animation-delay: calc(10 * var(--stagger-delay)); }
  .orderbook-row:nth-child(12) { animation-delay: calc(11 * var(--stagger-delay)); }

  /* Volume bars behind text with GPU acceleration */
  .volume-bar {
    position: absolute;
    top: 0;
    bottom: 0;
    width: var(--volume-width);
    z-index: 0;
    opacity: 0.15;  /* Reduced opacity so text is clearly visible */
    will-change: width;
    /* Ultra-fast width animation for real-time updates */
    transition: width 0.1s cubic-bezier(0.25, 0.46, 0.45, 0.94);
  }

  /* Fast text value transitions - numbers morphing effect */
  .orderbook-row .quantity,
  .orderbook-row .price {
    position: relative;
    z-index: 1;
    transition: all 0.1s ease-out;
    /* Prevent text selection during rapid updates */
    user-select: none;
  }

  /* Add subtle glow on value changes */
  @keyframes valueChange {
    0% { text-shadow: 0 0 0 transparent; }
    50% { text-shadow: 0 0 8px rgba(255, 255, 255, 0.3); }
    100% { text-shadow: 0 0 0 transparent; }
  }

  .bid-bar {
    right: 0;
    background: rgba(38, 166, 154, 0.6);  /* Reduced opacity for subtlety */
  }

  .ask-bar {
    left: 0;
    background: rgba(239, 83, 80, 0.6);  /* Reduced opacity for subtlety */
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
