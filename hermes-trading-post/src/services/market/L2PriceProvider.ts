/**
 * ✅ L2 CONSOLIDATION - Week 1
 * Unified L2-based price provider
 *
 * Single source of truth for ALL prices across the system:
 * - Chart candles
 * - Strategy decisions
 * - Paper trading execution
 * - User-facing price display
 *
 * This service leverages the real-time L2 orderbook for:
 * - Best bid/ask prices (10-30 Hz updates)
 * - Spread calculation
 * - Liquidity analysis
 * - Execution estimation
 *
 * Replaces: ticker, candles, and fragmented price sources
 */

import { orderbookStore } from '../../pages/trading/orderbook/stores/orderbookStore.svelte';
import type {
  Orderbook,
  SpreadMetrics,
  LiquidityMetrics,
  LiquidityLevel,
  ExecutionEstimate,
  MarketContext,
  PriceUpdate,
  OrderbookLevel,
} from '../../types/market/L2Types';

export class L2PriceProvider {
  private productId: string = 'BTC-USD';
  private priceSubscribers: Set<(update: PriceUpdate) => void> = new Set();
  private marketContextSubscribers: Set<(context: MarketContext) => void> = new Set();
  private lastPriceUpdate: PriceUpdate | null = null;
  private lastMarketContext: MarketContext | null = null;

  // ✅ PHASE 8 FIX: Destroyed flag for lifecycle safety
  // Prevents callbacks from executing after provider is destroyed
  private destroyed = false;

  constructor(productId: string = 'BTC-USD') {
    this.productId = productId;
    this.setupListeners();
  }

  /**
   * Setup listeners on orderbook updates
   */
  private setupListeners() {
    // Subscribe to orderbook changes
    orderbookStore.subscribe((state: any) => {
      if (state.bids && state.bids.length > 0 && state.asks && state.asks.length > 0) {
        this.onOrderbookUpdate();
      }
    });
  }

  /**
   * Called whenever orderbook updates
   * Triggers price and market context updates
   */
  private onOrderbookUpdate() {
    // ✅ PHASE 8 FIX: Check destroyed flag before processing
    if (this.destroyed) return;

    const priceUpdate = this.generatePriceUpdate();
    if (priceUpdate) {
      this.lastPriceUpdate = priceUpdate;
      this.notifyPriceSubscribers(priceUpdate);
    }

    const marketContext = this.generateMarketContext();
    if (marketContext) {
      this.lastMarketContext = marketContext;
      this.notifyMarketContextSubscribers(marketContext);
    }
  }

  /**
   * Get current mid-price (best bid + ask / 2)
   * Most accurate real-time price available
   */
  getMidPrice(): number {
    const orderbook = this.getOrderbook();
    if (!orderbook || orderbook.bids.length === 0 || orderbook.asks.length === 0) {
      return 0;
    }

    const bestBid = orderbook.bids[0].price;
    const bestAsk = orderbook.asks[0].price;
    return (bestBid + bestAsk) / 2;
  }

  /**
   * Get best bid and ask prices
   */
  getBestPrices(): { bid: number; ask: number } {
    const orderbook = this.getOrderbook();
    if (!orderbook || orderbook.bids.length === 0 || orderbook.asks.length === 0) {
      return { bid: 0, ask: 0 };
    }

    return {
      bid: orderbook.bids[0].price,
      ask: orderbook.asks[0].price,
    };
  }

  /**
   * Get bid-ask spread metrics
   */
  getSpread(): SpreadMetrics {
    const { bid, ask } = this.getBestPrices();

    if (bid === 0 || ask === 0) {
      return { dollars: 0, percent: 0, bps: 0 };
    }

    const midPrice = (bid + ask) / 2;
    const spreadDollars = ask - bid;
    const spreadPercent = (spreadDollars / midPrice) * 100;
    const spreadBps = spreadPercent * 100;

    return {
      dollars: spreadDollars,
      percent: spreadPercent,
      bps: spreadBps,
    };
  }

