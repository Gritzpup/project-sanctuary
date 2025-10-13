/**
 * @file useDepthChartData.ts
 * @description Data management hook for depth chart - handles WebSocket, L2 updates, and derived data
 */
import { orderbookStore } from '../stores/orderbookStore.svelte';
import { dataStore } from '../../chart/stores/dataStore.svelte';
import { logger } from '../../../../services/logging';

export interface L2Status {
  state: 'disconnected' | 'waiting' | 'active' | 'error';
  label: string;
  message: string;
  lastUpdate: number;
  updatesPerSecond: number;
}

export interface OrderbookLevel {
  price: number;
  size: number;
  cumulative: number;
  key: string;
}

export interface DepthChartData {
  bidsWithCumulative: OrderbookLevel[];
  asksWithCumulative: OrderbookLevel[];
  maxBidSize: number;
  maxAskSize: number;
  volumeRange: Array<{ position: number; value: number }>;
  priceRange: { left: number; center: number; right: number };
  volumeHotspot: {
    offset: number;
    price: number;
    side: string;
    volume: number;
    type?: string;
  };
  l2Status: L2Status;
}

export function useDepthChartData() {
  let ws: WebSocket | null = null;
  let lastL2UpdateTime = 0;
  let l2UpdateCount = 0;
  let l2UpdateTimer: NodeJS.Timeout | null = null;

  // L2 Data flow status indicator
  let l2Status = $state<L2Status>({
    state: 'disconnected',
    label: 'Connecting',
    message: 'Connecting to L2 data stream...',
    lastUpdate: 0,
    updatesPerSecond: 0
  });

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
      l2Status = {
        state: 'error',
        label: 'No Data',
        message: `No updates for ${(timeSinceUpdate / 1000).toFixed(1)}s`,
        lastUpdate: lastL2UpdateTime,
        updatesPerSecond: 0
      };
    } else if (metrics.updatesPerSecond >= 8) {
      l2Status = {
        state: 'active',
        label: `L2 WebSocket (${metrics.updatesPerSecond}/s)`,
        message: `Real-time L2 data: ${metrics.updatesPerSecond} updates/sec, ${metrics.avgLatency.toFixed(0)}ms latency`,
        lastUpdate: lastL2UpdateTime,
        updatesPerSecond: metrics.updatesPerSecond
      };
    } else if (metrics.updatesPerSecond > 0) {
      l2Status = {
        state: 'waiting',
        label: `Slow (${metrics.updatesPerSecond}/s)`,
        message: `Slow updates: ${metrics.updatesPerSecond} updates/sec`,
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

  // Reactive getters for smooth updates
  let bidsWithCumulative = $derived.by(() => {
    const bids = orderbookStore.getBids(12);
    let cumulative = 0;
    return bids.map((bid, index) => {
      cumulative += bid.size;
      return {
        price: bid.price,
        size: bid.size,
        cumulative,
        key: `bid-${index}`
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
        key: `ask-${index}`
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
    const depthData = orderbookStore.getDepthData(500);

    if (depthData.bids.length > 0 && depthData.asks.length > 0) {
      const bidPrices = depthData.bids.map(b => b.price);
      const askPrices = depthData.asks.map(a => a.price);
      const allPrices = [...bidPrices, ...askPrices];

      const minPrice = Math.min(...allPrices);
      const maxPrice = Math.max(...allPrices);
      const midPrice = (minPrice + maxPrice) / 2;

      return {
        left: minPrice,
        center: midPrice,
        right: maxPrice
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
    const depthData = orderbookStore.getDepthData(100);

    let maxBidVolume = 0;
    let maxBidPrice = summary.bestBid;

    depthData.bids.forEach((bid) => {
      if (bid.price > midPrice * 0.98 && bid.depth > maxBidVolume) {
        maxBidVolume = bid.depth;
        maxBidPrice = bid.price;
      }
    });

    let maxAskVolume = 0;
    let maxAskPrice = summary.bestAsk;

    depthData.asks.forEach((ask) => {
      if (ask.price < midPrice * 1.02 && ask.depth > maxAskVolume) {
        maxAskVolume = ask.depth;
        maxAskPrice = ask.price;
      }
    });

    const strongerSide = maxBidVolume > maxAskVolume ? 'bid' : 'ask';
    const strongerPrice = strongerSide === 'bid' ? maxBidPrice : maxAskPrice;
    const strongerVolume = strongerSide === 'bid' ? maxBidVolume : maxAskVolume;

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

  function connectWebSocket(): boolean {
    ws = dataStore.getWebSocket();

    if (!ws) {
      return false;
    }

    const messageHandler = (event: MessageEvent) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === 'level2') {
          handleLevel2Message(message.data);
        }
      } catch (error) {
        logger.error('Error parsing level2 message', { error: error instanceof Error ? error.message : String(error) }, 'DepthChartData');
      }
    };

    ws.addEventListener('message', messageHandler);
    (ws as any).__depthChartHandler = messageHandler;

    return true;
  }

  function handleLevel2Message(data: any) {
    lastL2UpdateTime = Date.now();
    l2UpdateCount++;

    if (data.type === 'snapshot') {
      orderbookStore.processSnapshot(data);
    } else if (data.type === 'update') {
      orderbookStore.processUpdate(data);
    }
  }

  function cleanup() {
    if (ws && (ws as any).__depthChartHandler) {
      ws.removeEventListener('message', (ws as any).__depthChartHandler);
      delete (ws as any).__depthChartHandler;
    }
  }

  return {
    get bidsWithCumulative() { return bidsWithCumulative; },
    get asksWithCumulative() { return asksWithCumulative; },
    get maxBidSize() { return maxBidSize; },
    get maxAskSize() { return maxAskSize; },
    get volumeRange() { return volumeRange; },
    get priceRange() { return priceRange; },
    get volumeHotspot() { return volumeHotspot; },
    get l2Status() { return l2Status; },
    connectWebSocket,
    handleLevel2Message,
    cleanup
  };
}
