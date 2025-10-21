/**
 * ✅ L2 CONSOLIDATION - Service Initializer
 *
 * Initializes all L2 services at app startup
 * Handles subscriptions, error handling, and service lifecycle
 */

import { l2PriceProvider } from './L2PriceProvider';
import { l2CandleFactory } from './L2CandleAggregator';
import { l2ExecutionSimulator } from './L2ExecutionSimulator';
import { liquidityAnalyzer } from './LiquidityAnalyzer';

export class L2ServiceInitializer {
  private static instance: L2ServiceInitializer | null = null;
  private initialized = false;
  private destroyed = false;
  private aggregators: Map<number, any> = new Map();
  private monitoringInterval: NodeJS.Timeout | null = null;
  private priceSubscriptionUnsubscribe: (() => void) | null = null;
  private marketContextSubscriptionUnsubscribe: (() => void) | null = null;

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): L2ServiceInitializer {
    if (!this.instance) {
      this.instance = new L2ServiceInitializer();
    }
    return this.instance;
  }

  /**
   * Initialize all L2 services
   * Call this once at app startup (in main.ts or App.svelte)
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      console.warn('[L2] Services already initialized');
      return;
    }

    try {
      console.log('[L2] Initializing services...');

      // Initialize candle aggregators for all standard granularities
      this.initializeCandleAggregators();

      // Setup error handlers
      this.setupErrorHandling();

      // Setup market monitoring
      this.setupMarketMonitoring();

      this.initialized = true;
      console.log('[L2] ✅ All services initialized successfully');
    } catch (error) {
      console.error('[L2] ❌ Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Initialize candle aggregators for all granularities
   */
  private initializeCandleAggregators(): void {
    const granularities = [60, 300, 900, 1800, 3600, 7200, 14400, 21600, 86400];

    for (const granularity of granularities) {
      const aggregator = l2CandleFactory.getAggregator(granularity);
      this.aggregators.set(granularity, aggregator);

      // Log completed candles (for debugging)
      aggregator.subscribeToCandles((candle) => {
        const metrics = aggregator.getMetrics();
        if (metrics.candlesGenerated % 10 === 0) {
          console.log(
            `[L2] Candles generated: ${metrics.candlesGenerated} (${granularity}s)`
          );
        }
      });
    }

    console.log(`[L2] Initialized ${granularities.length} candle aggregators`);
  }

  /**
   * Setup error handling for all services
   * ✅ FIXED: Subscriptions are now tracked for cleanup
   */
  private setupErrorHandling(): void {
    // Price provider errors
    this.priceSubscriptionUnsubscribe = l2PriceProvider.subscribeToPrice((update) => {
      if (this.destroyed) return;
      if (!update || !update.midPrice) {
        console.warn('[L2] Invalid price update:', update);
      }
    });

    // Market context errors
    this.marketContextSubscriptionUnsubscribe = l2PriceProvider.subscribeToMarketContext(
      (context) => {
        if (this.destroyed) return;
        if (!context) {
          console.warn('[L2] No market context available');
        }
      }
    );

    // Liquidity alerts
    liquidityAnalyzer.subscribeToAlerts((alert) => {
      if (this.destroyed) return;
      console.warn(`[L2] Alert: ${alert.message}`);
    });
  }

  /**
   * Setup market monitoring (for dashboard/debugging)
   * ✅ FIXED: Interval is now tracked and properly cleaned up
   */
  private setupMarketMonitoring(): void {
    // Log market health every 10 seconds
    // Store interval ID for cleanup in destroy()
    this.monitoringInterval = setInterval(() => {
      // Check if destroyed before executing callback
      if (this.destroyed) {
        return;
      }

      const condition = liquidityAnalyzer.getCurrentCondition();
      const quality = liquidityAnalyzer.getMarketQuality();

      if (condition) {
        console.log(`[L2] Market Health: ${quality}/100 | ${condition.isHealthy ? '✓' : '⚠'}`);
      }
    }, 10000);
  }

  /**
   * Get candle aggregator for granularity
   */
  getAggregator(granularitySeconds: number) {
    return this.aggregators.get(granularitySeconds);
  }

  /**
   * Get all services status
   */
  getStatus() {
    return {
      initialized: this.initialized,
      priceProvider: {
        isFresh: l2PriceProvider.isFresh(),
        lastPrice: l2PriceProvider.getLastPrice(),
      },
      candles: {
        aggregatorsCount: this.aggregators.size,
      },
      liquidity: {
        quality: liquidityAnalyzer.getMarketQuality(),
      },
      execution: {
        tradesExecuted: l2ExecutionSimulator.getStatistics().totalTrades,
      },
    };
  }

  /**
   * Cleanup on app destroy
   * ✅ FIXED: All resources properly cleaned up
   */
  destroy(): void {
    // Set destroyed flag to prevent new operations and callbacks
    this.destroyed = true;

    // Clear interval
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    // Unsubscribe from price provider
    if (this.priceSubscriptionUnsubscribe) {
      this.priceSubscriptionUnsubscribe();
      this.priceSubscriptionUnsubscribe = null;
    }

    // Unsubscribe from market context
    if (this.marketContextSubscriptionUnsubscribe) {
      this.marketContextSubscriptionUnsubscribe();
      this.marketContextSubscriptionUnsubscribe = null;
    }

    // Destroy all services
    l2PriceProvider.destroy();

    for (const aggregator of this.aggregators.values()) {
      aggregator.destroy();
    }
    this.aggregators.clear();

    liquidityAnalyzer.destroy();
    l2ExecutionSimulator.clearHistory();

    this.initialized = false;
    console.log('[L2] Services cleaned up (all intervals and subscriptions cleared)');
  }
}

// Export singleton
export const l2ServiceInitializer = L2ServiceInitializer.getInstance();
