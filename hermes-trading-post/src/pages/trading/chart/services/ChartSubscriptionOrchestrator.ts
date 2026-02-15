/**
 * @file ChartSubscriptionOrchestrator.ts
 * @description Coordinates real-time subscription lifecycle across chart operations
 */

import type { ISeriesApi } from 'lightweight-charts';
import type { PluginManager } from '../plugins/base/PluginManager';
import { ChartDebug } from '../utils/debug';
import { ChartAnimationService } from './ChartAnimationService';

/**
 * Subscription configuration
 */
export interface SubscriptionConfig {
  pair: string;
  granularity: string;
}

/**
 * Orchestrates real-time subscription lifecycle
 * Manages subscribe/unsubscribe across timeframe changes and positioning
 */
export class ChartSubscriptionOrchestrator {
  private realtimeSubscription: any = null; // Will be injected
  private subscriptionResetTimeout: NodeJS.Timeout | null = null;
  private currentConfig: SubscriptionConfig | null = null;

  /**
   * Set the realtime subscription instance
   * Allows dependency injection of the hook instance
   * @param subscription The useRealtimeSubscription hook instance
   */
  setRealtimeSubscription(subscription: any): void {
    this.realtimeSubscription = subscription;
  }

  /**
   * Subscribe to real-time updates after positioning is complete
   * Prevents auto-scroll from interfering with positioning
   * @param config Subscription configuration
   * @param chartSeries Candle series for subscription
   * @param pluginManager Plugin manager for volume series retrieval
   */
  subscribeAfterPositioning(
    config: SubscriptionConfig,
    chartSeries: ISeriesApi<'Candlestick'> | null,
    pluginManager: PluginManager | null
  ): void {
    if (!this.realtimeSubscription) {
      ChartDebug.warn('Realtime subscription not initialized');
      return;
    }

    try {
      this.currentConfig = config;

      // Get volume series from plugin manager if available
      const volumeSeries = this.getVolumeSeries(pluginManager);

      // Subscribe to real-time updates
      this.realtimeSubscription.subscribeToRealtime(
        {
          pair: config.pair,
          granularity: config.granularity
        },
        chartSeries,
        volumeSeries
      );

      ChartDebug.log(
        `✅ Subscribed to real-time: ${config.pair} ${config.granularity}`
      );
    } catch (error) {
    }
  }

  /**
   * Unsubscribe from real-time updates
   */
  unsubscribeFromRealtime(): void {
    if (!this.realtimeSubscription) return;

    try {
      this.realtimeSubscription.unsubscribeFromRealtime();
      this.currentConfig = null;
      ChartDebug.log('Unsubscribed from real-time updates');
    } catch (error) {
    }
  }

  /**
   * Resubscribe after timeframe change
   * Unsubscribes from current, waits for positioning, then resubscribes
   * @param pair Trading pair
   * @param granularity Timeframe
   * @param positioningDelayMs Delay to wait for positioning
   * @param chartSeries Candle series for subscription
   * @param pluginManager Plugin manager for volume series
   */
  async resubscribeAfterTimeframeChange(
    pair: string,
    granularity: string,
    positioningDelayMs: number,
    chartSeries: ISeriesApi<'Candlestick'> | null,
    pluginManager: PluginManager | null
  ): Promise<void> {
    return new Promise((resolve) => {
      try {
        // Unsubscribe from current updates
        this.unsubscribeFromRealtime();

        // Wait for positioning to complete before resubscribing
        // This prevents auto-scroll from interfering with manual positioning
        if (this.subscriptionResetTimeout) {
          clearTimeout(this.subscriptionResetTimeout);
        }

        this.subscriptionResetTimeout = setTimeout(() => {
          this.subscribeAfterPositioning(
            { pair, granularity },
            chartSeries,
            pluginManager
          );
          this.subscriptionResetTimeout = null;
          resolve();
        }, positioningDelayMs);

        ChartDebug.log(
          `📡 Real-time subscription reset scheduled for ${pair} ${granularity}`
        );
      } catch (error) {
        resolve();
      }
    });
  }

  /**
   * Get volume series from plugin manager
   * Used for real-time volume updates
   * @param pluginManager Plugin manager instance
   * @returns Volume series or null if not available
   */
  private getVolumeSeries(pluginManager: PluginManager | null): any {
    if (!pluginManager) return null;

    try {
      const volumePlugin = pluginManager.get('volume');
      if (volumePlugin && typeof (volumePlugin as any).getSeries === 'function') {
        return (volumePlugin as any).getSeries();
      }
      return null;
    } catch (error) {
      ChartDebug.warn('Failed to retrieve volume series:', error);
      return null;
    }
  }

  /**
   * Get current subscription configuration
   * @returns Current subscription config or null if not subscribed
   */
  getCurrentConfig(): SubscriptionConfig | null {
    return this.currentConfig;
  }

  /**
   * Check if currently subscribed
   * @returns True if actively subscribed to real-time
   */
  isSubscribed(): boolean {
    return this.currentConfig !== null;
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.unsubscribeFromRealtime();

    if (this.subscriptionResetTimeout) {
      clearTimeout(this.subscriptionResetTimeout);
      this.subscriptionResetTimeout = null;
    }

    this.realtimeSubscription = null;
  }
}
