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

    await this.reloadDataForNewTimeframe(
      this.previousGranularity,
      newPeriod,
      chartSeries,
      pluginManager
    );

    this.previousPeriod = newPeriod;
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
    if (this.isReloading) {
      return; // Prevent concurrent reloads
    }

    this.isReloading = true;

    try {
      statusStore.setLoading('Updating timeframe...');

      // Clear any pending reload
      if (this.reloadTimeout) {
        clearTimeout(this.reloadTimeout);
        this.reloadTimeout = null;
      }

      // Step 1: Unsubscribe from current real-time updates
      if (this.subscriptionOrchestrator) {
        this.subscriptionOrchestrator.unsubscribeFromRealtime();
      }

      // Step 1.5: ✅ PHASE 2 - Clear old candles to prevent memory leaks
      // When granularity changes, we need fresh data, not merged with old candles
      dataStore.reset();
      ChartDebug.log(`🧹 DataStore reset for granularity change (old data cleared)`);

      // Step 1.75: ✅ Update chartStore config BEFORE loading data
      // This ensures the chart's internal granularity setting matches the data being loaded
      // CRITICAL: Must be done before loadData() so hover tooltips show correct granularity
      const { chartStore } = await import('../stores/chartStore.svelte');
      chartStore.setGranularity(granularity);
      chartStore.setTimeframe(period);
      ChartDebug.log(`📝 chartStore updated: granularity=${granularity}, period=${period}`);

      // Step 2: Load data with new timeframe
      if (this.dataLoader) {
        await this.dataLoader.loadData({
          pair: dataStore.pair || 'BTC-USD',
          granularity,
          timeframe: period,
          chart: null, // Will be set if needed
          series: chartSeries
        });

        ChartDebug.log(`Data loaded for ${granularity} ${period}`);

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
      if (pluginManager && typeof (pluginManager as any).refreshAll === 'function') {
        setTimeout(() => {
          ChartDebug.log(`🔄 Refreshing all plugins (volume candles for ${granularity})...`);
          (pluginManager as any).refreshAll(500);
        }, 500);
      }

      // Step 5: Fit chart to show all candles after positioning
      // Don't try to position with null chart - just let fitContent handle it
      if (chartSeries && typeof (chartSeries as any).getChart === 'function') {
        setTimeout(() => {
          try {
            const chart = (chartSeries as any).getChart();
            if (chart && typeof chart.timeScale === 'function') {
              // Fit the chart to show all loaded candles
              chart.timeScale().fitContent();
              ChartDebug.log(`✅ Chart fitted to show all ${dataStore.candles.length} candles`);
            }
          } catch (err) {
            ChartDebug.log(`⚠️ Failed to fit chart content: ${err}`);
          }
        }, 100);
      }

      // Step 6: Resubscribe to real-time after positioning completes
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
        }, 600);
      }

      statusStore.setReady();
      ChartDebug.log(`✅ Timeframe reload complete: ${granularity} ${period}`);
    } catch (error) {
      console.error('Failed to reload data for new timeframe:', error);
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
