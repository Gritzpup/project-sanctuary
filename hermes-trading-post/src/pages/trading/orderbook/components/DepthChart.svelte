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
  import { formatPrice, formatPriceDetailed, formatVolume } from './services/OrderBookCalculator';
  import { CHART_CONFIG, BID_SERIES_CONFIG, ASK_SERIES_CONFIG } from '../services/ChartConfig';
  import { calculateVolumeHotspot, calculateVolumeRange, calculatePriceRange } from '../services/VolumeHotspotCalculator';
  import '../styles/DepthChart.css';

  // Props
  let { children, chartRefreshKey = Date.now() } = $props();

  let chartContainer: HTMLDivElement;
  let chart: IChartApi;
  let bidSeries: ISeriesApi<'Area'>;
  let askSeries: ISeriesApi<'Area'>;
  // WebSocket handled through dataStore instead of separate connection

  // ⚡ PERF FIX #6: RAF-based chart updates instead of setInterval
  // setInterval fires regardless of frame rate and can cause irregular timing
  // RAF syncs with browser paint cycle for smoother updates
  const CHART_UPDATE_THROTTLE_MS = 250;
  let chartUpdateRafId: number | null = null;
  let chartNeedsUpdate = false;
  let lastChartUpdateTime = 0;

  // ⚡ PERFORMANCE FIX: RAF batching for mouse move
  let pendingMouseMove = false;
  let pendingMouseEvent: MouseEvent | null = null;

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
    side: 'neutral' as 'neutral' | 'bullish' | 'bearish',
    type: 'Neutral',
    volume: 0
  });
  let volumeRange = $state<any[]>([]);
  let priceRange = $state({ left: 0, center: 0, right: 0 });
  let mutationObserver: MutationObserver | null = null;
  let wsCheckInterval: ReturnType<typeof setInterval> | null = null;
  let wsCheckRetryCount = 0;  // ⚡ PERF FIX #11: Track retries to prevent infinite checking
  const WS_CHECK_MAX_RETRIES = 60;  // 60 * 500ms = 30 seconds max wait
  let watermarkTimeouts: ReturnType<typeof setTimeout>[] = [];  // Track watermark removal timeouts

  // ⚡ PERF FIX #7: WeakMap to track WS handlers for proper cleanup
  const wsHandlers = new WeakMap<WebSocket, (event: MessageEvent) => void>();

  // Update UI when store changes - must dereference values for Svelte 5 reactivity
  $effect(() => {
    // Access actual values to establish reactive dependencies
    const _bidVer = orderbookStore.versions.bids;
    const _askVer = orderbookStore.versions.asks;
    scheduleUIUpdate();
    scheduleChartUpdate();
  });

  // ⚡ SEAMLESS REFRESH: Re-initialize chart when key changes
  $effect(() => {
    const _key = chartRefreshKey;

    // Skip if container not ready yet (will be handled by onMount)
    if (!chartContainer) return;

    // Stop chart update interval before reinitializing
    stopChartUpdateInterval();

    // Clean up existing MutationObserver before reinitializing
    if (mutationObserver) {
      mutationObserver.disconnect();
      mutationObserver = null;
    }

    // Clear watermark removal timeouts
    watermarkTimeouts.forEach(t => clearTimeout(t));
    watermarkTimeouts = [];

    // Destroy existing chart if any
    if (chart) {
      chart.remove();
      chart = null as any;  // Reset so initializeChart() can create a new one
      bidSeries = null as any;
      askSeries = null as any;
    }

    // Re-initialize
    initializeChart();

    // Restart chart update interval
    startChartUpdateInterval();
  });

  onMount(async () => {

    // Initialize chart first
    initializeChart();

    // Start the chart update interval for smooth consistent rendering
    startChartUpdateInterval();

    // Clear any stale data first
    orderbookStore.reset();

    // Hydrate orderbook from backend API for fresh data
    try {
      await orderbookStore.hydrateFromCache('BTC-USD');
    } catch (error) {
    }

    setupWebSocket();
  });

  function initializeChart() {
    if (!chartContainer) {
      return;
    }
    if (chart) {
      return;
    }

    chart = createChart(chartContainer, {
      width: chartContainer.clientWidth,
      height: 200,
      ...CHART_CONFIG
    });

    bidSeries = chart.addAreaSeries(BID_SERIES_CONFIG);
    askSeries = chart.addAreaSeries(ASK_SERIES_CONFIG);

    // ⚡ PERF FIX #5: Batch DOM reads to avoid layout thrashing
    // Original: 600+ reflows from querySelectorAll + getComputedStyle on every element
    // Fixed: Batch all reads first, then apply all writes together
    const removeTradingViewWatermark = () => {
      const container = chartContainer.querySelector('.tv-lightweight-charts');
      if (!container) return;

      // PHASE 1: Batch all DOM reads (getBoundingClientRect, getComputedStyle)
      const containerRect = container.getBoundingClientRect();
      const divsToRemove: HTMLElement[] = [];

      // Read all divs once, collect candidates for removal
      const allDivs = Array.from(container.querySelectorAll('div')) as HTMLElement[];
      for (const div of allDivs) {
        // Check for common watermark patterns without heavy getComputedStyle calls
        // Only use getComputedStyle as last resort
        const hasSvg = div.querySelector('svg') !== null;
        const hasLink = div.querySelector('a') !== null;
        const hasTradingText = div.textContent?.toLowerCase().includes('trading');
        const hasCursorPointer = div.style.cursor === 'pointer';

        if (hasSvg || hasLink || hasTradingText || hasCursorPointer) {
          const rect = div.getBoundingClientRect();
          const isBottomLeft = rect.bottom >= containerRect.bottom - 50 &&
                               rect.left <= containerRect.left + 100;
          if (isBottomLeft) {
            divsToRemove.push(div);
          }
        }
      }

      // Also check specific selectors (these are cheap queries)
      const selectors = [
        'a[href*="tradingview"]',
        'div:last-child[style*="position: absolute"]'
      ];
      for (const selector of selectors) {
        const elements = container.querySelectorAll(selector);
        elements.forEach(el => divsToRemove.push(el as HTMLElement));
      }

      // PHASE 2: Batch all DOM writes (removal)
      for (const div of divsToRemove) {
        div.remove();
      }
    };

    // Run once after chart renders (sufficient for watermark removal)
    watermarkTimeouts.push(setTimeout(removeTradingViewWatermark, 500));

    // ⚡ PERFORMANCE FIX: Disabled MutationObserver - it was causing severe lag
    // MutationObserver fired on EVERY DOM change (chart updates constantly)
    // Each fire ran querySelectorAll + getComputedStyle on ALL elements = layout thrashing
    // setTimeout-based removal above is sufficient for watermark removal

    // Don't set initial range here - wait for data in scheduleChartUpdate
  }

  function setupWebSocket() {
    const ws = dataStore.getWebSocket();
    if (ws && ws.readyState === WebSocket.OPEN) {
      attachWebSocketListener(ws);
      depthChartState.setConnected(true);

      // Request initial level2 snapshot
      ws.send(JSON.stringify({
        type: 'requestLevel2Snapshot',
        productId: 'BTC-USD'
      }));
    } else {
      depthChartState.setConnected(false);
      // Start watching for WebSocket availability
      watchWebSocketAvailability();
    }
  }

  // ⚡ PERF FIX #11: Add max retry count to prevent indefinite polling
  function watchWebSocketAvailability() {
    wsCheckRetryCount = 0;  // Reset counter

    wsCheckInterval = setInterval(() => {
      wsCheckRetryCount++;

      // Stop checking after max retries (30 seconds)
      if (wsCheckRetryCount >= WS_CHECK_MAX_RETRIES) {
        if (wsCheckInterval) {
          clearInterval(wsCheckInterval);
          wsCheckInterval = null;
        }
        console.warn('[DepthChart] WebSocket availability check timed out after 30 seconds');
        return;
      }

      const ws = dataStore.getWebSocket();
      if (ws && ws.readyState === WebSocket.OPEN) {
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

  // ⚡ PERF FIX #7: Use WeakMap to track handlers, prevent leaks on WS instance changes
  function attachWebSocketListener(ws: WebSocket) {
    // Remove existing handler if any (prevents duplicates)
    const existingHandler = wsHandlers.get(ws);
    if (existingHandler) {
      ws.removeEventListener('message', existingHandler);
    }

    const handler = (event: MessageEvent) => {
      try {
        const message = JSON.parse(event.data);

        // Handle level2 messages (from backend WebSocket)
        if (message.type === 'level2') {
          handleLevel2Message(message.data);
        } else if (message.type === 'orderbook-delta') {
          // Handle orderbook deltas from Redis Pub/Sub
          handleOrderbookDelta(message.data);
        } else if (message.type === 'orderbook_snapshot' || message.type === 'orderbook_update') {
          handleOrderbookUpdate(message);
        }
      } catch (err) {
      }
    };

    // Store in WeakMap for proper cleanup
    wsHandlers.set(ws, handler);
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
      let hotspotSide: 'neutral' | 'bullish' | 'bearish' = 'neutral';

      // Track the steepest volume increases (walls) - these are support/resistance
      let maxVolumeIncrease = 0;

      // Check bids for support walls (look for big jumps in cumulative volume)
      for (let i = 0; i < depthData.bids.length; i++) {
        const bid = depthData.bids[i];
        // Skip if price is outside visible range
        if (bid.price < visibleMin || bid.price > visibleMax) continue;

        // Use cumulative depth (which is the 'depth' field from getDepthData)
        const volumeAtLevel = bid.depth || 0;

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
        const volumeAtLevel = ask.depth || 0;

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
      // Calculate volumes from the bids/asks arrays
      const bidVolume = summary.bids.reduce((sum, bid) => sum + bid.size, 0);
      const askVolume = summary.asks.reduce((sum, ask) => sum + ask.size, 0);
      const totalVolume = bidVolume + askVolume;
      const volumeRatio = totalVolume > 0 ? bidVolume / totalVolume : 0.5;

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
        bidVolume,
        askVolume,
        bidSupport: summary.bestBid,
        askResistance: summary.bestAsk,
        volumeRatio,
        price: hotspotPrice,
        spread: summary.bestAsk - summary.bestBid,
        offset: Math.max(0, Math.min(100, offset)), // Keep within 0-100%
        side: hotspotSide,
        type: hotspotSide === 'bullish' ? 'Support' : hotspotSide === 'bearish' ? 'Resistance' : 'Neutral',
        volume: maxVolumeIncrease
      };

    });
  }

  function handleOrderbookUpdate(data: any) {
    orderbookStore.processSnapshot(data);
    scheduleChartUpdate();
  }

  function handleLevel2Message(data: any) {
    if (!data) return;

    // The backend sends level2 updates with changes array
    if (data.changes && data.changes.length > 0) {
      // Process incremental updates
      const updates: any[] = [];

      // Log the first change to see its format

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
      orderbookStore.processUpdate({
        product_id: data.product_id || 'BTC-USD',
        changes: updates
      });
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

  // ⚡ PERFORMANCE FIX: Interval-based chart updates for smooth rendering
  // The old RAF + setTimeout approach could cause "stuck" behavior due to setTimeout cascading
  // This interval-based approach guarantees consistent renders at 4fps
  function scheduleChartUpdate() {
    // Just mark that we need an update - the interval will handle rendering
    chartNeedsUpdate = true;
  }

  // ⚡ PERF FIX #6: RAF-based update loop with throttling
  function startChartUpdateInterval() {
    if (chartUpdateRafId) return;

    const rafLoop = (timestamp: number) => {
      // Only update if enough time has passed (throttle to ~4fps)
      if (chartNeedsUpdate && chart && bidSeries && askSeries) {
        if (timestamp - lastChartUpdateTime >= CHART_UPDATE_THROTTLE_MS) {
          try {
            updateChart();
          } catch (e) {
            // Protect RAF loop from chart errors (e.g. lightweight-charts assertions)
          }
          chartNeedsUpdate = false;
          lastChartUpdateTime = timestamp;
        }
      }
      // Continue RAF loop (must always execute even if updateChart throws)
      chartUpdateRafId = requestAnimationFrame(rafLoop);
    };

    chartUpdateRafId = requestAnimationFrame(rafLoop);
  }

  function stopChartUpdateInterval() {
    if (chartUpdateRafId) {
      cancelAnimationFrame(chartUpdateRafId);
      chartUpdateRafId = null;
    }
  }

  function updateChart() {
    if (!bidSeries || !askSeries) {
      return;
    }

    // Get current price to filter orderbook data
    const summary = orderbookStore.summary;
    const currentPrice = (summary?.bestBid && summary?.bestAsk ? (summary.bestBid + summary.bestAsk) / 2 : 100000);
    const baseRange = 25000; // ±$25,000 range
    const minPrice = currentPrice - baseRange;
    const maxPrice = currentPrice + baseRange;

    // ⚡ PERFORMANCE FIX: Reduced from 10000 to 500 levels
    // Processing 10k levels when only ~200 visible caused severe lag
    // 500 levels provides smooth curves while being performant
    const { bids, asks } = orderbookStore.getDepthData(500);

    // Data structure verified: bids descending (high to low), asks ascending (low to high)

    // 🎯 USE REAL ORDERBOOK DATA ONLY - No synthetic extension
    // The L2 orderbook provides real granular data, we shouldn't create fake $100 steps
    // Just use whatever range the real data covers
    const extendedBids = [...bids];
    const extendedAsks = [...asks];

    // NO SYNTHETIC EXTENSION - Use real orderbook data only
    // The angular/stepped appearance was caused by synthetic $100 price increments
    // Real L2 data is already smooth and granular

    // Sort data ascending by price (required by LightweightCharts)
    // Bids are currently descending, asks are already ascending
    extendedBids.sort((a, b) => a.price - b.price);

    // Use all real data - no artificial filtering to ±$25k
    const filteredBids = extendedBids;
    const filteredAsks = extendedAsks;

    // Calculate actual data extent
    const lowestBid = filteredBids[0]?.price || currentPrice;
    const highestBid = filteredBids[filteredBids.length - 1]?.price || currentPrice;
    const lowestAsk = filteredAsks[0]?.price || currentPrice;
    const highestAsk = filteredAsks[filteredAsks.length - 1]?.price || currentPrice;
    const actualMinPrice = Math.min(lowestBid, lowestAsk);
    const actualMaxPrice = Math.max(highestBid, highestAsk);
    const actualRange = actualMaxPrice - actualMinPrice;

    if (filteredBids.length === 0 || filteredAsks.length === 0) return;

    // 🔧 FIX: Use summary's bestBid/bestAsk which are correctly calculated from sorted arrays
    // This ensures proper V-shape regardless of how we process the depth data
    const summaryData = orderbookStore.summary;
    let bestBid = summaryData.bestBid || currentPrice;
    let bestAsk = summaryData.bestAsk || currentPrice;

    // Fallback to calculated values if summary is empty
    if (!summaryData.bestBid) bestBid = filteredBids[filteredBids.length - 1]?.price || currentPrice;
    if (!summaryData.bestAsk) bestAsk = filteredAsks[0]?.price || currentPrice;

    // 🔧 FIX: If bestBid > bestAsk (crossed market), swap for proper valley
    if (bestBid > bestAsk) {
      // For crossed market, use the overlap region as the spread
      const overlapLow = bestAsk;  // Lower boundary of overlap
      const overlapHigh = bestBid; // Upper boundary of overlap
      bestBid = overlapLow;
      bestAsk = overlapHigh;
    }

    const spread = bestAsk - bestBid;
    const midPrice = (bestBid + bestAsk) / 2;

    // Filter bids to only include prices < midPrice (left side of valley)
    // Use strict inequality to avoid duplicate with anchor point at midPrice
    const bidData = filteredBids
      .filter(level => level.price < midPrice)
      .map(level => ({
        time: level.price as any,
        value: level.depth
      }));

    // Add anchor point at midPrice (where bid line meets valley bottom)
    bidData.push({
      time: midPrice as any,
      value: 0
    });

    // Sort bids ascending by price (required by LightweightCharts)
    bidData.sort((a, b) => (a.time as number) - (b.time as number));

    // Filter asks to only include prices > midPrice (right side of valley)
    // Use strict inequality to avoid duplicate with anchor point at midPrice
    const askData = [{
      time: midPrice as any,
      value: 0
    }];

    // Add ask levels that are above midPrice
    filteredAsks.forEach(level => {
      if (level.price > midPrice) {
        askData.push({
          time: level.price as any,
          value: level.depth
        });
      }
    });

    // Sort asks ascending by price (required by LightweightCharts)
    askData.sort((a, b) => (a.time as number) - (b.time as number));

    // Deduplicate: lightweight-charts requires strictly ascending time values
    const dedup = (data: Array<{time: any, value: number}>) => {
      const result: typeof data = [];
      for (const item of data) {
        if (result.length === 0 || (result[result.length - 1].time as number) < (item.time as number)) {
          result.push(item);
        }
      }
      return result;
    };

    bidSeries.setData(dedup(bidData));
    askSeries.setData(dedup(askData));

    // 🎯 Set visible range to full ±$25k (now that we have synthetic data to fill it)
    requestAnimationFrame(() => {
      if (chart && bidData.length > 0 && askData.length > 0) {
        // Use full ±$25k range since we've extended the data with synthetic levels
        const rangeFrom = minPrice;
        const rangeTo = maxPrice;


        try {
          chart.timeScale().setVisibleRange({
            from: rangeFrom as any,
            to: rangeTo as any
          });
        } catch (error) {
          // Fallback to fitContent if setting explicit range fails
          try {
            chart.timeScale().fitContent();
          } catch (e) {
          }
        }
      }
    });
  }

  function handleMouseMove(event: MouseEvent) {
    // ⚡ PERFORMANCE FIX: RAF batching - don't process every pixel movement
    // This was firing 60+ times/sec without throttling, causing severe lag
    if (pendingMouseMove) {
      pendingMouseEvent = event;  // Store latest event for RAF callback
      return;
    }
    pendingMouseMove = true;
    pendingMouseEvent = event;

    requestAnimationFrame(() => {
      if (!pendingMouseEvent || !chartContainer || !chart || !bidSeries) {
        pendingMouseMove = false;
        return;
      }

      const e = pendingMouseEvent;
      const rect = chartContainer.getBoundingClientRect();
      mouseX = e.clientX - rect.left;
      mouseY = e.clientY - rect.top;
      isHovering = true;

      // Calculate hover price based on chart width and price range
      const width = rect.width;
      const xPercent = mouseX / width;
      hoverPrice = priceRange.left + (priceRange.right - priceRange.left) * xPercent;

      // Get orderbook data and find value at this price
      // ⚡ PERFORMANCE FIX: Reduced from 500 to 100 levels for hover calculation
      const { bids, asks } = orderbookStore.getDepthData(100);
      const allData = [...bids, ...asks];

      if (allData.length === 0) {
        hoverVolume = 0;
        pendingMouseMove = false;
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

      // Calculate Y position manually based on depth
      // Find max depth in all data for scaling
      const maxDepth = Math.max(...allData.map(p => p.depth), 1);
      const height = rect.height;

      // Depth charts show high values at top (low Y), low values at bottom (high Y)
      const depthPercent = closestPoint.depth / maxDepth;
      mouseY = height * (1 - depthPercent);

      pendingMouseMove = false;
    });
  }

  function handleMouseLeave() {
    isHovering = false;
  }

  onDestroy(() => {
    // Clean up chart update interval
    stopChartUpdateInterval();

    // ⚡ PERF FIX #7: Clean up WebSocket event listener using WeakMap
    const ws = dataStore.getWebSocket();
    if (ws) {
      const handler = wsHandlers.get(ws);
      if (handler) {
        ws.removeEventListener('message', handler);
        wsHandlers.delete(ws);
      }
    }

    // Clean up WebSocket check interval
    if (wsCheckInterval) {
      clearInterval(wsCheckInterval);
      wsCheckInterval = null;
    }

    // Clean up watermark removal timeouts
    watermarkTimeouts.forEach(t => clearTimeout(t));
    watermarkTimeouts = [];

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
        role="presentation"
        onmousemove={handleMouseMove}
        onmouseleave={handleMouseLeave}
      ></div>

      <!-- Mid price indicator line - REMOVED per user request -->
      <!-- <div class="mid-price-line"></div> -->

      <!-- Valley indicator with integrated label -->
      <div class="valley-indicator valley-{volumeHotspot.side}" style="left: {volumeHotspot.offset}%">
        <div class="valley-price-label valley-{volumeHotspot.side}">
          <span class="price-type">{volumeHotspot.type}</span>
          <span class="price-value">{FastNumberFormatter.formatPrice(Math.floor(volumeHotspot.price))}</span>
          <span class="volume-value">{volumeHotspot.volume.toFixed(2)} BTC</span>
        </div>
        <div class="valley-line"></div>
        <div class="valley-point"></div>
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
          {formatPriceDetailed(priceRange.left)}
        </div>
        <div class="price-label price-label-center" style="left: 50%">
          {formatPriceDetailed(priceRange.center)}
        </div>
        <div class="price-label" style="left: 90%">
          {formatPriceDetailed(priceRange.right)}
        </div>
      </div>
    </div>

    <!-- Orderbook List slot -->
    <div class="integrated-orderbook">
      {@render children?.()}
    </div>
  </div>
</div>