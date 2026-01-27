/**
 * @file ChartReadinessOrchestrator.ts
 * @description Coordinates chart readiness and plugin initialization
 */

import type { IChartApi, ISeriesApi } from 'lightweight-charts';
import type { PluginManager } from '../plugins/base/PluginManager';
import { dataStore } from '../stores/dataStore.svelte';
import { chartStore } from '../stores/chartStore.svelte';
import { statusStore } from '../stores/statusStore.svelte';
import { ChartDebug } from '../utils/debug';

/**
 * Configuration for chart readiness handling
 */
export interface ChartReadinessConfig {
  pair: string;
  granularity: string;
  enableAutoGranularity?: boolean;
}

/**
 * Orchestrates chart readiness coordination between plugins and data
 * Manages the complex timing of plugin initialization and real-time subscription
 */
export class ChartReadinessOrchestrator {
  private waitingForDataTimeout: NodeJS.Timeout | null = null;
  private pluginRefreshTimeout: NodeJS.Timeout | null = null;

  /**
   * Handle chart ready event with proper initialization sequencing
   * Orchestrates plugin setup, data readiness, and subscription timing
   * @param chart Chart API instance
   * @param pluginManager Plugin manager instance
   * @param enablePlugins Whether plugins are enabled
   * @param enableAutoGranularity Whether auto-granularity is enabled
   * @param onReady Callback when chart is fully ready
   */
  async handleChartReady(
    chart: IChartApi,
    pluginManager: PluginManager | null,
    enablePlugins: boolean,
    enableAutoGranularity: boolean,
    onReady?: (chart: IChartApi) => void
  ): Promise<void> {
    try {
      // Step 1: Initialize plugin manager if enabled
      if (enablePlugins && pluginManager) {
        await this.initializePlugins(chart, pluginManager);

        // Step 2: Wait for data to be loaded before subscribing to real-time
        // This prevents race conditions where subscription happens before data
        const pair = dataStore.pair || 'BTC-USD';
        const granularity = dataStore.granularity || '1m';
        await this.waitForDataAndPrepareSubscription(pluginManager, pair, granularity);
      }

      // Step 3: Setup auto-granularity if enabled
      if (enableAutoGranularity) {
        this.setupAutoGranularityAfterReady(chart);
      }

      // Step 4: Notify parent that chart is ready
      if (onReady) {
        onReady(chart);
      }

      ChartDebug.log('✅ Chart readiness orchestration complete');
    } catch (error) {
      throw error;
    }
  }

  /**
   * Initialize plugin manager with chart context
   * Sets up plugin context for data access
   * @param chart Chart API instance
   * @param pluginManager Plugin manager instance
   */
  private async initializePlugins(
    chart: IChartApi,
    pluginManager: PluginManager
  ): Promise<void> {
    try {
      await pluginManager.setContext({
        chart,
        dataStore,
        chartStore,
        statusStore
      });

      ChartDebug.log('Plugin manager initialized');
    } catch (error) {
      // Non-critical - plugins can be registered later
    }
  }

  /**
   * Wait for data to be loaded, then prepare for subscription
   * Uses polling to check for data availability with timeout
   * @param pluginManager Plugin manager instance
   * @param pair Trading pair
   * @param granularity Timeframe
   */
  private async waitForDataAndPrepareSubscription(
    pluginManager: PluginManager,
    pair: string,
    granularity: string
  ): Promise<void> {
    return new Promise((resolve) => {
      let waitTime = 0;
      const maxWaitTime = 10000; // 10 second timeout

      const checkDataReady = () => {
        // Check if we have data loaded
        if (dataStore.candles && dataStore.candles.length > 0) {
          ChartDebug.log(
            `✅ Data ready (${dataStore.candles.length} candles), preparing subscription`
          );

          // Data is ready - subscription will be handled by ChartSubscriptionOrchestrator
          clearTimeout(this.waitingForDataTimeout as any);
          resolve();
        } else if (waitTime < maxWaitTime) {
          // Data not ready yet, check again in 100ms
          waitTime += 100;
          this.waitingForDataTimeout = setTimeout(checkDataReady, 100);
        } else {
          // Timeout - proceed anyway
          ChartDebug.warn(
            `⚠️ Data load timeout (${maxWaitTime}ms), proceeding with subscription anyway`
          );
          clearTimeout(this.waitingForDataTimeout as any);
          resolve();
        }
      };

      // Start checking after plugins are registered (reduced from 1500ms)
      setTimeout(checkDataReady, 300);
    });
  }

  /**
   * Setup auto-granularity switching after chart is ready
   * Initializes the auto-granularity hook
   * Note: This is defined in the component using useAutoGranularity hook
   * @param chart Chart API instance
   */
  private setupAutoGranularityAfterReady(chart: IChartApi): void {
    try {
      // Note: Auto-granularity setup happens in component using useAutoGranularity hook
      // This method is a placeholder for future enhancements
      ChartDebug.log('Auto-granularity setup prepared');
    } catch (error) {
      // Non-critical - auto-granularity is optional
    }
  }

  /**
   * Refresh all plugins after a delay
   * Used when data changes or timeframe changes
   * @param pluginManager Plugin manager instance
   * @param delayMs Delay before refresh in milliseconds
   */
  refreshAllPluginsAfterDelay(pluginManager: PluginManager, delayMs: number): void {
    if (!pluginManager) return;

    // Clear any pending refresh
    if (this.pluginRefreshTimeout) {
      clearTimeout(this.pluginRefreshTimeout);
    }

    // Schedule refresh
    this.pluginRefreshTimeout = setTimeout(() => {
      try {
        // Refresh all plugins via plugin manager
        const pm = pluginManager as any;
        if (pm && typeof pm.refreshAll === 'function') {
          pm.refreshAll(delayMs);
        }
        ChartDebug.log('All plugins refreshed');
      } catch (error) {
      }
      this.pluginRefreshTimeout = null;
    }, delayMs);
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    if (this.waitingForDataTimeout) {
      clearTimeout(this.waitingForDataTimeout);
      this.waitingForDataTimeout = null;
    }

    if (this.pluginRefreshTimeout) {
      clearTimeout(this.pluginRefreshTimeout);
      this.pluginRefreshTimeout = null;
    }
  }
}
