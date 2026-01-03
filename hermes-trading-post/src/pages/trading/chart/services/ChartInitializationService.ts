/**
 * @file ChartInitializationService.ts
 * @description Orchestrates chart initialization sequence
 */

import type { IChartApi } from 'lightweight-charts';
import { chartPrefetcher } from '../services/ChartPrefetcher';
import { statusStore } from '../stores/statusStore.svelte';

/**
 * Configuration for chart initialization
 */
export interface ChartInitConfig {
  pair: string;
  granularity: string;
  period: string;
  chart?: IChartApi;
  series?: any;
}

/**
 * Orchestrates the complete chart initialization sequence
 * Manages timing and dependencies between multiple initialization steps
 */
export class ChartInitializationService {
  private isInitializing = false;
  private initializationPromise: Promise<void> | null = null;

  /**
   * Initialize chart with proper sequencing of dependencies
   * @param config Initialization configuration
   */
  async initialize(config: ChartInitConfig): Promise<void> {
    if (this.isInitializing) {
      return this.initializationPromise!;
    }

    this.isInitializing = true;

    this.initializationPromise = (async () => {
      try {
        statusStore.setInitializing('Loading chart...');

        // Step 1: Initialize prefetcher (can happen early, doesn't block)
        await this.initializePrefetcher();

        // Step 2: Set force-ready timeout (3 seconds max)
        this.forceReadyAfterTimeout(3000);

        // Step 3: Short delay to allow canvas to be available
        await this.delay(200);

        statusStore.setInitializing('Loading chart data...');

        // Chart is now initialized and ready for interaction
        statusStore.setReady();
      } catch (error) {
        statusStore.setError('Failed to initialize chart: ' + (error instanceof Error ? error.message : String(error)));
        throw error;
      } finally {
        this.isInitializing = false;
      }
    })();

    return this.initializationPromise;
  }

  /**
   * Initialize the prefetcher service
   * Prepares intelligent prefetching for likely next selections
   */
  private async initializePrefetcher(): Promise<void> {
    try {
      await chartPrefetcher.initialize();
    } catch (error) {
      // Don't throw - prefetcher is optional
    }
  }

  /**
   * Force status to ready if it's still initializing after timeout
   * Prevents infinite loading states
   * @param timeoutMs Timeout in milliseconds
   */
  private forceReadyAfterTimeout(timeoutMs: number): void {
    setTimeout(() => {
      // Only force ready if still initializing
      if (statusStore.status === 'initializing') {
        statusStore.setReady();
      }
    }, timeoutMs);
  }

  /**
   * Simple delay utility
   * @param ms Milliseconds to delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Track prefetcher usage for a pair/granularity
   * Triggers intelligent prefetching for likely next selections
   * @param pair Trading pair (e.g., 'BTC-USD')
   * @param granularity Timeframe (e.g., '1m')
   */
  trackUsage(pair: string, granularity: string): void {
    try {
      chartPrefetcher.trackUsage(pair, granularity);
    } catch (error) {
      // Non-critical - continue operation
    }
  }

  /**
   * Clean up initialization resources
   */
  async destroy(): Promise<void> {
    try {
      await chartPrefetcher.destroy();
    } catch (error) {
    }
  }
}
