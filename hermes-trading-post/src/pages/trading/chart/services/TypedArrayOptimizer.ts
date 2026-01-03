/**
 * @file TypedArrayOptimizer.ts
 * @description Utility to enable and monitor TypedArray memory optimization
 * Part of Phase 2: Memory Optimization
 *
 * Usage in components:
 * ```
 * import { typedArrayOptimizer } from '...'
 *
 * // On app startup or when you want to enable
 * typedArrayOptimizer.enableOptimization();
 *
 * // Monitor memory usage
 * typedArrayOptimizer.logMemoryStats();
 * ```
 */

import { dataStore, typedArrayCache } from '../stores/dataStore.svelte';

export class TypedArrayOptimizer {
  private optimizationEnabled = false;

  /**
   * Enable TypedArray optimization globally
   */
  enableOptimization(): void {
    if (this.optimizationEnabled) {
      return;
    }

    dataStore.enableTypedArrayOptimization();
    this.optimizationEnabled = true;
  }

  /**
   * Disable TypedArray optimization
   */
  disableOptimization(): void {
    if (!this.optimizationEnabled) {
      return;
    }

    dataStore.disableTypedArrayOptimization();
    this.optimizationEnabled = false;
  }

  /**
   * Check if optimization is enabled
   */
  isEnabled(): boolean {
    return this.optimizationEnabled;
  }

  /**
   * Get current memory statistics
   */
  getMemoryStats() {
    return dataStore.getCacheStats();
  }

  /**
   * Log memory statistics to console
   */
  logMemoryStats(): void {
    const stats = this.getMemoryStats();


    if (stats.totalMemoryUsage > 0) {
      // Memory stats available
      stats.entries.forEach(() => {
        // Process each entry
      });
    }

  }

  /**
   * Get estimated memory savings
   */
  getMemorySavings(): { actual: number; estimated: number; saved: number; percent: string } {
    const stats = this.getMemoryStats();
    const totalCandles = stats.entries.reduce((sum, e) => sum + e.candles, 0);

    const estimatedObjectBased = totalCandles * 250; // ~250 bytes per candle
    const saved = estimatedObjectBased - stats.totalMemoryUsage;

    return {
      actual: stats.totalMemoryUsage,
      estimated: estimatedObjectBased,
      saved,
      percent: totalCandles > 0 ? ((saved / estimatedObjectBased) * 100).toFixed(1) : 'N/A'
    };
  }

  /**
   * Print detailed optimization report
   */
  printDetailedReport(): void {
    dataStore.printCacheReport();

    const savings = this.getMemorySavings();
  }

  /**
   * Auto-enable optimization on first candle load
   * Can be called on app startup
   */
  autoEnableOnFirstLoad(): void {
    // This could be implemented by monitoring dataStore.stats.totalCount
    // and enabling optimization when first candles are loaded
  }
}

export const typedArrayOptimizer = new TypedArrayOptimizer();
