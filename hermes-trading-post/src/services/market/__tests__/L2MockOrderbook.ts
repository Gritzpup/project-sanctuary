/**
 * ✅ L2 CONSOLIDATION - Mock Orderbook for Testing
 *
 * Provides realistic mock orderbook data for unit and integration tests
 */

import type { OrderbookLevel, Orderbook } from '../../../types/market/L2Types';

export class L2MockOrderbook {
  private midPrice: number = 45000;
  private spreadBps: number = 5;  // 5 basis points
  private sequence: number = 0;

  /**
   * Generate realistic mock orderbook
   */
  static generateMockOrderbook(
    midPrice: number = 45000,
    spreadBps: number = 5,
    depth: number = 10
  ): Orderbook {
    const spread = midPrice * (spreadBps / 10000);
    const bestAsk = midPrice + spread / 2;
    const bestBid = midPrice - spread / 2;

    const bids: OrderbookLevel[] = [];
    const asks: OrderbookLevel[] = [];

    // Generate bid levels (going down)
    for (let i = 0; i < depth; i++) {
      const price = bestBid - i * (spread * 2);
      const size = (10 - i) * 0.05;  // Decreasing size
      bids.push({ price, size });
    }

    // Generate ask levels (going up)
    for (let i = 0; i < depth; i++) {
      const price = bestAsk + i * (spread * 2);
      const size = (10 - i) * 0.05;  // Decreasing size
      asks.push({ price, size });
    }

    return {
      productId: 'BTC-USD',
      bids,
      asks,
      sequence: Math.floor(Math.random() * 1000000),
      timestamp: Date.now(),
    };
  }

  /**
   * Generate realistic walk-through orderbook
   * For testing order fills at different sizes
   */
  static generateOrderbookForWalkthrough(
    basePrice: number = 45000,
    totalSize: number = 10
  ): Orderbook {
    const levels = 20;
    const priceStep = 0.5;  // $0.50 per level
    const asks: OrderbookLevel[] = [];

    // Create orderbook that can be walked through
    for (let i = 0; i < levels; i++) {
      const price = basePrice + priceStep * i;
      const size = totalSize / levels;  // Equal sizes
      asks.push({ price, size });
    }

    const bids: OrderbookLevel[] = [];
    for (let i = 0; i < levels; i++) {
      const price = basePrice - priceStep * i;
      const size = totalSize / levels;
      bids.push({ price, size });
    }

    return {
      productId: 'BTC-USD',
      bids,
      asks,
      sequence: 1,
      timestamp: Date.now(),
    };
  }

  /**
   * Generate wide-spread orderbook (poor liquidity)
   */
  static generateWidespreadOrderbook(
    midPrice: number = 45000,
    spreadBps: number = 100  // 100 bps = 1%
  ): Orderbook {
    return this.generateMockOrderbook(midPrice, spreadBps, 5);
  }

  /**
   * Generate tight-spread orderbook (good liquidity)
   */
  static generateTightspreadOrderbook(
    midPrice: number = 45000,
    spreadBps: number = 2  // 2 bps = 0.02%
  ): Orderbook {
    return this.generateMockOrderbook(midPrice, spreadBps, 20);
  }

  /**
   * Generate imbalanced orderbook (more sellers)
   */
  static generateImbalancedOrderbook(
    midPrice: number = 45000,
    bullish: boolean = true
  ): Orderbook {
    const ob = this.generateMockOrderbook(midPrice, 5, 10);

    if (bullish) {
      // More liquidity in bids (buyers supporting)
      ob.bids = ob.bids.map((level) => ({
        ...level,
        size: level.size * 2,
      }));
    } else {
      // More liquidity in asks (sellers dumping)
      ob.asks = ob.asks.map((level) => ({
        ...level,
        size: level.size * 2,
      }));
    }

    return ob;
  }

  /**
   * Generate illiquid orderbook (sparse levels)
   */
  static generateIlliquidOrderbook(
    midPrice: number = 45000
  ): Orderbook {
    const spread = midPrice * 0.002;  // 0.2%
    const bestAsk = midPrice + spread / 2;
    const bestBid = midPrice - spread / 2;

    return {
      productId: 'BTC-USD',
      bids: [
        { price: bestBid, size: 0.1 },
        { price: bestBid - 10, size: 0.05 },
      ],
      asks: [
        { price: bestAsk, size: 0.1 },
        { price: bestAsk + 10, size: 0.05 },
      ],
      sequence: 1,
      timestamp: Date.now(),
    };
  }