  /**
   * Get liquidity metrics at different price levels
   */
  getLiquidity(): LiquidityMetrics {
    const orderbook = this.getOrderbook();
    if (!orderbook || orderbook.bids.length === 0 || orderbook.asks.length === 0) {
      return {
        near: 0,
        medium: 0,
        far: 0,
        levels10Bps: 0,
        levels50Bps: 0,
        levels100Bps: 0,
      };
    }

    const midPrice = this.getMidPrice();
    const liquidity = {
      near: this.calculateLiquidityWithinPercent(midPrice, 0.1),
      medium: this.calculateLiquidityWithinPercent(midPrice, 0.5),
      far: this.calculateLiquidityWithinPercent(midPrice, 1.0),
      levels10Bps: this.calculateLiquidityWithinBps(midPrice, 10),
      levels50Bps: this.calculateLiquidityWithinBps(midPrice, 50),
      levels100Bps: this.calculateLiquidityWithinBps(midPrice, 100),
    };

    return liquidity;
  }

  /**
   * Calculate liquidity within a percentage of mid price
   */
  private calculateLiquidityWithinPercent(midPrice: number, percent: number): number {
    const orderbook = this.getOrderbook();
    if (!orderbook) return 0;

    const range = midPrice * (percent / 100);
    const lower = midPrice - range;
    const upper = midPrice + range;

    let totalSize = 0;

    // Add bids within range
    for (const level of orderbook.bids) {
      if (level.price >= lower) {
        totalSize += level.size;
      } else {
        break;
      }
    }

    // Add asks within range
    for (const level of orderbook.asks) {
      if (level.price <= upper) {
        totalSize += level.size;
      } else {
        break;
      }
    }

    return totalSize;
  }

  /**
   * Calculate liquidity within basis points of mid price
   */
  private calculateLiquidityWithinBps(midPrice: number, bps: number): number {
    const percent = bps / 100;
    return this.calculateLiquidityWithinPercent(midPrice, percent);
  }

  /**
   * Get market imbalance (-100 = all sellers, +100 = all buyers)
   */
  getImbalance(): number {
    const orderbook = this.getOrderbook();
    if (!orderbook || orderbook.bids.length === 0 || orderbook.asks.length === 0) {
      return 0;
    }

    // Calculate top 10 levels
    const topLevels = 10;
    let bidSize = 0;
    let askSize = 0;

    for (let i = 0; i < Math.min(topLevels, orderbook.bids.length); i++) {
      bidSize += orderbook.bids[i].size;
    }

    for (let i = 0; i < Math.min(topLevels, orderbook.asks.length); i++) {
      askSize += orderbook.asks[i].size;
    }

    const total = bidSize + askSize;
    if (total === 0) return 0;

    return ((bidSize - askSize) / total) * 100;
  }

  /**
   * Estimate execution price for a buy order
   * Walks through orderbook to find actual execution price
   */
  estimateExecutionPrice(side: 'buy' | 'sell', size: number): ExecutionEstimate {
    const orderbook = this.getOrderbook();
    if (!orderbook) {
      return {
        avgPrice: 0,
        worstPrice: 0,
        slippageBps: 0,
        levelsConsumed: 0,
        canFill: false,
        reason: 'No orderbook data',
      };
    }

    const levels = side === 'buy' ? orderbook.asks : orderbook.bids;
    if (levels.length === 0) {
      return {
        avgPrice: 0,
        worstPrice: 0,
        slippageBps: 0,
        levelsConsumed: 0,
        canFill: false,
        reason: 'No liquidity',
      };
    }

    let remainingSize = size;
    let totalCost = 0;
    let levelsConsumed = 0;
    let worstPrice = levels[0].price;

    // Walk through orderbook levels
    for (const level of levels) {
      if (remainingSize <= 0) break;

      const fillSize = Math.min(remainingSize, level.size);
      totalCost += fillSize * level.price;
      worstPrice = level.price;
      levelsConsumed++;
      remainingSize -= fillSize;
    }

    // Check if we could fill entire order
    const canFill = remainingSize <= 0;
    if (!canFill) {
      const unfillable = remainingSize;
      return {
        avgPrice: totalCost / (size - unfillable),
        worstPrice,
        slippageBps: 0,
        levelsConsumed,
        canFill: false,
        reason: `Only ${size - unfillable} of ${size} BTC available`,
      };
    }

    const avgPrice = totalCost / size;
    const midPrice = this.getMidPrice();
    const slippagePercent = Math.abs((avgPrice - midPrice) / midPrice) * 100;
    const slippageBps = slippagePercent * 100;

    return {
      avgPrice,
      worstPrice,
      slippageBps,
      levelsConsumed,
      canFill: true,
    };
  }

