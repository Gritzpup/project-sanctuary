/**
 * @file ChartTimeframeCoordinator.ts
 * @description Coordinates timeframe and granularity prop changes
 */

import type { ISeriesApi } from 'lightweight-charts';
import type { PluginManager } from '../plugins/base/PluginManager';
import { dataStore } from '../stores/dataStore.svelte';
import { statusStore } from '../stores/statusStore.svelte';
import { ChartDebug } from '../utils/debug';

/**
 * Dependencies for timeframe coordination
 */
export interface TimeframeCoordinatorDeps {
  dataLoader: any; // useDataLoader hook
  subscriptionOrchestrator: any; // ChartSubscriptionOrchestrator
  animationService: any; // ChartAnimationService
  prefetcher: any; // ChartPrefetcher
}

/**
 * Coordinates timeframe and granularity changes
 * Prevents duplicate reloads and orchestrates data/positioning/subscription updates
 */
export class ChartTimeframeCoordinator {
  private previousGranularity: string = '';
  private previousPeriod: string = '';
  private isReloading = false;
  private reloadTimeout: NodeJS.Timeout | null = null;

  // Dependencies (set via setDependencies)
  private dataLoader: any = null;
  private subscriptionOrchestrator: any = null;
  private animationService: any = null;
  private prefetcher: any = null;

  /**
   * Set dependencies for this coordinator
   * Allows flexible dependency injection
   * @param deps Dependencies object
   */
  setDependencies(deps: Partial<TimeframeCoordinatorDeps>): void {
    if (deps.dataLoader) this.dataLoader = deps.dataLoader;
    if (deps.subscriptionOrchestrator) this.subscriptionOrchestrator = deps.subscriptionOrchestrator;
    if (deps.animationService) this.animationService = deps.animationService;
    if (deps.prefetcher) this.prefetcher = deps.prefetcher;
  }

  /**
   * Initialize with previous values
   * Should be called once during component initialization
   * @param granularity Initial granularity
   * @param period Initial period
   */
  initialize(granularity: string, period: string): void {
    this.previousGranularity = granularity;
    this.previousPeriod = period;
    ChartDebug.log(`Timeframe coordinator initialized: ${granularity} / ${period}`);
  }

  /**
   * Handle granularity prop change
   * @param newGranularity New granularity value
   * @param chartSeries Chart series for subscription
   * @param pluginManager Plugin manager for refresh
   */
  async onGranularityChange(
    newGranularity: string,
    chartSeries: ISeriesApi<'Candlestick'> | null,
    pluginManager: PluginManager | null
  ): Promise<void> {
    ChartDebug.log(`🔍 onGranularityChange called: newGranularity=${newGranularity}, previousGranularity=${this.previousGranularity}`);

    if (newGranularity === this.previousGranularity) {
      ChartDebug.log(`⏭️ Granularity unchanged (${newGranularity}), skipping reload`);
      return; // No change
    }

    if (!this.shouldReload(newGranularity, this.previousPeriod)) {
      ChartDebug.log(`⏭️ shouldReload returned false for ${newGranularity}/${this.previousPeriod}`);
      return; // Skip reload
    }

    ChartDebug.log(`✅ Reloading data for new granularity: ${newGranularity}`);
    await this.reloadDataForNewTimeframe(
      newGranularity,
      this.previousPeriod,
      chartSeries,
      pluginManager
    );

    this.previousGranularity = newGranularity;
  }

  /**
   * Handle period prop change
   * @param newPeriod New period value
   * @param chartSeries Chart series for subscription
   * @param pluginManager Plugin manager for refresh
   */
  async onPeriodChange(
    newPeriod: string,
    chartSeries: ISeriesApi<'Candlestick'> | null,
    pluginManager: PluginManager | null
  ): Promise<void> {
    if (newPeriod === this.previousPeriod) {
      return; // No change
    }

    if (!this.shouldReload(this.previousGranularity, newPeriod)) {
      return; // Skip reload
    }

    // 🔧 FIX: Get the CORRECT granularity for the new period from the store
    // Don't use previousGranularity - use whatever is currently in chartStore.config
    // This handles race conditions where granularity updates race with period-change events
    const { chartStore: store } = await import('../stores/chartStore.svelte');
    const correctGranularity = store.config.granularity;

    await this.reloadDataForNewTimeframe(
      correctGranularity,
      newPeriod,
      chartSeries,
      pluginManager
    );

    this.previousPeriod = newPeriod;
    this.previousGranularity = correctGranularity; // Update our tracked granularity
  }

  /**
   * Check if reload is needed
   * Prevents reloads before initial data load
   * @param granularity Current granularity
   * @param period Current period
   * @returns True if reload should proceed
   */
  shouldReload(granularity: string, period: string): boolean {
    // Never reload if we haven't completed initial setup
    if (!this.previousGranularity || !this.previousPeriod) {
      return false;
    }

    // Reload if either changed
    return (
      granularity !== this.previousGranularity ||
      period !== this.previousPeriod
    );
  }