  /**
   * Simulate orderbook movement (price change)
   */
  static moveOrderbook(
    ob: Orderbook,
    priceChange: number  // Price change in dollars
  ): Orderbook {
    return {
      ...ob,
      bids: ob.bids.map((level) => ({
        ...level,
        price: level.price + priceChange,
      })),
      asks: ob.asks.map((level) => ({
        ...level,
        price: level.price + priceChange,
      })),
      sequence: ob.sequence + 1,
      timestamp: Date.now(),
    };
  }

  /**
   * Simulate orderbook size change (liquidity change)
   */
  static changeOrderbookLiquidity(
    ob: Orderbook,
    factor: number  // 0.5 = half liquidity, 2 = double liquidity
  ): Orderbook {
    return {
      ...ob,
      bids: ob.bids.map((level) => ({
        ...level,
        size: level.size * factor,
      })),
      asks: ob.asks.map((level) => ({
        ...level,
        size: level.size * factor,
      })),
      sequence: ob.sequence + 1,
      timestamp: Date.now(),
    };
  }

  /**
   * Simulate large buy order impact (asks consumed)
   */
  static simulateLargeBuyImpact(
    ob: Orderbook,
    buySize: number
  ): Orderbook {
    let remaining = buySize;
    const newAsks: OrderbookLevel[] = [];

    for (const level of ob.asks) {
      if (remaining <= 0) {
        newAsks.push(level);
        continue;
      }

      const filled = Math.min(remaining, level.size);
      const newSize = level.size - filled;

      if (newSize > 0) {
        newAsks.push({ ...level, size: newSize });
      }

      remaining -= filled;
    }

    return {
      ...ob,
      asks: newAsks,
      sequence: ob.sequence + 1,
      timestamp: Date.now(),
    };
  }

  /**
   * Create sequence of orderbooks for testing price movement
   */
  static generateSequence(
    startPrice: number = 45000,
    steps: number = 10,
    volatility: number = 10  // Max price change per step
  ): Orderbook[] {
    const sequence: Orderbook[] = [];
    let currentPrice = startPrice;

    for (let i = 0; i < steps; i++) {
      const priceChange = (Math.random() - 0.5) * 2 * volatility;
      currentPrice += priceChange;

      sequence.push(this.generateMockOrderbook(currentPrice, 5, 10));
    }

    return sequence;
  }
}

/**
 * Test data sets
 */
export const TEST_ORDERBOOKS = {
  // Standard scenarios
  normal: L2MockOrderbook.generateMockOrderbook(45000, 5, 10),
  tight: L2MockOrderbook.generateTightspreadOrderbook(),
  wide: L2MockOrderbook.generateWidespreadOrderbook(),
  illiquid: L2MockOrderbook.generateIlliquidOrderbook(),

  // Directional scenarios
  bullish: L2MockOrderbook.generateImbalancedOrderbook(45000, true),
  bearish: L2MockOrderbook.generateImbalancedOrderbook(45000, false),

  // Edge cases
  walkthrough: L2MockOrderbook.generateOrderbookForWalkthrough(45000, 10),
};

/**
 * Test utilities
 */
export const L2TestUtils = {
  /**
   * Generate price sequence
   */
  generatePriceSequence(
    startPrice: number = 45000,
    steps: number = 100
  ): number[] {
    const prices: number[] = [];
    let price = startPrice;

    for (let i = 0; i < steps; i++) {
      const change = (Math.random() - 0.5) * 20;
      price += change;
      prices.push(price);
    }

    return prices;
  },

  /**
   * Generate candle sequence
   */
  generateCandleSequence(
    startPrice: number = 45000,
    count: number = 100
  ) {
    const candles = [];
    let open = startPrice;

    for (let i = 0; i < count; i++) {
      const close = open + (Math.random() - 0.5) * 100;
      const high = Math.max(open, close) + Math.random() * 50;
      const low = Math.min(open, close) - Math.random() * 50;

      candles.push({
        time: Date.now() - (count - i) * 60000,
        open,
        high,
        low,
        close,
        spread: 0.005,
      });

      open = close;
    }

    return candles;
  },

  /**
   * Assert spread in range
   */
  assertSpreadInRange(
    actual: number,
    minBps: number,
    maxBps: number,
    message?: string
  ): void {
    if (actual < minBps || actual > maxBps) {
      throw new Error(
        `${message || 'Spread'} ${actual} bps not in range [${minBps}, ${maxBps}]`
      );
    }
  },

  /**
   * Assert execution quality
   */
  assertExecutionQuality(
    slippageBps: number,
    maxAcceptable: number = 50
  ): void {
    if (slippageBps > maxAcceptable) {
      throw new Error(`Slippage ${slippageBps} bps exceeds max ${maxAcceptable} bps`);
    }
  },
};
