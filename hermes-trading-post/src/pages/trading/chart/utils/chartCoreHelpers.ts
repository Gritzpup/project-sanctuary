/**
 * Chart Core Helper Functions
 *
 * Extracted utilities for ChartCore.svelte to reduce duplication
 * and improve maintainability.
 */

import type { PluginManager } from '../plugins/base/PluginManager';
import type ChartCanvas from '../components/canvas/ChartCanvas.svelte';
import { dataStore } from '../stores/dataStore.svelte';

/**
 * Refresh all enabled plugins with refreshData method
 * @param pluginManager - Plugin manager instance
 * @param delayMs - Delay before refreshing (default: 500ms)
 */
export function refreshAllPlugins(pluginManager: PluginManager | null, delayMs: number = 500): void {
  setTimeout(() => {
    if (!pluginManager) return;

    const enabledPlugins = pluginManager.getEnabled();
    for (const plugin of enabledPlugins) {
      try {
        // Refresh all plugins including volume when granularity changes
        if (typeof (plugin as any).refreshData === 'function') {
          (plugin as any).refreshData();
        }
      } catch (error) {
      }
    }
  }, delayMs);
}

/**
 * Position chart based on period and data availability
 * @param chartCanvas - Chart canvas instance
 * @param period - Time period (e.g., '1H', '3M', '1Y')
 * @param delayMs - Delay before positioning (default: 300ms)
 */
export function positionChartForPeriod(
  chartCanvas: ChartCanvas | null,
  period: string,
  delayMs: number = 300
): void {
  setTimeout(() => {
    if (!chartCanvas || dataStore.candles.length === 0) return;

    // For long-term views (3M, 6M, 1Y, 5Y), show all candles. Otherwise show 60.
    const longTermPeriods = ['3M', '6M', '1Y', '5Y'];
    if (longTermPeriods.includes(period)) {
      chartCanvas.fitContent();
    } else {
      chartCanvas.show60Candles();
    }
  }, delayMs);
}

/**
 * Get volume series from plugin manager
 * @param pluginManager - Plugin manager instance
 * @returns Volume series or null
 */
export function getVolumeSeries(pluginManager: PluginManager | null): any | null {
  if (!pluginManager) return null;

  const volumePlugin = pluginManager.get('volume');
  return volumePlugin ? (volumePlugin as any).getSeries() : null;
}

/**
 * Force status to ready after timeout if still initializing/loading
 * @param statusStore - Status store instance
 * @param timeoutMs - Timeout in milliseconds (default: 5000ms)
 */
export function forceReadyAfterTimeout(statusStore: any, timeoutMs: number = 5000): void {
  setTimeout(() => {
    if (statusStore.status === 'initializing' || statusStore.status === 'loading') {
      statusStore.forceReady();
    }
  }, timeoutMs);
}

/**
 * Wait for a specified delay (async helper)
 * @param ms - Milliseconds to wait
 * @returns Promise that resolves after delay
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Check if period is a long-term period
 * @param period - Time period string
 * @returns True if long-term period
 */
export function isLongTermPeriod(period: string): boolean {
  const longTermPeriods = ['3M', '6M', '1Y', '5Y'];
  return longTermPeriods.includes(period);
}
