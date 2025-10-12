/**
 * Orderbook Store - Manages real-time level2 orderbook data for depth chart
 */

export interface OrderbookLevel {
  price: number;
  size: number;
}

export interface Orderbook {
  bids: OrderbookLevel[];  // Buy orders (sorted descending by price)
  asks: OrderbookLevel[];  // Sell orders (sorted ascending by price)
  spread: number;          // Difference between best ask and best bid
  bestBid: number;         // Highest buy price
  bestAsk: number;         // Lowest sell price
}

class OrderbookStore {
  private bids = $state<Map<number, number>>(new Map());  // price -> size
  private asks = $state<Map<number, number>>(new Map());  // price -> size

  public isReady = $state(false);
  public productId = $state('BTC-USD');

  /**
   * Process orderbook snapshot (initial full state)
   */
  processSnapshot(data: { product_id: string; bids: OrderbookLevel[]; asks: OrderbookLevel[] }) {
    console.log(`📊 Processing orderbook snapshot for ${data.product_id}:`, {
      bids: data.bids.length,
      asks: data.asks.length
    });

    this.productId = data.product_id;
    this.bids = new Map();
    this.asks = new Map();

    // Build bid side
    data.bids.forEach(level => {
      if (level.size > 0) {
        this.bids.set(level.price, level.size);
      }
    });

    // Build ask side
    data.asks.forEach(level => {
      if (level.size > 0) {
        this.asks.set(level.price, level.size);
      }
    });

    this.isReady = true;
  }

  /**
   * Process incremental orderbook update
   */
  processUpdate(data: { product_id: string; changes: Array<{ side: string; price: number; size: number }> }) {
    if (!this.isReady) {
      console.warn('⚠️ Received update before snapshot, ignoring');
      return;
    }

    data.changes.forEach(change => {
      const { side, price, size } = change;

      if (side === 'buy' || side === 'bid') {
        if (size === 0) {
          this.bids.delete(price);  // Remove price level
        } else {
          this.bids.set(price, size);  // Update price level
        }
      } else if (side === 'sell' || side === 'offer') {
        if (size === 0) {
          this.asks.delete(price);  // Remove price level
        } else {
          this.asks.set(price, size);  // Update price level
        }
      }
    });
  }

  /**
   * Get formatted orderbook data for depth chart
   * Returns top N levels on each side with cumulative depth
   *
   * FORMAT: Two hills meeting in valley ---\ /---
   * - Bids: Cumulative depth INCREASES going LEFT (away from spread)
   * - Asks: Cumulative depth INCREASES going RIGHT (away from spread)
   * - Creates valley at current price (spread)
   */
  getDepthData(maxLevels: number = 150): { bids: Array<{ price: number; depth: number }>; asks: Array<{ price: number; depth: number }> } {
    // Get and sort bids (highest price first = closest to spread)
    const sortedBids = Array.from(this.bids.entries())
      .sort(([priceA], [priceB]) => priceB - priceA)  // Descending (high to low)
      .slice(0, maxLevels);

    // Get and sort asks (lowest price first = closest to spread)
    const sortedAsks = Array.from(this.asks.entries())
      .sort(([priceA], [priceB]) => priceA - priceB)  // Ascending (low to high)
      .slice(0, maxLevels);

    // Calculate cumulative depth for BIDS starting from best bid (highest price)
    // Going OUTWARD (toward lower prices), accumulating depth
    // This creates the rising hill: low depth near spread → high depth far away
    let cumulativeDepth = 0;
    const bidsWithDepth = sortedBids.map(([price, size]) => {
      cumulativeDepth += size;
      return { price, depth: cumulativeDepth };
    }).reverse();  // Reverse so lowest price (highest depth) is first for charting

    // Calculate cumulative depth for ASKS starting from best ask (lowest price)
    // Going OUTWARD (toward higher prices), accumulating depth
    // This creates the rising hill: low depth near spread → high depth far away
    cumulativeDepth = 0;
    const asksWithDepth = sortedAsks.map(([price, size]) => {
      cumulativeDepth += size;
      return { price, depth: cumulativeDepth };
    });

    return { bids: bidsWithDepth, asks: asksWithDepth };
  }

  /**
   * Get current orderbook summary
   */
  get summary(): Orderbook {
    const sortedBids = Array.from(this.bids.entries())
      .sort(([priceA], [priceB]) => priceB - priceA);

    const sortedAsks = Array.from(this.asks.entries())
      .sort(([priceA], [priceB]) => priceA - priceB);

    const bestBid = sortedBids.length > 0 ? sortedBids[0][0] : 0;
    const bestAsk = sortedAsks.length > 0 ? sortedAsks[0][0] : 0;
    const spread = bestAsk > 0 && bestBid > 0 ? bestAsk - bestBid : 0;

    return {
      bids: sortedBids.slice(0, 20).map(([price, size]) => ({ price, size })),
      asks: sortedAsks.slice(0, 20).map(([price, size]) => ({ price, size })),
      spread,
      bestBid,
      bestAsk
    };
  }

  /**
   * Reset orderbook state
   */
  reset() {
    this.bids = new Map();
    this.asks = new Map();
    this.isReady = false;
  }

  /**
   * Get top N bids for orderbook list display
   */
  getBids(count: number = 10): Array<{ price: number; size: number }> {
    return Array.from(this.bids.entries())
      .sort(([priceA], [priceB]) => priceB - priceA) // Highest first
      .slice(0, count)
      .map(([price, size]) => ({ price, size }));
  }

  /**
   * Get top N asks for orderbook list display
   */
  getAsks(count: number = 10): Array<{ price: number; size: number }> {
    return Array.from(this.asks.entries())
      .sort(([priceA], [priceB]) => priceA - priceB) // Lowest first
      .slice(0, count)
      .map(([price, size]) => ({ price, size }));
  }
}

export const orderbookStore = new OrderbookStore();