  /**
   * Get complete market context (used by strategies)
   */
  getMarketContext(): MarketContext | null {
    return this.lastMarketContext;
  }

  /**
   * Generate price update
   */
  private generatePriceUpdate(): PriceUpdate | null {
    const { bid, ask } = this.getBestPrices();

    if (bid === 0 || ask === 0) {
      return null;
    }

    const midPrice = (bid + ask) / 2;
    const spread = this.getSpread();

    return {
      productId: this.productId,
      timestamp: Date.now(),
      midPrice,
      bestBid: bid,
      bestAsk: ask,
      spread,
      source: 'L2',
    };
  }

  /**
   * Generate market context
   */
  private generateMarketContext(): MarketContext | null {
    const { bid, ask } = this.getBestPrices();

    if (bid === 0 || ask === 0) {
      return null;
    }

    const midPrice = (bid + ask) / 2;
    const spread = this.getSpread();
    const liquidity = this.getLiquidity();
    const imbalance = this.getImbalance();

    // Execution cost estimates for different sizes
    const executionCosts = {
      small: this.estimateExecutionPrice('buy', 0.01),
      medium: this.estimateExecutionPrice('buy', 0.1),
      large: this.estimateExecutionPrice('buy', 1.0),
    };

    // Market is healthy if:
    // - Spread < 0.1%
    // - Near liquidity > 0.5 BTC
    // - All sizes can fill
    const isHealthy =
      spread.percent < 0.1 &&
      liquidity.near > 0.5 &&
      executionCosts.small.canFill &&
      executionCosts.medium.canFill;

    return {
      productId: this.productId,
      timestamp: Date.now(),
      midPrice,
      lastPrice: midPrice,
      bestBid: bid,
      bestAsk: ask,
      spread,
      liquidity,
      executionCosts,
      imbalance,
      isHealthy,
    };
  }

  /**
   * Subscribe to price updates (called whenever price changes)
   */
  subscribeToPrice(callback: (update: PriceUpdate) => void): () => void {
    this.priceSubscribers.add(callback);

    // Return unsubscribe function
    return () => {
      this.priceSubscribers.delete(callback);
    };
  }

  /**
   * Subscribe to market context updates
   */
  subscribeToMarketContext(callback: (context: MarketContext) => void): () => void {
    this.marketContextSubscribers.add(callback);

    // Return unsubscribe function
    return () => {
      this.marketContextSubscribers.delete(callback);
    };
  }

  /**
   * Notify all price subscribers
   */
  private notifyPriceSubscribers(update: PriceUpdate) {
    this.priceSubscribers.forEach((callback) => {
      try {
        callback(update);
      } catch (error) {
      }
    });
  }

  /**
   * Notify all market context subscribers
   */
  private notifyMarketContextSubscribers(context: MarketContext) {
    this.marketContextSubscribers.forEach((callback) => {
      try {
        callback(context);
      } catch (error) {
      }
    });
  }

  /**
   * Get orderbook from store
   */
  private getOrderbook(): Orderbook | null {
    const state = (orderbookStore as any);
    if (!state || !state.bids || !state.asks) {
      return null;
    }

    return {
      productId: this.productId,
      bids: state.bids,
      asks: state.asks,
      sequence: state.sequence || 0,
      timestamp: Date.now(),
    };
  }

  /**
   * Get last known price (for when orderbook not available)
   */
  getLastPrice(): number {
    return this.lastPriceUpdate?.midPrice || 0;
  }

  /**
   * Check if price data is fresh (within last 5 seconds)
   */
  isFresh(): boolean {
    if (!this.lastPriceUpdate) return false;
    return Date.now() - this.lastPriceUpdate.timestamp < 5000;
  }

  /**
   * Cleanup subscribers
   */
  destroy() {
    // ✅ PHASE 8 FIX: Set destroyed flag to prevent callbacks
    this.destroyed = true;

    this.priceSubscribers.clear();
    this.marketContextSubscribers.clear();
  }
}

// Export singleton instance
export const l2PriceProvider = new L2PriceProvider('BTC-USD');
