/**
 * @file DepthChartCalculator.ts
 * @description Business logic for depth chart calculations
 * Phase 5G: Extract from monolithic DepthChart.svelte
 */

import type { OrderBookData } from '../../../../features/orderbook/types/OrderbookTypes';

export interface VolumeRange {
  position: number;
  value: number;
}

export interface PriceRange {
  left: number;
  center: number;
  right: number;
}

export interface VolumeHotspot {
  offset: number;
  price: number;
  side: 'bullish' | 'bearish' | 'neutral';
  volume: number;
  type: 'Support' | 'Resistance' | 'Neutral';
}

export interface BidWithCumulative {
  price: number;
  size: number;
  cumulative: number;
  key: string;
}

export interface AskWithCumulative {
  price: number;
  size: number;
  cumulative: number;
  key: string;
}

/**
 * Depth Chart Calculator - handles all calculation logic for orderbook depth visualization
 */
export class DepthChartCalculator {
  /**
   * Calculate cumulative volumes for bids
   */
  static calculateBidsWithCumulative(bids: OrderBookData[]): BidWithCumulative[] {
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
  }

  /**
   * Calculate cumulative volumes for asks
   */
  static calculateAsksWithCumulative(asks: OrderBookData[]): AskWithCumulative[] {
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
  }

  /**
   * Get maximum bid size from list
   */
  static getMaxBidSize(bids: BidWithCumulative[]): number {
    return bids.length > 0 ? Math.max(...bids.map(b => b.size), 0.001) : 0.001;
  }

  /**
   * Get maximum ask size from list
   */
  static getMaxAskSize(asks: AskWithCumulative[]): number {
    return asks.length > 0 ? Math.max(...asks.map(a => a.size), 0.001) : 0.001;
  }

  /**
   * Calculate volume range gridlines for chart
   */
  static calculateVolumeRange(maxDepthBid: number, maxDepthAsk: number): VolumeRange[] {
    const maxDepth = Math.max(maxDepthBid, maxDepthAsk);
    if (maxDepth <= 0) return [];

    return Array.from({ length: 4 }, (_, i) => ({
      position: (i + 1) * 25,
      value: (maxDepth / 4) * (i + 1)
    }));
  }

  /**
   * Calculate price range for chart display
   */
  static calculatePriceRange(bestBid: number | null, bestAsk: number | null): PriceRange {
    if (!bestBid || !bestAsk) {
      return { left: 0, center: 0, right: 0 };
    }

    const midPrice = (bestBid + bestAsk) / 2;
    return {
      left: midPrice - 25000,
      center: midPrice,
      right: midPrice + 25000
    };
  }

  /**
   * Calculate volume hotspot indicator position
   */
  static calculateVolumeHotspot(
    bestBid: number | null,
    bestAsk: number | null,
    depthData: any
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

    // Get max depths
    let maxBidDepth = 0;
    let bestBidPrice = bestBid;
    if (depthData.bids && depthData.bids.length > 0) {
      maxBidDepth = depthData.bids[0].depth;
      bestBidPrice = depthData.bids[depthData.bids.length - 1].price;
    }

    let maxAskDepth = 0;
    let bestAskPrice = bestAsk;
    if (depthData.asks && depthData.asks.length > 0) {
      maxAskDepth = depthData.asks[depthData.asks.length - 1].depth;
      bestAskPrice = depthData.asks[0].price;
    }

    // Determine stronger side
    const strongerSide = maxBidDepth > maxAskDepth ? 'bid' : 'ask';
    const strongerVolume = Math.max(maxBidDepth, maxAskDepth);

    // Calculate position
    const depthDifference = Math.abs(maxAskDepth - maxBidDepth);
    const depthSum = maxAskDepth + maxBidDepth;
    const volumeRatio = depthSum > 0 ? depthDifference / depthSum : 0;

    let indicatorPrice = midPrice;

    if (strongerSide === 'bid') {
      const deepestBidPrice = depthData.bids && depthData.bids.length > 0
        ? depthData.bids[0].price
        : midPrice - 25000;
      indicatorPrice = bestBidPrice - (volumeRatio * Math.abs(bestBidPrice - deepestBidPrice));
    } else {
      const deepestAskPrice = depthData.asks && depthData.asks.length > 0
        ? depthData.asks[depthData.asks.length - 1].price
        : midPrice + 25000;
      indicatorPrice = bestAskPrice + (volumeRatio * Math.abs(deepestAskPrice - bestAskPrice));
    }

    // Calculate position as percentage
    const rangeStart = midPrice - 25000;
    const rangeEnd = midPrice + 25000;
    const positionInRange = (indicatorPrice - rangeStart) / (rangeEnd - rangeStart);
    const offset = Math.max(0, Math.min(100, positionInRange * 100));

    return {
      offset,
      price: indicatorPrice,
      side: strongerSide === 'bid' ? 'bullish' : 'bearish',
      volume: strongerVolume,
      type: strongerSide === 'bid' ? 'Support' : 'Resistance'
    };
  }

  /**
   * Format price for display
   */
  static formatPrice(price: number): string {
    if (price >= 1000000) return `$${(price / 1000000).toFixed(1)}M`;
    if (price >= 1000) return `$${(price / 1000).toFixed(1)}k`;
    return `$${price.toFixed(0)}`;
  }

  /**
   * Format volume for display
   */
  static formatVolume(volume: number): string {
    if (volume >= 1000) return `${(volume / 1000).toFixed(1)}k`;
    return volume.toFixed(1);
  }
}
