<script lang="ts">
  /**
   * @file DepthChart.svelte
   * @description Modularized depth chart component (under 300 lines)
   * Uses extracted services for WebSocket, chart management, and state
   */
  import { onMount, onDestroy } from 'svelte';
  import { createChart, type IChartApi, type ISeriesApi } from 'lightweight-charts';
  import { orderbookStore } from '../stores/orderbookStore.svelte';
  import { dataStore } from '../../chart/stores/dataStore.svelte';
  import { FastNumberFormatter } from '../../../../utils/shared/Formatters';
  import { depthChartState } from '../services/DepthChartState.svelte';
  import { formatPrice, formatVolume } from './services/OrderBookCalculator';
  import { CHART_CONFIG, BID_SERIES_CONFIG, ASK_SERIES_CONFIG } from '../services/ChartConfig';
  import { calculateVolumeHotspot, calculateVolumeRange, calculatePriceRange } from '../services/VolumeHotspotCalculator';
  import '../styles/DepthChart.css';

  // Props
  let { children } = $props();

  let chartContainer: HTMLDivElement;
  let chart: IChartApi;
  let bidSeries: ISeriesApi<'Area'>;
  let askSeries: ISeriesApi<'Area'>;
  // WebSocket handled through dataStore instead of separate connection

  // Chart update throttling - reduce throttle for faster updates
  let lastChartUpdateTime = 0;
  let updatePending = false;
  let hasPendingData = false;
  const CHART_UPDATE_THROTTLE_MS = 16; // Update chart at 60fps for smooth, responsive updates

  // Local UI state
  let mouseX = $state(0);
  let mouseY = $state(0);
  let isHovering = $state(false);
  let hoverPrice = $state(0);
  let hoverVolume = $state(0);

  // Computed values with proper defaults
  let volumeHotspot = $state({
    bidVolume: 0,
    askVolume: 0,
    bidSupport: 0,
    askResistance: 0,
    volumeRatio: 0.5,
    price: 0,
    spread: 0,
    offset: 50,
    side: 'neutral' as const,
    type: 'Neutral',
    volume: 0
  });
  let volumeRange = $state<any[]>([]);
  let priceRange = $state({ left: 0, center: 0, right: 0 });
  let mutationObserver: MutationObserver | null = null;
  let wsCheckInterval: ReturnType<typeof setInterval> | null = null;

  // Update UI when store changes - must be at top level in Svelte 5
  $effect(() => {
    const _trigger = orderbookStore.versions;
    scheduleUIUpdate();
    scheduleChartUpdate(); // Also update the chart when data changes
  });

  onMount(async () => {
    console.log('[DepthChart] Component mounted v4');

    // Clear any stale data first
    orderbookStore.reset();

    // Hydrate orderbook from backend API for fresh data
    try {
      await orderbookStore.hydrateFromCache('BTC-USD');
      console.log('[DepthChart] Orderbook hydrated from backend');
    } catch (error) {
      console.error('Orderbook cache hydration failed, will use WebSocket data:', error);
    }

    initializeChart();
    setupWebSocket();
  });

  function initializeChart() {
    if (!chartContainer) {
      console.log('[DepthChart] Chart container not ready');
      return;
    }
    console.log('[DepthChart] Initializing chart...');

    chart = createChart(chartContainer, {
      width: chartContainer.clientWidth,
      height: 200,
      ...CHART_CONFIG
    });

    bidSeries = chart.addAreaSeries(BID_SERIES_CONFIG);
    askSeries = chart.addAreaSeries(ASK_SERIES_CONFIG);

    // Remove TradingView watermark aggressively
    const removeTradingViewWatermark = () => {
      const container = chartContainer.querySelector('.tv-lightweight-charts');
      if (container) {
        // Hide all absolute positioned elements in bottom corners
        container.querySelectorAll('div').forEach((div: HTMLElement) => {
          const style = window.getComputedStyle(div);
          const rect = div.getBoundingClientRect();
          const containerRect = container.getBoundingClientRect();

          // Check if element is in bottom-left corner (where watermark usually is)
          const isBottomLeft = rect.bottom >= containerRect.bottom - 50 &&
                               rect.left <= containerRect.left + 100;

          // Check for watermark characteristics
          const hasWatermarkStyle = style.position === 'absolute' ||
                                   style.cursor === 'pointer' ||
                                   div.querySelector('svg') ||
                                   div.querySelector('a') ||
                                   (div.textContent && div.textContent.toLowerCase().includes('trading'));

          if (isBottomLeft && hasWatermarkStyle) {
            div.style.display = 'none';
            div.style.visibility = 'hidden';
            div.style.opacity = '0';
            div.remove(); // Remove it entirely
          }
        });

        // Also target specific selectors
        const selectors = [
          'div[style*="cursor: pointer"]',
          'a[href*="tradingview"]',
          'div:last-child[style*="position: absolute"]',
          'div[style*="bottom"][style*="left"]'
        ];

        selectors.forEach(selector => {
          container.querySelectorAll(selector).forEach((el: HTMLElement) => {
            el.style.display = 'none';
            el.style.visibility = 'hidden';
            el.remove();
          });
        });
      }
    };

    // Run multiple times to catch any delayed rendering
    setTimeout(removeTradingViewWatermark, 100);
    setTimeout(removeTradingViewWatermark, 500);
    setTimeout(removeTradingViewWatermark, 1000);

    // Also use MutationObserver to catch any dynamically added watermarks
    mutationObserver = new MutationObserver(() => {
      removeTradingViewWatermark();
    });

    if (chartContainer) {
      mutationObserver.observe(chartContainer, {
        childList: true,
        subtree: true
      });
    }

    // Don't set initial range here - wait for data in scheduleChartUpdate
  }

  function setupWebSocket() {
    const ws = dataStore.getWebSocket();
    console.log('[DepthChart] WebSocket check:', {
      wsExists: !!ws,
      readyState: ws?.readyState,
      isOpen: ws?.readyState === WebSocket.OPEN
    });
    if (ws && ws.readyState === WebSocket.OPEN) {
      console.log('[DepthChart] Using existing dataStore WebSocket');
      attachWebSocketListener(ws);
      depthChartState.setConnected(true);

      // Request initial level2 snapshot
      ws.send(JSON.stringify({
        type: 'requestLevel2Snapshot',
        productId: 'BTC-USD'
      }));
    } else {
      console.log('[DepthChart] No WebSocket available from dataStore, will wait for it');
      depthChartState.setConnected(false);
      // Start watching for WebSocket availability
      watchWebSocketAvailability();
    }
  }

  function watchWebSocketAvailability() {
    wsCheckInterval = setInterval(() => {
      const ws = dataStore.getWebSocket();
      if (ws && ws.readyState === WebSocket.OPEN) {
        console.log('[DepthChart] WebSocket became available, attaching listener');
        if (wsCheckInterval) {
          clearInterval(wsCheckInterval);
          wsCheckInterval = null;
        }
        attachWebSocketListener(ws);
        depthChartState.setConnected(true);

        // Request initial orderbook snapshot from backend
        // Backend expects 'requestLevel2Snapshot' not 'subscribe'
        ws.send(JSON.stringify({
          type: 'requestLevel2Snapshot',
          productId: 'BTC-USD'
        }));
      }
    }, 500); // Check every 500ms
  }

  function attachWebSocketListener(ws: WebSocket) {
    const handler = (event: MessageEvent) => {
      try {
        const message = JSON.parse(event.data);

        // Handle level2 messages (from backend WebSocket)
        if (message.type === 'level2') {
          console.log('[DepthChart] Received level2 message with', message.data?.changes?.length || 0, 'changes');
          handleLevel2Message(message.data);
        } else if (message.type === 'orderbook-delta') {
          // Handle orderbook deltas from Redis Pub/Sub
          handleOrderbookDelta(message.data);
        } else if (message.type === 'orderbook_snapshot' || message.type === 'orderbook_update') {
          handleOrderbookUpdate(message);
        }
      } catch (err) {
        console.error('[DepthChart] WebSocket message error:', err);
      }
    };

    (ws as any).__depthChartHandler = handler;
    ws.addEventListener('message', handler);
  }

  function scheduleUIUpdate() {
    // Update UI immediately for responsive orderbook display
    requestAnimationFrame(() => {
      const summary = orderbookStore.summary;

      // Skip update if no data available
      if (!summary.bestBid || !summary.bestAsk) return;

      // Update price range
      const currentPrice = summary.bestBid && summary.bestAsk ?
        (summary.bestBid + summary.bestAsk) / 2 : 0;

      // Only consider prices within the visible range (±$25,000 from current price)
      const visibleMin = currentPrice - 25000;
      const visibleMax = currentPrice + 25000;

      // Get full orderbook data and filter to visible range
      const fullDepthData = orderbookStore.getDepthData(500);
      const depthData = {
        bids: fullDepthData.bids.filter(level => level.price >= visibleMin && level.price <= visibleMax),
        asks: fullDepthData.asks.filter(level => level.price >= visibleMin && level.price <= visibleMax)
      };

      priceRange = calculatePriceRange(currentPrice);
      volumeRange = calculateVolumeRange(depthData);

      // Find the LARGEST VOLUME WALL (cumulative depth) - not just individual level
      let maxCumulativeVolume = 0;
      let hotspotPrice = currentPrice;
      let hotspotSide = 'neutral' as const;

      // Track the steepest volume increases (walls) - these are support/resistance
      let maxVolumeIncrease = 0;

      // Check bids for support walls (look for big jumps in cumulative volume)
      for (let i = 0; i < depthData.bids.length; i++) {
        const bid = depthData.bids[i];
        // Skip if price is outside visible range
        if (bid.price < visibleMin || bid.price > visibleMax) continue;

        // Use cumulative depth (which is the 'depth' field from getDepthData)
        const volumeAtLevel = bid.depth || bid.size || 0;

        // For support, we want the price with highest cumulative volume on bid side
        // This represents the strongest buy wall
        if (volumeAtLevel > maxCumulativeVolume) {
          maxCumulativeVolume = volumeAtLevel;
          hotspotPrice = bid.price;
          hotspotSide = 'bullish';
          maxVolumeIncrease = volumeAtLevel;
        }
      }

      // Check asks for resistance walls
      for (let i = 0; i < depthData.asks.length; i++) {
        const ask = depthData.asks[i];
        // Skip if price is outside visible range
        if (ask.price < visibleMin || ask.price > visibleMax) continue;

        // Use cumulative depth (which is the 'depth' field from getDepthData)
        const volumeAtLevel = ask.depth || ask.size || 0;

        // For resistance, we want the price with highest cumulative volume on ask side
        // This represents the strongest sell wall
        if (volumeAtLevel > maxCumulativeVolume) {
          maxCumulativeVolume = volumeAtLevel;
          hotspotPrice = ask.price;
          hotspotSide = 'bearish';
          maxVolumeIncrease = volumeAtLevel;
        }
      }

      // If market is trending, prioritize the side with momentum
      // Higher bid volume = bullish momentum, track support
      // Higher ask volume = bearish momentum, track resistance
      const totalVolume = (summary.bidVolume || 0) + (summary.askVolume || 0);
      const volumeRatio = totalVolume > 0 ? (summary.bidVolume || 0) / totalVolume : 0.5;

      // If volume is heavily skewed, prioritize that side's walls
      if (volumeRatio > 0.6 && depthData.bids.length > 0) {
        // Bullish - focus on support walls
        const strongestSupport = depthData.bids.reduce((max, bid) =>
          bid.depth > max.depth ? bid : max, depthData.bids[0]);
        if (strongestSupport) {
          hotspotPrice = strongestSupport.price;
          hotspotSide = 'bullish';
          maxVolumeIncrease = strongestSupport.depth;
        }
      } else if (volumeRatio < 0.4 && depthData.asks.length > 0) {
        // Bearish - focus on resistance walls
        const strongestResistance = depthData.asks.reduce((max, ask) =>
          ask.depth > max.depth ? ask : max, depthData.asks[0]);
        if (strongestResistance) {
          hotspotPrice = strongestResistance.price;
          hotspotSide = 'bearish';
          maxVolumeIncrease = strongestResistance.depth;
        }
      }

      // Calculate position as percentage across the visible range
      const range = priceRange.right - priceRange.left;
      const offset = ((hotspotPrice - priceRange.left) / range) * 100;

      volumeHotspot = {
        bidVolume: summary.bidVolume || 0,
        askVolume: summary.askVolume || 0,
        bidSupport: summary.bestBid,
        askResistance: summary.bestAsk,
        volumeRatio: volumeRatio,
        price: hotspotPrice,
        spread: summary.bestAsk - summary.bestBid,
        offset: Math.max(0, Math.min(100, offset)), // Keep within 0-100%
        side: hotspotSide,
        type: hotspotSide === 'bullish' ? 'Support' : hotspotSide === 'bearish' ? 'Resistance' : 'Neutral',
        volume: maxVolumeIncrease
      };

      // Debug log for valley indicator positioning
      if (depthData.bids.length > 0 && depthData.asks.length > 0) {
        console.log('🎯 Valley Indicator:', {
          price: hotspotPrice.toFixed(2),
          volume: maxVolumeIncrease.toFixed(3),
          side: hotspotSide,
          offset: offset.toFixed(1) + '%',
          volumeRatio: (volumeRatio * 100).toFixed(1) + '% bid',
          visibleRange: `$${visibleMin.toFixed(0)} - $${visibleMax.toFixed(0)}`,
          bestBid: summary.bestBid,
          bestAsk: summary.bestAsk
        });
      }
    });
  }

  function handleOrderbookUpdate(data: any) {
    orderbookStore.processSnapshot(data);
    scheduleChartUpdate();
  }

  function handleLevel2Message(data: any) {
    if (!data) return;

    console.log('[DepthChart] Processing level2 message:', {
      hasChanges: !!data.changes,
      changeCount: data.changes?.length,
      hasBids: !!data.bids,
      hasAsks: !!data.asks
    });

    // The backend sends level2 updates with changes array
    if (data.changes && data.changes.length > 0) {
      // Process incremental updates
      const updates: any[] = [];

      // Log the first change to see its format
      console.log('[DepthChart] Sample change format:', JSON.stringify(data.changes[0]));

      for (const change of data.changes) {
        // Check if change is an array or object
        if (Array.isArray(change)) {
          // Backend format: [side, price, size]
          const [side, price, size] = change;
          updates.push({
            side: side === 'buy' ? 'buy' : 'sell',
            price: parseFloat(price),
            size: parseFloat(size)
          });
        } else if (change && typeof change === 'object') {
          // Object format: {side, price, size}
          updates.push({
            side: change.side === 'buy' ? 'buy' : 'sell',
            price: parseFloat(change.price),
            size: parseFloat(change.size || change.quantity || '0')
          });
        }
      }

      // Process as delta update
      console.log(`[DepthChart] Processing ${updates.length} updates to orderbookStore`);
      orderbookStore.processUpdate({
        product_id: data.product_id || 'BTC-USD',
        changes: updates
      });
      console.log('[DepthChart] OrderbookStore updated with level2 changes');
    } else if (data.bids && data.asks) {
      // Process as full snapshot
      // Convert to array format if needed
      const formattedBids = data.bids.map((bid: any) =>
        Array.isArray(bid) ? bid : [bid.price, bid.size]
      );
      const formattedAsks = data.asks.map((ask: any) =>
        Array.isArray(ask) ? ask : [ask.price, ask.size]
      );

      orderbookStore.processSnapshot({
        type: 'orderbook_snapshot',
        product_id: data.product_id || 'BTC-USD',
        bids: formattedBids,
        asks: formattedAsks
      });
    }

    scheduleChartUpdate();
    scheduleUIUpdate(); // Also update UI for valley indicator
  }

  function handleOrderbookDelta(delta: any) {
    orderbookStore.processDelta(delta);
    scheduleChartUpdate();
  }

  function scheduleChartUpdate() {
    hasPendingData = true;
    if (!updatePending) {
      updatePending = true;
      requestAnimationFrame(() => {
        if (hasPendingData) {
          const now = Date.now();
          if (now - lastChartUpdateTime >= CHART_UPDATE_THROTTLE_MS) {
            updateChart();
            lastChartUpdateTime = now;
          } else {
            // If too soon, schedule another update
            setTimeout(() => scheduleChartUpdate(), CHART_UPDATE_THROTTLE_MS);
          }
          hasPendingData = false;
        }
        updatePending = false;
      });
    }
  }

  function updateChart() {
    if (!bidSeries || !askSeries) {
      console.log('[DepthChart] Series not initialized yet');
      return;
    }

    // Get current price to filter orderbook data
    const summary = orderbookStore.summary;
    const currentPrice = summary?.currentPrice ||
                       (summary?.bestBid && summary?.bestAsk ? (summary.bestBid + summary.bestAsk) / 2 : 100000);
    const baseRange = 25000; // ±$25,000 range
    const minPrice = currentPrice - baseRange;
    const maxPrice = currentPrice + baseRange;

    // Get full orderbook data (use reasonable max like 500 levels)
    const { bids, asks } = orderbookStore.getDepthData(500);

    // Data structure verified: bids descending (high to low), asks ascending (low to high)

    // 🎯 SYNTHETIC DEPTH DATA: Extend orderbook to fill ±$25k range
    // Coinbase only provides ~50 levels, so we extrapolate to show the full range
    const extendedBids = [...bids];
    const extendedAsks = [...asks];

    // Extend bids downward to minPrice (currentPrice - $25k)
    // Note: After removing .reverse(), bids are now sorted DESCENDING (high to low)
    // bids[0] = highest price (near spread, low depth), bids[last] = lowest price (far from spread, high depth)
    if (bids.length > 0) {
      const lowestBid = bids[bids.length - 1]; // Last element = lowest price (furthest from spread, highest depth)
      const lowestBidDepth = lowestBid.depth; // Cumulative depth at lowest point
      if (lowestBid.price > minPrice) {
        // Add synthetic bid levels every $100 down to minPrice
        const depthIncrement = lowestBidDepth * 0.02; // Gradually increase depth by 2% per level
        let syntheticDepth = lowestBidDepth;
        // Append to end (lowest prices with highest depths)
        for (let price = lowestBid.price - 100; price >= minPrice; price -= 100) {
          syntheticDepth += depthIncrement;
          extendedBids.push({ price, depth: syntheticDepth });
        }
      }
    }

    // Extend asks upward to maxPrice (currentPrice + $25k)
    // Note: asks are sorted with lowest price first, so asks[length-1] has highest price
    if (asks.length > 0) {
      const highestAsk = asks[asks.length - 1]; // Last element = highest price
      const highestAskDepth = highestAsk.depth;
      if (highestAsk.price < maxPrice) {
        // Add synthetic ask levels every $100 up to maxPrice
        const depthIncrement = highestAskDepth * 0.02; // Gradually increase depth by 2% per level
        let syntheticDepth = highestAskDepth;
        for (let price = highestAsk.price + 100; price <= maxPrice; price += 100) {
          syntheticDepth += depthIncrement;
          extendedAsks.push({ price, depth: syntheticDepth });
        }
      }
    }

    // Sort data ascending by price (required by LightweightCharts)
    // Bids are currently descending, asks are already ascending
    extendedBids.sort((a, b) => a.price - b.price);

    // Filter extended data to exactly ±$25k range
    const filteredBids = extendedBids.filter(level => level.price >= minPrice && level.price <= maxPrice);
    const filteredAsks = extendedAsks.filter(level => level.price >= minPrice && level.price <= maxPrice);

    // Calculate actual data extent
    const lowestBid = filteredBids[0]?.price || currentPrice;
    const highestBid = filteredBids[filteredBids.length - 1]?.price || currentPrice;
    const lowestAsk = filteredAsks[0]?.price || currentPrice;
    const highestAsk = filteredAsks[filteredAsks.length - 1]?.price || currentPrice;
    const actualMinPrice = Math.min(lowestBid, lowestAsk);
    const actualMaxPrice = Math.max(highestBid, highestAsk);
    const actualRange = actualMaxPrice - actualMinPrice;

    console.log('[DepthChart] Got depth data:', {
      bidsCount: filteredBids.length,
      asksCount: filteredAsks.length,
      totalBids: bids.length,
      totalAsks: asks.length,
      requestedRange: `±$${baseRange.toLocaleString()}`,
      actualRange: `$${actualRange.toFixed(0)} ($${actualMinPrice.toFixed(2)} to $${actualMaxPrice.toFixed(2)})`,
      currentPrice: `$${currentPrice.toFixed(2)}`,
      bidExtent: `$${lowestBid.toFixed(2)} to $${highestBid.toFixed(2)}`,
      askExtent: `$${lowestAsk.toFixed(2)} to $${highestAsk.toFixed(2)}`
    });
    if (filteredBids.length === 0 || filteredAsks.length === 0) return;

    const bidData = filteredBids.map(level => ({
      time: level.price as any,
      value: level.depth
    }));

    const askData = filteredAsks.map(level => ({
      time: level.price as any,
      value: level.depth
    }));

    bidSeries.setData(bidData);
    askSeries.setData(askData);

    // 🎯 Set visible range to full ±$25k (now that we have synthetic data to fill it)
    requestAnimationFrame(() => {
      if (chart && bidData.length > 0 && askData.length > 0) {
        // Use full ±$25k range since we've extended the data with synthetic levels
        const rangeFrom = minPrice;
        const rangeTo = maxPrice;

        console.log(`[DepthChart] Setting range to ±$25k: $${rangeFrom.toFixed(2)} to $${rangeTo.toFixed(2)} (center: $${currentPrice.toFixed(2)}, real data: $${actualMinPrice.toFixed(2)} to $${actualMaxPrice.toFixed(2)})`);

        try {
          chart.timeScale().setVisibleRange({
            from: rangeFrom as any,
            to: rangeTo as any
          });
        } catch (error) {
          console.log('[DepthChart] Range update failed:', error);
          // Fallback to fitContent if setting explicit range fails
          try {
            chart.timeScale().fitContent();
          } catch (e) {
            console.log('[DepthChart] fitContent also failed');
          }
        }
      }
    });
  }

  function handleMouseMove(event: MouseEvent) {
    if (!chartContainer || !chart || !bidSeries) return;

    const rect = chartContainer.getBoundingClientRect();
    mouseX = event.clientX - rect.left;
    mouseY = event.clientY - rect.top;
    isHovering = true;

    // Convert mouse X to price using time scale
    const timeScale = chart.timeScale();
    const priceAtX = timeScale.coordinateToLogical(mouseX);

    if (priceAtX === null) return;

    hoverPrice = priceAtX;

    // Get orderbook data and find value at this price
    const { bids, asks } = orderbookStore.getDepthData(500);
    const allData = [...bids, ...asks];

    if (allData.length === 0) {
      hoverVolume = 0;
      return;
    }

    // Find closest data point
    let closestPoint = allData[0];
    let minDiff = Math.abs(allData[0].price - hoverPrice);

    for (const point of allData) {
      const diff = Math.abs(point.price - hoverPrice);
      if (diff < minDiff) {
        minDiff = diff;
        closestPoint = point;
      }
    }

    hoverVolume = closestPoint?.depth || 0;

    // Convert depth value to Y coordinate using the series price scale
    const yCoord = bidSeries.priceToCoordinate(closestPoint.depth);
    if (yCoord !== null) {
      mouseY = yCoord;
    }
  }

  function handleMouseLeave() {
    isHovering = false;
  }

  onDestroy(() => {
    // Clean up WebSocket event listener
    const ws = dataStore.getWebSocket();
    if (ws && (ws as any).__depthChartHandler) {
      ws.removeEventListener('message', (ws as any).__depthChartHandler);
      delete (ws as any).__depthChartHandler;
    }

    // Clean up WebSocket check interval
    if (wsCheckInterval) {
      clearInterval(wsCheckInterval);
      wsCheckInterval = null;
    }

    // Clean up mutation observer
    if (mutationObserver) {
      mutationObserver.disconnect();
      mutationObserver = null;
    }

    // Clean up chart
    if (chart) {
      chart.remove();
    }
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
      role="img"
      aria-label="Orderbook depth chart"
    >
      <!-- Transparent mouse capture overlay -->
      <div
        class="mouse-capture-overlay"
        onmousemove={handleMouseMove}
        onmouseleave={handleMouseLeave}
      ></div>

      <!-- Mid price indicator line - REMOVED per user request -->
      <!-- <div class="mid-price-line"></div> -->

      <!-- Valley info box -->
      <div class="valley-price-label valley-{volumeHotspot.side}">
        <span class="price-type">{volumeHotspot.type}</span>
        <span class="price-value">{FastNumberFormatter.formatPrice(Math.floor(volumeHotspot.price))}</span>
        <span class="volume-value">{volumeHotspot.volume.toFixed(2)} BTC</span>
      </div>

      <!-- Valley indicator -->
      <div class="valley-indicator valley-{volumeHotspot.side}" style="left: {volumeHotspot.offset}%">
        <div class="valley-point"></div>
        <div class="valley-line"></div>
      </div>

      <!-- Hover overlay -->
      {#if isHovering}
        <div class="hover-overlay" style="left: {mouseX}px">
          <div class="hover-line"></div>
          <div class="hover-circle" style="top: {mouseY}px"></div>
          <div class="hover-price-label">
            <span class="hover-price">{FastNumberFormatter.formatPrice(Math.floor(hoverPrice))}</span>
            {#if hoverVolume > 0}
              <span class="hover-volume">{hoverVolume.toFixed(3)} BTC</span>
            {/if}
          </div>
        </div>
      {/if}

      <!-- Volume gauge overlay -->
      <div class="volume-gauge-overlay">
        {#each volumeRange as item}
          <div class="volume-label" style="top: {100 - item.position}%">
            {formatVolume(item.value)}
          </div>
        {/each}
      </div>

      <!-- Price gauge overlay -->
      <div class="price-gauge-overlay">
        <div class="price-label" style="left: 10%">
          {formatPrice(priceRange.left)}
        </div>
        <div class="price-label price-label-center" style="left: 50%">
          {formatPrice(priceRange.center)}
        </div>
        <div class="price-label" style="left: 90%">
          {formatPrice(priceRange.right)}
        </div>
      </div>
    </div>

    <!-- Orderbook List slot -->
    <div class="integrated-orderbook">
      {@render children?.()}
    </div>
  </div>
</div>