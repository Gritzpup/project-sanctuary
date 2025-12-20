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
      console.log('⚠️ TypedArray optimization already enabled');
      return;
    }

    dataStore.enableTypedArrayOptimization();
    this.optimizationEnabled = true;
    console.log('✅ TypedArray memory optimization enabled globally');
  }

  /**
   * Disable TypedArray optimization
   */
  disableOptimization(): void {
    if (!this.optimizationEnabled) {
      console.log('⚠️ TypedArray optimization already disabled');
      return;
    }

    dataStore.disableTypedArrayOptimization();
    this.optimizationEnabled = false;
    console.log('❌ TypedArray optimization disabled');
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
    console.log('\n=== TypedArray Memory Statistics ===');
    const stats = this.getMemoryStats();

    console.log(`Status: ${stats.enabled ? '✅ ENABLED' : '❌ DISABLED'}`);
    console.log(`Total Entries: ${stats.totalEntries}`);

    if (stats.totalMemoryUsage > 0) {
      const memoryMB = (stats.totalMemoryUsage / 1024 / 1024).toFixed(2);
      console.log(`Memory Usage: ${memoryMB}MB`);
      console.log(`Utilization: ${stats.utilizationPercent}%`);
      console.log(`Compression: ${stats.compressionRatio}`);

      console.log('\nCached Datasets:');
      stats.entries.forEach(entry => {
        console.log(
          `  ${entry.key}: ${entry.candles} candles, ${(entry.memoryUsage / 1024).toFixed(1)}KB, ${entry.hits} hits`
        );
      });
    } else {
      console.log('No data cached yet');
    }

    console.log('==================================\n');
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

    console.log('\n=== Memory Savings Breakdown ===');
    const savings = this.getMemorySavings();
    console.log(`Object-based (estimated): ${(savings.estimated / 1024 / 1024).toFixed(2)}MB`);
    console.log(`TypedArray (actual): ${(savings.actual / 1024 / 1024).toFixed(2)}MB`);
    console.log(`Savings: ${(savings.saved / 1024 / 1024).toFixed(2)}MB (${savings.percent}%)`);
    console.log('================================\n');
  }

  /**
   * Auto-enable optimization on first candle load
   * Can be called on app startup
   */
  autoEnableOnFirstLoad(): void {
    console.log('⚠️ Auto-enable on first load: Not yet implemented');
    // This could be implemented by monitoring dataStore.stats.totalCount
    // and enabling optimization when first candles are loaded
  }
}

export const typedArrayOptimizer = new TypedArrayOptimizer();