  /**
   * Reload data for new timeframe
   * Orchestrates unsubscribe -> load -> position -> resubscribe
   * @param granularity New granularity
   * @param period New period
   * @param chartSeries Chart series
   * @param pluginManager Plugin manager
   */
  async reloadDataForNewTimeframe(
    granularity: string,
    period: string,
    chartSeries: ISeriesApi<'Candlestick'> | null,
    pluginManager: PluginManager | null
  ): Promise<void> {
    ChartDebug.log(`[RELOAD-START] ${granularity}/${period} - initiating timeframe change`);
    const reloadStart = performance.now();

    // 🔧 CRITICAL FIX: Yield control to browser FIRST
    // This allows the UI thread to update status and prevents perceived "freeze"
    // Without this, the entire reload happens synchronously, blocking UI updates
    await new Promise(resolve => setTimeout(resolve, 0));
    ChartDebug.log(`[RELOAD-YIELDED] Browser yielded, now starting reload operations`);

    // 🔧 FIX: Don't block if a DIFFERENT timeframe is requested
    // Allow newer requests to override older ones
    if (this.isReloading) {
      // Check if this is a DIFFERENT reload request
      if (granularity === this.previousGranularity && period === this.previousPeriod) {
        return; // Same reload already in progress
      }

      // Wait for the previous reload to complete before starting this one
      // This prevents overlapping reloads which can corrupt state
      let waitCount = 0;
      while (this.isReloading && waitCount < 100) {
        await new Promise(resolve => setTimeout(resolve, 50));
        waitCount++;
      }
    }

    this.isReloading = true;

    try {
      statusStore.setLoading('Updating timeframe...');
      ChartDebug.log(`[RELOAD-STEP] Setting loading status`);

      // Clear any pending reload
      if (this.reloadTimeout) {
        clearTimeout(this.reloadTimeout);
        this.reloadTimeout = null;
      }

      // Unsubscribe from current real-time updates
      // This prevents real-time updates from interfering with historical data loading
      ChartDebug.log(`[RELOAD-STEP] Unsubscribing from realtime`);
      if (this.subscriptionOrchestrator) {
        this.subscriptionOrchestrator.unsubscribeFromRealtime();
      }
      ChartDebug.log(`[RELOAD-STEP] Unsubscribe complete`);

      // Clear old candles to prevent memory leaks and resolve conflicts
      // When granularity/timeframe changes, we need fresh data, not merged with old candles
      // For long-term timeframes, this also clears real-time candles to prevent
      // "Cannot update oldest data" errors when loading historical 5Y+ data
      ChartDebug.log(`[RELOAD-STEP] Resetting dataStore`);
      dataStore.reset();
      ChartDebug.log(`[RELOAD-STEP] Reset complete`);

      // Step 1.75: ✅ Update chartStore config BEFORE loading data
      // This ensures the chart's internal granularity setting matches the data being loaded
      // CRITICAL: Must be done before loadData() so hover tooltips show correct granularity
      const { chartStore } = await import('../stores/chartStore.svelte');
      chartStore.setGranularity(granularity);
      chartStore.setTimeframe(period);
      ChartDebug.log(`📝 chartStore updated: granularity=${granularity}, period=${period}`);

      // Load data with new timeframe
      if (this.dataLoader) {
        // Extract chart from series so we can use it for positioning
        let chart = null;
        if (chartSeries && typeof (chartSeries as any).getChart === 'function') {
          try {
            chart = (chartSeries as any).getChart();
          } catch (err) {
            ChartDebug.log(`⚠️ Failed to get chart from series: ${err}`);
          }
        }

        await this.dataLoader.loadData({
          pair: dataStore.pair || 'BTC-USD',
          granularity,
          timeframe: period,
          chart, // Pass the actual chart so positioning can work
          series: chartSeries
        });

        // Update database count after loading new data for the timeframe
        // This ensures the "DB" stat in the UI shows the correct total
        // available candles for the new granularity/timeframe
        await dataStore.updateDatabaseCount();
      }

      // Step 3: Track usage and update prefetch queue
      if (this.prefetcher) {
        this.prefetcher.trackUsage(dataStore.pair || 'BTC-USD', granularity);
      }

      // Step 4: Refresh all plugins after a delay (including volume candles for new granularity)
      // ⚡ PERF: Reduced delay from 500ms to 100ms for faster granularity switching
      if (pluginManager && typeof (pluginManager as any).refreshAll === 'function') {
        setTimeout(() => {
          ChartDebug.log(`🔄 Refreshing all plugins (volume candles for ${granularity})...`);
          (pluginManager as any).refreshAll(100);
        }, 100);
      }

      // Step 5: Fit chart to show all candles after positioning
      // For long-term timeframes (5Y, 1Y), useDataLoader handles fitContent at 500ms
      // For short-term, we still need to fit but after a short delay for positioning
      const longTermPeriods = ['1M', '3M', '6M', '1Y', '5Y'];
      const isLongTerm = longTermPeriods.includes(period);

      if (chartSeries && typeof (chartSeries as any).getChart === 'function' && !isLongTerm) {
        setTimeout(() => {
          try {
            const chart = (chartSeries as any).getChart();
            if (chart && typeof chart.timeScale === 'function') {
              // Fit the chart to show loaded candles
              chart.timeScale().fitContent();
              ChartDebug.log(`✅ Chart fitted to show ${dataStore.candles.length} candles`);
            }
          } catch (err) {
            ChartDebug.log(`⚠️ Failed to fit chart content: ${err}`);
          }
        }, 100);
      }

      // Step 6: Resubscribe to real-time after positioning completes
      // ⚡ PERF: Reduced delay from 600ms to 200ms for faster granularity switching
      if (this.subscriptionOrchestrator && chartSeries) {
        setTimeout(() => {
          this.subscriptionOrchestrator?.subscribeAfterPositioning(
            {
              pair: dataStore.pair || 'BTC-USD',
              granularity
            },
            chartSeries,
            pluginManager
          );
        }, 200);
      }

      statusStore.setReady();
    } catch (error) {
      console.error(`[ChartTimeframeCoordinator] Error during timeframe reload: ${granularity}/${period}`, error);
      statusStore.setError('Failed to update timeframe');
    } finally {
      this.isReloading = false;
    }
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    if (this.reloadTimeout) {
      clearTimeout(this.reloadTimeout);
      this.reloadTimeout = null;
    }

    this.dataLoader = null;
    this.subscriptionOrchestrator = null;
    this.animationService = null;
    this.prefetcher = null;
  }
}
