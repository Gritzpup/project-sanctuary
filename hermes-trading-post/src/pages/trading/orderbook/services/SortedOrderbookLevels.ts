/**
 * @file SortedOrderbookLevels.ts
 * @description Optimized data structure for orderbook bid/ask levels
 * Part of Phase 1: Critical Performance Fixes
 *
 * Problem: Current approach sorts entire orderbook on every update (O(n log n))
 * When typically only 1-2 levels change out of 100+ levels, this is wasteful
 *
 * Solution: Maintain sorted order during insertions/updates (O(log n) per operation)
 * Binary search + insertion into pre-sorted array instead of full sort
 * Expected: 10-50x faster updates for typical 1-2 level changes
 */

/**
 * Sorted orderbook levels with binary search and O(log n) insertions
 * Maintains prices in either descending (bids) or ascending (asks) order
 */
export class SortedOrderbookLevels {
  private levels = new Map<number, number>(); // price -> size
  private sortedPrices: number[] = []; // Cache of prices in sorted order
  private isDirty = false; // Track if cache needs rebuild

  constructor(private isDescending: boolean = true) {}

  /**
   * Update a price level (price -> size)
   * Returns true if order was changed
   */
  set(price: number, size: number): boolean {
    const oldSize = this.levels.get(price);
    const sizeChanged = oldSize !== size;

    if (size > 0) {
      // Add or update level
      this.levels.set(price, size);

      // Only update sorted prices if this is a new price
      if (oldSize === undefined) {
        this.insertSortedPrice(price);
      }
    } else {
      // Remove level (size = 0)
      if (this.levels.has(price)) {
        this.levels.delete(price);
        this.removeSortedPrice(price);
      }
    }

    return sizeChanged || oldSize === undefined;
  }

  /**
   * Get size at price level
   */
  get(price: number): number | undefined {
    return this.levels.get(price);
  }

  /**
   * Get top N levels as sorted array of [price, size] tuples
   */
  topN(n: number): Array<[number, number]> {
    if (this.sortedPrices.length === 0) return [];

    const count = Math.min(n, this.sortedPrices.length);
    const result: Array<[number, number]> = [];

    for (let i = 0; i < count; i++) {
      const price = this.sortedPrices[i];
      const size = this.levels.get(price);
      if (size !== undefined) {
        result.push([price, size]);
      }
    }

    return result;
  }

  /**
   * Get all levels as sorted array of [price, size] tuples
   */
  getAll(): Array<[number, number]> {
    const result: Array<[number, number]> = [];
    for (const price of this.sortedPrices) {
      const size = this.levels.get(price);
      if (size !== undefined) {
        result.push([price, size]);
      }
    }
    return result;
  }

  /**
   * Get size at top level
   */
  getTopPrice(): number | null {
    return this.sortedPrices.length > 0 ? this.sortedPrices[0] : null;
  }

  /**
   * Get count of levels
   */
  getSize(): number {
    return this.levels.size;
  }

  /**
   * Clear all levels
   */
  clear(): void {
    this.levels.clear();
    this.sortedPrices = [];
  }

  /**
   * Replace all levels efficiently
   */
  setAll(levels: Array<[number, number]>): void {
    this.levels.clear();
    for (const [price, size] of levels) {
      if (size > 0) {
        this.levels.set(price, size);
      }
    }
    this.rebuildSortedPrices();
  }

  /**
   * Binary search: find insertion position for price
   */
  private findInsertPosition(price: number): number {
    let left = 0;
    let right = this.sortedPrices.length;

    while (left < right) {
      const mid = Math.floor((left + right) / 2);
      const midPrice = this.sortedPrices[mid];

      if (this.isDescending) {
        // For bids (descending): insert where price >= current
        if (price > midPrice) {
          right = mid;
        } else if (price < midPrice) {
          left = mid + 1;
        } else {
          return mid; // Price already exists
        }
      } else {
        // For asks (ascending): insert where price <= current
        if (price < midPrice) {
          right = mid;
        } else if (price > midPrice) {
          left = mid + 1;
        } else {
          return mid; // Price already exists
        }
      }
    }

    return left;
  }

  /**
   * Insert price into sorted array (O(log n) search + O(n) insert, but typically fast)
   */
  private insertSortedPrice(price: number): void {
    const pos = this.findInsertPosition(price);

    // Check if price already exists at this position
    if (pos < this.sortedPrices.length && this.sortedPrices[pos] === price) {
      return;
    }

    // Insert price at correct position
    this.sortedPrices.splice(pos, 0, price);
  }

  /**
   * Remove price from sorted array (O(log n) search + O(n) removal, but typically fast)
   */
  private removeSortedPrice(price: number): void {
    const pos = this.findInsertPosition(price);

    // Check if price exists at this position
    if (pos < this.sortedPrices.length && this.sortedPrices[pos] === price) {
      this.sortedPrices.splice(pos, 1);
    }
  }

  /**
   * Rebuild sorted prices array from map (fallback for corrupted state)
   */
  private rebuildSortedPrices(): void {
    const prices = Array.from(this.levels.keys());

    if (this.isDescending) {
      prices.sort((a, b) => b - a);
    } else {
      prices.sort((a, b) => a - b);
    }

    this.sortedPrices = prices;
  }
}
