/**
 * @file DepthChartState.svelte.ts
 * @description Svelte 5 state management for DepthChart UI
 * Extracted from DepthChart.svelte to reduce component complexity
 */

export interface HoverData {
  x: number;
  y: number;
  price: number;
  depth: number;
  side: 'bid' | 'ask';
  visible: boolean;
}

export interface ValleyData {
  minPrice: number;
  maxPrice: number;
  midPrice: number;
  spread: number;
  spreadPercentage: number;
  depth: number;
  x: number;
  y: number;
}

export interface GaugeData {
  bidVolume: number;
  askVolume: number;
  bidSupport: number;
  askResistance: number;
  volumeRatio: number;
}

class DepthChartStateManager {
  // Main state
  isConnected = $state(false);
  isLoading = $state(true);
  currentPrice = $state(0);

  // Chart data
  depthData = $state({
    bids: [] as any[],
    asks: [] as any[],
    timestamp: Date.now()
  });

  // Hover state
  hoverData = $state<HoverData>({
    x: 0,
    y: 0,
    price: 0,
    depth: 0,
    side: 'bid',
    visible: false
  });

  // Valley indicator state
  valleyData = $state<ValleyData | null>(null);
  showValleyIndicator = $state(true);

  // Gauge state
  gaugeData = $state<GaugeData>({
    bidVolume: 0,
    askVolume: 0,
    bidSupport: 0,
    askResistance: 0,
    volumeRatio: 0.5
  });

  // Animation state
  animationFrame = $state(null as number | null);

  // Derived states
  spread = $derived(() => {
    if (this.depthData.bids.length > 0 && this.depthData.asks.length > 0) {
      const bestBid = this.depthData.bids[0]?.price || 0;
      const bestAsk = this.depthData.asks[0]?.price || 0;
      return bestAsk - bestBid;
    }
    return 0;
  });

  spreadPercentage = $derived(() => {
    if (this.currentPrice > 0) {
      return (this.spread() / this.currentPrice) * 100;
    }
    return 0;
  });

  midPrice = $derived(() => {
    if (this.depthData.bids.length > 0 && this.depthData.asks.length > 0) {
      const bestBid = this.depthData.bids[0]?.price || 0;
      const bestAsk = this.depthData.asks[0]?.price || 0;
      return (bestBid + bestAsk) / 2;
    }
    return this.currentPrice;
  });

  // Methods
  setConnected(connected: boolean) {
    this.isConnected = connected;
    if (!connected) {
      this.isLoading = true;
    }
  }

  setLoading(loading: boolean) {
    this.isLoading = loading;
  }

  setCurrentPrice(price: number) {
    this.currentPrice = price;
  }

  updateDepthData(data: { bids: any[], asks: any[] }) {
    this.depthData = {
      bids: data.bids,
      asks: data.asks,
      timestamp: Date.now()
    };
    this.isLoading = false;
  }

  updateHoverData(data: Partial<HoverData>) {
    this.hoverData = { ...this.hoverData, ...data };
  }

  showHover() {
    this.hoverData.visible = true;
  }

  hideHover() {
    this.hoverData.visible = false;
  }

  updateValleyData(data: ValleyData | null) {
    this.valleyData = data;
  }

  toggleValleyIndicator() {
    this.showValleyIndicator = !this.showValleyIndicator;
  }

  updateGaugeData(data: Partial<GaugeData>) {
    this.gaugeData = { ...this.gaugeData, ...data };
  }

  setAnimationFrame(frame: number | null) {
    this.animationFrame = frame;
  }

  reset() {
    this.isConnected = false;
    this.isLoading = true;
    this.currentPrice = 0;
    this.depthData = {
      bids: [],
      asks: [],
      timestamp: Date.now()
    };
    this.hoverData.visible = false;
    this.valleyData = null;
    this.gaugeData = {
      bidVolume: 0,
      askVolume: 0,
      bidSupport: 0,
      askResistance: 0,
      volumeRatio: 0.5
    };
  }
}

// Export singleton instance
export const depthChartState = new DepthChartStateManager();