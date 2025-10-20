/**
 * Orderbook Store - Manages real-time level2 orderbook data for depth chart
 * Part of Phase 1: Critical Performance Fixes
 *
 * Optimization: Uses SortedOrderbookLevels for O(log n) updates instead of O(n log n) full sorts
 * For typical 1-2 level changes per update, this reduces update overhead by 10-50x
 */

import { SortedOrderbookLevels } from '../services/SortedOrderbookLevels';

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
  // ⚡ PERF: Use SortedOrderbookLevels for O(log n) incremental updates
  // Instead of: Map + full sort on every change (O(n log n))
  // Now: SortedOrderbookLevels with binary search insertions (O(log n))
  private bids = $state<SortedOrderbookLevels>(new SortedOrderbookLevels(true));  // Descending
  private asks = $state<SortedOrderbookLevels>(new SortedOrderbookLevels(false)); // Ascending

  // Cached sorted arrays - extracted from SortedOrderbookLevels on demand
  private _sortedBids = $state<Array<[number, number]>>([]);
  private _sortedAsks = $state<Array<[number, number]>>([]);
  private _lastBidVersion = 0;
  private _lastAskVersion = 0;

  // 🚀 PHASE 14c: Memoization caches for getBids/getAsks
  private _bidsMemoCache: Map<number, Array<{ price: number; size: number }>> = new Map();
  private _asksMemoCache: Map<number, Array<{ price: number; size: number }>> = new Map();
  private _lastBidsCacheVersion: number = 0;
  private _lastAsksCacheVersion: number = 0;

  public isReady = $state(false);
  public productId = $state('BTC-USD');

  // Price update subscribers - for chart to get instant L2 price updates
  private priceSubscribers: Set<(price: number) => void> = new Set();
  private _lastNotifiedMidPrice: number | null = null;  // Track last notified price to avoid redundant updates

  private _lastUpdateTime = 0;
  private _updateCount = 0;

  // Performance metrics for L2 WebSocket
  private _metrics = {
    snapshotCount: 0,
    updateCount: 0,
    totalLatency: 0,
    minLatency: Infinity,
    maxLatency: 0,
    avgLatency: 0,
    updatesPerSecond: 0,
    lastSecondTimestamp: Date.now(),
    updatesInCurrentSecond: 0
  };

  /**
   * Hydrate orderbook from cached Redis data (called on page load for instant display)
   * This allows the chart to show data immediately while waiting for WebSocket updates
   */
  async hydrateFromCache(productId: string = 'BTC-USD') {
    try {
      const response = await fetch(`/api/orderbook/${productId}`);

      if (!response.ok) {
        // PERF: Disabled - console.log(`⏭️ [Orderbook] No cached orderbook available (HTTP ${response.status})`);
        return;
      }

      const result = await response.json();

      if (!result.success || !result.data || result.data.bids.length === 0) {
        // PERF: Disabled - console.log(`⏭️ [Orderbook] Cached orderbook is empty or not ready yet`);
        return;
      }

      const cachedOrderbook = result.data;

      // PERF: Disabled - console.log(`💾 [Orderbook] Hydrating from cache: ${cachedOrderbook.bids.length} bids, ${cachedOrderbook.asks.length} asks`);

      // Process cached data as if it were a snapshot
      this.processSnapshot({
        product_id: cachedOrderbook.product_id || productId,
        bids: cachedOrderbook.bids,
        asks: cachedOrderbook.asks
      });

      // PERF: Disabled - console.log(`✅ [Orderbook] Cache hydration complete - chart should now display instantly!`);
    } catch (error) {
      // PERF: Disabled - console.error(`⚠️ [Orderbook] Failed to hydrate from cache:`, error);
      // Fail silently - app will still wait for WebSocket data
    }
  }

  /**
   * Process orderbook snapshot - optimized to detect actual changes
   */
  processSnapshot(data: { product_id: string; bids: OrderbookLevel[]; asks: OrderbookLevel[] }) {
    const now = Date.now();
    const timeSinceLastUpdate = now - this._lastUpdateTime;
    this._updateCount++;
    this._metrics.snapshotCount++;

    // Track updates per second
    if (now - this._metrics.lastSecondTimestamp >= 1000) {
      this._metrics.updatesPerSecond = this._metrics.updatesInCurrentSecond;
      this._metrics.updatesInCurrentSecond = 0;
      this._metrics.lastSecondTimestamp = now;

      // Performance metrics tracked but not logged
    }
    this._metrics.updatesInCurrentSecond++;

    // Update latency metrics
    if (this._lastUpdateTime > 0) {
      this._metrics.totalLatency += timeSinceLastUpdate;
      this._metrics.minLatency = Math.min(this._metrics.minLatency, timeSinceLastUpdate);
      this._metrics.maxLatency = Math.max(this._metrics.maxLatency, timeSinceLastUpdate);
      this._metrics.avgLatency = this._metrics.totalLatency / this._updateCount;
    }

    // Update tracking without console spam

    this._lastUpdateTime = now;

    this.productId = data.product_id;

    // Calculate mid-price for depth filtering (only if we have data)
    let midPrice = 0;
    if (data.bids.length > 0 && data.asks.length > 0) {
      midPrice = (data.bids[0].price + data.asks[0].price) / 2;
    }

    // Define depth limit: ±25000 absolute price range from mid-price
    const depthRange = 25000;
    const minPrice = midPrice - depthRange;
    const maxPrice = midPrice + depthRange;

    // Log only on first snapshot
    if (!this.isReady) {
      // PERF: Disabled - console.log(`📊 [Orderbook] Received snapshot: ${data.bids.length} bids, ${data.asks.length} asks`);
      if (midPrice > 0) {
        // PERF: Disabled - console.log(`📊 [Orderbook] Filtering to ±$${depthRange.toLocaleString()} of mid-price $${midPrice.toFixed(2)} (range: $${minPrice.toFixed(2)}-$${maxPrice.toFixed(2)})`);
      }
    }

    // Track if data actually changed
    let bidsChanged = false;
    let asksChanged = false;

    // Smart update for bids - only if different AND within depth limit
    const newBidsArray: Array<[number, number]> = [];
    let filteredBidCount = 0;
    for (let i = 0; i < data.bids.length; i++) {
      const level = data.bids[i];
      if (level.size > 0) {
        // Only keep bids within ±$25,000 of mid-price
        if (midPrice === 0 || level.price >= minPrice) {
          newBidsArray.push([level.price, level.size]);
        } else {
          filteredBidCount++;
        }
      }
    }

    // Check if bids actually changed
    const oldBidsArray = this.bids.getAll();
    if (!this.isReady && newBidsArray.length < 100) {
      // PERF: Disabled - console.log(`📊 [DEBUG] newBids.size=${newBidsArray.length}, this.bids.size=${oldBidsArray.length}, filtered=${filteredBidCount}`);
    }
    if (newBidsArray.length !== oldBidsArray.length) {
      bidsChanged = true;
    } else {
      for (let i = 0; i < newBidsArray.length; i++) {
        if (newBidsArray[i][0] !== oldBidsArray[i][0] || newBidsArray[i][1] !== oldBidsArray[i][1]) {
          bidsChanged = true;
          break;
        }
      }
    }

    // Smart update for asks - only if different AND within depth limit
    const newAsksArray: Array<[number, number]> = [];
    let filteredAskCount = 0;
    for (let i = 0; i < data.asks.length; i++) {
      const level = data.asks[i];
      if (level.size > 0) {
        // Only keep asks within ±$25,000 of mid-price
        if (midPrice === 0 || level.price <= maxPrice) {
          newAsksArray.push([level.price, level.size]);
        } else {
          filteredAskCount++;
        }
      }
    }

    // Check if asks actually changed
    const oldAsksArray = this.asks.getAll();
    if (newAsksArray.length !== oldAsksArray.length) {
      asksChanged = true;
    } else {
      for (let i = 0; i < newAsksArray.length; i++) {
        if (newAsksArray[i][0] !== oldAsksArray[i][0] || newAsksArray[i][1] !== oldAsksArray[i][1]) {
          asksChanged = true;
          break;
        }
      }
    }

    // Log filtering stats on first snapshot or significant changes
    if (!this.isReady && (filteredBidCount > 0 || filteredAskCount > 0)) {
      // PERF: Disabled - console.log(`📊 [Orderbook] Filtered out ${filteredBidCount} bids and ${filteredAskCount} asks beyond ±$${depthRange.toLocaleString()} depth`);
      // PERF: Disabled - console.log(`📊 [Orderbook] Keeping ${newBidsArray.length} bids and ${newAsksArray.length} asks in memory`);
    }

    // ⚡ PERF: Update SortedOrderbookLevels (maintains sorted order automatically)
    // Instead of: Map + full sort each update
    // Now: Binary search insertions (O(log n) per level change)
    if (!this.isReady || bidsChanged) {
      this.bids.setAll(newBidsArray);
    }

    if (!this.isReady || asksChanged) {
      this.asks.setAll(newAsksArray);
    }

    // Cache sorted arrays from SortedOrderbookLevels for fast access
    if (!this.isReady || bidsChanged) {
      this._sortedBids = this.bids.getAll();
      this._lastBidVersion++;
    }

    if (!this.isReady || asksChanged) {
      this._sortedAsks = this.asks.getAll();
      this._lastAskVersion++;
    }

    this.isReady = true;

    // Notify price subscribers if data changed
    if (bidsChanged || asksChanged) {
      this.notifyPriceSubscribers();
    }
  }

  // Note: _updateSortedBids and _updateSortedAsks removed
  // Sorted arrays are now maintained by SortedOrderbookLevels with O(log n) operations
  // See SortedOrderbookLevels class for implementation details

  /**
   * Process incremental orderbook update
   */
  processUpdate(data: { product_id: string; changes: Array<{ side: string; price: number; size: number }> }) {
    if (!this.isReady) {
      return;
    }

    const now = Date.now();
    const timeSinceLastUpdate = now - this._lastUpdateTime;
    this._updateCount++;
    this._metrics.updateCount++;

    // Track updates per second
    if (now - this._metrics.lastSecondTimestamp >= 1000) {
      this._metrics.updatesPerSecond = this._metrics.updatesInCurrentSecond;
      this._metrics.updatesInCurrentSecond = 0;
      this._metrics.lastSecondTimestamp = now;

      // Performance metrics tracked but not logged
    }
    this._metrics.updatesInCurrentSecond++;

    // Update latency metrics
    if (this._lastUpdateTime > 0) {
      this._metrics.totalLatency += timeSinceLastUpdate;
      this._metrics.minLatency = Math.min(this._metrics.minLatency, timeSinceLastUpdate);
      this._metrics.maxLatency = Math.max(this._metrics.maxLatency, timeSinceLastUpdate);
      this._metrics.avgLatency = this._metrics.totalLatency / this._updateCount;
    }

    // Update tracking without console spam

    this._lastUpdateTime = now;

    // Calculate current mid-price for depth filtering
    let midPrice = 0;
    if (this._sortedBids.length > 0 && this._sortedAsks.length > 0) {
      midPrice = (this._sortedBids[0][0] + this._sortedAsks[0][0]) / 2;
    }

    // Define depth limit: ±25000 absolute price range from mid-price
    const depthRange = 25000;
    const minPrice = midPrice - depthRange;
    const maxPrice = midPrice + depthRange;

    let bidsChanged = false;
    let asksChanged = false;
    let filteredUpdateCount = 0;

    data.changes.forEach(change => {
      const { side, price, size } = change;

      if (side === 'buy' || side === 'bid') {
        // Skip bid updates that are too far from mid-price
        if (midPrice > 0 && price < minPrice) {
          filteredUpdateCount++;
          // Also remove from our SortedOrderbookLevels if it exists
          if (this.bids.set(price, 0)) {
            bidsChanged = true;
          }
          return;
        }

        // ⚡ PERF: SortedOrderbookLevels.set() returns true if changed
        // Automatically maintains sorted order (O(log n) operation)
        const oldSize = this.bids.get(price);
        if (size === 0) {
          if (this.bids.set(price, 0)) {
            bidsChanged = true;
          }
        } else if (oldSize !== size) {
          if (this.bids.set(price, size)) {
            bidsChanged = true;
          }
        }
      } else if (side === 'sell' || side === 'offer' || side === 'ask') {
        // Skip ask updates that are too far from mid-price
        if (midPrice > 0 && price > maxPrice) {
          filteredUpdateCount++;
          // Also remove from our SortedOrderbookLevels if it exists
          if (this.asks.set(price, 0)) {
            asksChanged = true;
          }
          return;
        }

        // ⚡ PERF: SortedOrderbookLevels.set() returns true if changed
        // Automatically maintains sorted order (O(log n) operation)
        const oldSize = this.asks.get(price);
        if (size === 0) {
          if (this.asks.set(price, 0)) {
            asksChanged = true;
          }
        } else if (oldSize !== size) {
          if (this.asks.set(price, size)) {
            asksChanged = true;
          }
        }
      }
    });

    // Also cleanup levels that have drifted beyond our depth limit
    if (midPrice > 0) {
      // Clean up bids that are now too far
      const bidsToRemove: number[] = [];
      for (const [price] of this.bids.getAll()) {
        if (price < minPrice) {
          bidsToRemove.push(price);
        }
      }
      for (const price of bidsToRemove) {
        if (this.bids.set(price, 0)) {
          bidsChanged = true;
          filteredUpdateCount++;
        }
      }

      // Clean up asks that are now too far
      const asksToRemove: number[] = [];
      for (const [price] of this.asks.getAll()) {
        if (price > maxPrice) {
          asksToRemove.push(price);
        }
      }
      for (const price of asksToRemove) {
        if (this.asks.set(price, 0)) {
          asksChanged = true;
          filteredUpdateCount++;
        }
      }
    }

    // ⚡ PERF: Cache sorted arrays from SortedOrderbookLevels for next iteration
    // Only extract when data changed (no expensive sort operation needed!)
    if (bidsChanged) {
      this._sortedBids = this.bids.getAll();
      this._lastBidVersion++;
    }
    if (asksChanged) {
      this._sortedAsks = this.asks.getAll();
      this._lastAskVersion++;
    }

    // Notify price subscribers if either side changed
    if (bidsChanged || asksChanged) {
      this.notifyPriceSubscribers();
    }
  }

  /**
   * 🚀 PERF: Process orderbook deltas from Redis Pub/Sub
   * ⚡ OPTIMIZED: Only updates individual price levels with O(log n) operations
   * No full re-sort needed - SortedOrderbookLevels maintains sort order during updates
   */
  processDelta(data: { bids: Array<{price: number, size: number}>; asks: Array<{price: number, size: number}> }) {
    let bidsChanged = false;
    let asksChanged = false;

    // Update changed bid levels - each update is O(log n) not O(n log n)
    data.bids.forEach(({price, size}) => {
      const oldSize = this.bids.get(price);
      if (oldSize !== size) {
        // SortedOrderbookLevels.set() maintains sort order automatically
        if (this.bids.set(price, size)) {
          bidsChanged = true;
        }
      }
    });

    // Update changed ask levels - each update is O(log n) not O(n log n)
    data.asks.forEach(({price, size}) => {
      const oldSize = this.asks.get(price);
      if (oldSize !== size) {
        // SortedOrderbookLevels.set() maintains sort order automatically
        if (this.asks.set(price, size)) {
          asksChanged = true;
        }
      }
    });

    // Cache sorted arrays - no expensive sort operation needed!
    if (bidsChanged) {
      this._sortedBids = this.bids.getAll();
      this._lastBidVersion++;
    }
    if (asksChanged) {
      this._sortedAsks = this.asks.getAll();
      this._lastAskVersion++;
    }

    // Notify subscribers
    if (bidsChanged || asksChanged) {
      this.notifyPriceSubscribers();
    }
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
    // Use cached sorted arrays
    const sortedBids = this._sortedBids.slice(0, maxLevels);
    const sortedAsks = this._sortedAsks.slice(0, maxLevels);

    if (sortedBids.length === 0 || sortedAsks.length === 0) {
      // PERF: Disabled - console.warn(`📊 [OrderbookStore] getDepthData sliced empty: sortedBids=${sortedBids.length} (total=${this._sortedBids.length}), sortedAsks=${sortedAsks.length} (total=${this._sortedAsks.length}), maxLevels=${maxLevels}`);
    }

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

    if (bidsWithDepth.length === 0 || asksWithDepth.length === 0) {
      // PERF: Disabled - console.warn(`📊 [OrderbookStore] returning empty depth: bids=${bidsWithDepth.length}, asks=${asksWithDepth.length}`);
    }
    return { bids: bidsWithDepth, asks: asksWithDepth };
  }

  /**
   * Get current orderbook summary - uses cached arrays
   */
  get summary(): Orderbook {
    const bestBid = this._sortedBids.length > 0 ? this._sortedBids[0][0] : 0;
    const bestAsk = this._sortedAsks.length > 0 ? this._sortedAsks[0][0] : 0;
    const spread = bestAsk > 0 && bestBid > 0 ? bestAsk - bestBid : 0;

    return {
      bids: this._sortedBids.slice(0, 20).map(([price, size]) => ({ price, size })),
      asks: this._sortedAsks.slice(0, 20).map(([price, size]) => ({ price, size })),
      spread,
      bestBid,
      bestAsk
    };
  }

  /**
   * Reset orderbook state
   */
  reset() {
    this.bids.clear();
    this.asks.clear();
    this._sortedBids = [];
    this._sortedAsks = [];
    this._lastBidVersion = 0;
    this._lastAskVersion = 0;
    this.isReady = false;
  }

  /**
   * Get top N bids for orderbook list display - uses cached sorted array
   * 🚀 PHASE 14c: Memoized to avoid repeated slicing and mapping
   */
  getBids(count: number = 10): Array<{ price: number; size: number }> {
    // Check cache: if data hasn't changed and count is same, return cached result
    if (this._lastBidsCacheVersion === this._lastBidVersion) {
      const cached = this._bidsMemoCache.get(count);
      if (cached) {
        return cached;
      }
    }

    // Cache miss or data changed: recalculate
    const result = this._sortedBids
      .slice(0, count)
      .map(([price, size]) => ({ price, size }));

    // Update cache
    this._bidsMemoCache.set(count, result);
    this._lastBidsCacheVersion = this._lastBidVersion;

    // 🚀 PHASE 14c: Clean up old cache entries if too many
    if (this._bidsMemoCache.size > 5) {
      const keys = Array.from(this._bidsMemoCache.keys());
      for (let i = 0; i < keys.length - 5; i++) {
        this._bidsMemoCache.delete(keys[i]);
      }
    }

    return result;
  }

  /**
   * Get top N asks for orderbook list display - uses cached sorted array
   * 🚀 PHASE 14c: Memoized to avoid repeated slicing and mapping
   */
  getAsks(count: number = 10): Array<{ price: number; size: number }> {
    // Check cache: if data hasn't changed and count is same, return cached result
    if (this._lastAsksCacheVersion === this._lastAskVersion) {
      const cached = this._asksMemoCache.get(count);
      if (cached) {
        return cached;
      }
    }

    // Cache miss or data changed: recalculate
    const result = this._sortedAsks
      .slice(0, count)
      .map(([price, size]) => ({ price, size }));

    // Update cache
    this._asksMemoCache.set(count, result);
    this._lastAsksCacheVersion = this._lastAskVersion;

    // 🚀 PHASE 14c: Clean up old cache entries if too many
    if (this._asksMemoCache.size > 5) {
      const keys = Array.from(this._asksMemoCache.keys());
      for (let i = 0; i < keys.length - 5; i++) {
        this._asksMemoCache.delete(keys[i]);
      }
    }

    return result;
  }

  /**
   * Get version numbers for change detection
   */
  get versions() {
    return {
      bids: this._lastBidVersion,
      asks: this._lastAskVersion
    };
  }

  /**
   * Get performance metrics for L2 WebSocket
   */
  get metrics() {
    return {
      ...this._metrics,
      totalUpdates: this._updateCount,
      isReady: this.isReady
    };
  }

  /**
   * Subscribe to instant price updates from L2 data (best bid/ask midpoint)
   * This provides faster price updates than candle/ticker data
   */
  subscribeToPriceUpdates(callback: (price: number) => void): () => void {
    this.priceSubscribers.add(callback);

    // Immediately notify with current price if available
    if (this._sortedBids.length > 0 && this._sortedAsks.length > 0) {
      const bestBid = this._sortedBids[0][0];
      const bestAsk = this._sortedAsks[0][0];
      const midPrice = (bestBid + bestAsk) / 2;
      callback(midPrice);
    }

    // Return unsubscribe function
    return () => {
      this.priceSubscribers.delete(callback);
    };
  }

  /**
   * Notify all price subscribers with current midpoint price
   * Only notifies if price actually changed to avoid redundant updates
   */
  private notifyPriceSubscribers() {
    if (this._sortedBids.length > 0 && this._sortedAsks.length > 0) {
      const bestBid = this._sortedBids[0][0];
      const bestAsk = this._sortedAsks[0][0];
      const midPrice = (bestBid + bestAsk) / 2;

      // Only notify if price actually changed
      if (this._lastNotifiedMidPrice === midPrice) {
        return;  // Skip redundant notifications
      }

      this._lastNotifiedMidPrice = midPrice;

      // Notify all subscribers
      this.priceSubscribers.forEach(callback => {
        try {
          callback(midPrice);
        } catch (error) {
          // PERF: Disabled - console.error('Error in price subscriber callback:', error);
        }
      });
    }
  }
}

export const orderbookStore = new OrderbookStore();
