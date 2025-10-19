/**
 * @file OrderBookCalculator.ts
 * @description OrderBook calculations and helper functions
 * Handles cumulative volume calculations, depth ranges, and market indicators
 */

/**
 * Represents a bid or ask level with cumulative volume
 */
export interface OrderLevel {
  price: number;
  size: number;
  cumulative: number;
  key: string;
}

/**
 * Volume range data for depth chart axis labels
 */
export interface VolumeRangePoint {
  position: number;
  value: number;
}

/**
 * Price range for the visible chart area
 */
export interface PriceRange {
  left: number;
  center: number;
  right: number;
}

/**
 * Volume hotspot indicator showing market pressure
 */
export interface VolumeHotspot {
  offset: number;
  price: number;
  side: 'bullish' | 'bearish' | 'neutral';
  volume: number;
  type: string;
}

/**
 * Calculate cumulative volumes for bid levels
 * @param bids Array of bid levels from orderbook
 * @returns Array of bid levels with cumulative volumes
 */
export function calculateCumulativeBids(
  bids: Array<{ price: number; size: number }>,
  startIndex = 0
): OrderLevel[] {
  let cumulative = 0;
  return bids.map((bid, index) => {
    cumulative += bid.size;
    return {
      price: bid.price,
      size: bid.size,
      cumulative,
      key: `bid-${index}` // Stable key to prevent re-renders
    };
  });
}

/**
 * Calculate cumulative volumes for ask levels
 * @param asks Array of ask levels from orderbook
 * @returns Array of ask levels with cumulative volumes
 */
export function calculateCumulativeAsks(
  asks: Array<{ price: number; size: number }>,
  startIndex = 0
): OrderLevel[] {
  let cumulative = 0;
  return asks.map((ask, index) => {
    cumulative += ask.size;
    return {
      price: ask.price,
      size: ask.size,
      cumulative,
      key: `ask-${index}` // Stable key to prevent re-renders
    };
  });
}

/**
 * Calculate maximum size from orderbook levels
 * @param levels Array of orderbook levels
 * @returns Maximum size, with minimum of 0.001
 */
export function calculateMaxSize(levels: OrderLevel[]): number {
  if (levels.length === 0) return 0.001;
  return Math.max(...levels.map(l => l.size), 0.001);
}

/**
 * Calculate volume range labels for depth chart
 * @param depthData Depth data from orderbook
 * @returns Array of volume range points for chart labels
 */
export function calculateVolumeRange(depthData: {
  bids: Array<{ depth: number }>;
  asks: Array<{ depth: number }>;
}): VolumeRangePoint[] {
  if (depthData.bids.length === 0 || depthData.asks.length === 0) {
    return [];
  }

  const maxBidDepth = depthData.bids[depthData.bids.length - 1]?.depth || 0;
  const maxAskDepth = depthData.asks[depthData.asks.length - 1]?.depth || 0;
  const maxDepth = Math.max(maxBidDepth, maxAskDepth);

  return Array.from({ length: 4 }, (_, i) => ({
    position: (i + 1) * 25,
    value: (maxDepth / 4) * (i + 1)
  }));
}

/**
 * Calculate price range for visible chart area
 * @param bestBid Current best bid price
 * @param bestAsk Current best ask price
 * @param rangeOffset Distance from mid-price (default 25000)
 * @returns Price range object
 */
export function calculatePriceRange(
  bestBid: number,
  bestAsk: number,
  rangeOffset = 25000
): PriceRange {
  const midPrice = (bestBid + bestAsk) / 2;
  return {
    left: midPrice - rangeOffset,
    center: midPrice,
    right: midPrice + rangeOffset
  };
}

/**
 * Calculate volume hotspot indicator (market pressure)
 * @param bestBid Current best bid
 * @param bestAsk Current best ask
 * @param depthData Depth data from orderbook
 * @param rangeOffset Distance from mid-price (default 25000)
 * @returns Volume hotspot indicator
 */
export function calculateVolumeHotspot(
  bestBid: number,
  bestAsk: number,
  depthData: {
    bids: Array<{ price: number; depth: number }>;
    asks: Array<{ price: number; depth: number }>;
  },
  rangeOffset = 25000
): VolumeHotspot {
  if (!bestBid || !bestAsk) {
    return {
      offset: 50,
      price: 0,
      side: 'neutral',
      volume: 0,
      type: 'Neutral'
    };
  }

  const midPrice = (bestBid + bestAsk) / 2;

  // Find which side has stronger volume (depth)
  let maxBidDepth = 0;
  let bestBidPrice = bestBid;

  if (depthData.bids.length > 0) {
    maxBidDepth = depthData.bids[0].depth; // Max depth on bid side
    bestBidPrice = depthData.bids[depthData.bids.length - 1].price; // Highest bid (closest to spread)
  }

  let maxAskDepth = 0;
  let bestAskPrice = bestAsk;

  if (depthData.asks.length > 0) {
    maxAskDepth = depthData.asks[depthData.asks.length - 1].depth; // Max depth on ask side
    bestAskPrice = depthData.asks[0].price; // Lowest ask (closest to spread)
  }

  // Determine which side has stronger volume
  const strongerSide = maxBidDepth > maxAskDepth ? 'bid' : 'ask';
  const strongerVolume = Math.max(maxBidDepth, maxAskDepth);

  // Position indicator based on which side is stronger
  // Move toward the deeper/outer edge of the stronger side
  let indicatorPrice = midPrice;

  const depthDifference = Math.abs(maxAskDepth - maxBidDepth);
  const depthSum = maxAskDepth + maxBidDepth;
  const volumeRatio = depthSum > 0 ? depthDifference / depthSum : 0; // 0 to 1

  if (strongerSide === 'bid') {
    // Bids stronger = position toward the LEFT side (lower bid prices)
    const deepestBidPrice =
      depthData.bids.length > 0 ? depthData.bids[0].price : midPrice - rangeOffset;
    indicatorPrice =
      bestBidPrice - volumeRatio * Math.abs(bestBidPrice - deepestBidPrice);
  } else {
    // Asks stronger = position toward the RIGHT side (higher ask prices)
    const deepestAskPrice =
      depthData.asks.length > 0
        ? depthData.asks[depthData.asks.length - 1].price
        : midPrice + rangeOffset;
    indicatorPrice =
      bestAskPrice + volumeRatio * Math.abs(deepestAskPrice - bestAskPrice);
  }

  // Calculate position on chart - full 0-100% range based on ±rangeOffset from midPrice
  const rangeStart = midPrice - rangeOffset;
  const rangeEnd = midPrice + rangeOffset;
  const positionInRange = (indicatorPrice - rangeStart) / (rangeEnd - rangeStart);
  const offset = Math.max(0, Math.min(100, positionInRange * 100));

  const side: 'bullish' | 'bearish' = strongerSide === 'bid' ? 'bullish' : 'bearish';

  return {
    offset,
    price: indicatorPrice,
    side,
    volume: strongerVolume,
    type: strongerSide === 'bid' ? 'Support' : 'Resistance'
  };
}

/**
 * Format price for display
 * @param price Price to format
 * @returns Formatted price string
 */
export function formatPrice(price: number): string {
  if (price >= 1000000) return `$${(price / 1000000).toFixed(1)}M`;
  if (price >= 1000) return `$${(price / 1000).toFixed(1)}k`;
  return `$${price.toFixed(0)}`;
}

/**
 * Format volume for display
 * @param volume Volume to format
 * @returns Formatted volume string
 */
export function formatVolume(volume: number): string {
  if (volume >= 1000) return `${(volume / 1000).toFixed(1)}k`;
  return volume.toFixed(1);
}
