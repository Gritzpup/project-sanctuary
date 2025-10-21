/**
 * @file AppInitializer.ts
 * @description Application initialization service for Phases 18-21
 * Part of Phase 18-21: Centralized app setup
 * 🚀 Initializes stores, services, and monitoring in correct order
 */

import { storeManager, initializeStores } from '../../stores/manager/StoreManager';
import { animationManager, initializeAnimationManager } from '../../utils/AnimationManager';
import { metricsCollector, startMetricsCollection } from '../../services/monitoring/MetricsCollector';
import { chartCacheService } from '../../shared/services/chartCacheService';
import { chartDataProcessingService } from '../../services/ChartDataProcessingService';
import { chartIndexedDBCache } from '../../pages/trading/chart/services/ChartIndexedDBCache';

/**
 * Application initialization sequence
 * Ensures all services are ready before app renders
 */
export class AppInitializer {
  private static initialized = false;
  private static initializing = false;

  /**
   * Initialize application
   * Called from main.ts or app root
   */
  static async initialize(): Promise<void> {
    if (AppInitializer.initialized || AppInitializer.initializing) {
      return;
    }

    AppInitializer.initializing = true;

    try {
      console.log('[AppInitializer] Starting application initialization...');

      // Phase 1: Initialize Store Manager
      console.log('[AppInitializer] Phase 1: Initializing store manager...');
      await initializeStores();
      console.log('[AppInitializer] ✅ Store manager ready');

      // Phase 2: Initialize Animation Manager
      console.log('[AppInitializer] Phase 2: Initializing animation manager...');
      initializeAnimationManager();
      console.log('[AppInitializer] ✅ Animation manager ready');

      // Phase 3: Initialize Chart Services (critical - blocking)
      console.log('[AppInitializer] Phase 3: Initializing chart services...');
      await Promise.all([
        chartCacheService.initialize(),
        new Promise((resolve) => {
          chartDataProcessingService.initialize();
          resolve(null);
        })
      ]);
      console.log('[AppInitializer] ✅ Chart services ready');

      // Phase 4: Set up global error handling (critical - blocking)
      console.log('[AppInitializer] Phase 4: Setting up error handling...');
      AppInitializer.setupErrorHandling();
      console.log('[AppInitializer] ✅ Error handling initialized');

      AppInitializer.initialized = true;
      console.log('[AppInitializer] ✅ All systems initialized and ready');

      // 🚀 PHASE 5F: Defer non-critical initialization
      // Schedule these after app is interactive to reduce initial render time
      AppInitializer.deferNonCriticalInit();
    } catch (error) {
      console.error('[AppInitializer] Initialization failed:', error);
      throw error;
    } finally {
      AppInitializer.initializing = false;
    }
  }

  /**
   * 🚀 PHASE 5F: Defer non-critical initialization
   * Schedules Metrics collection and cache warming after app is interactive
   * Reduces initial render time by deferring non-essential setup
   */
  private static deferNonCriticalInit(): void {
    // Use requestIdleCallback if available, otherwise use setTimeout
    const scheduleTask = (callback: () => void) => {
      if (typeof requestIdleCallback !== 'undefined') {
        requestIdleCallback(callback, { timeout: 15000 }); // 15s timeout
      } else {
        setTimeout(callback, 100); // Fallback: 100ms delay
      }
    };

    scheduleTask(() => {
      try {
        console.log('[AppInitializer] ⏳ Initializing deferred services...');

        // Initialize metrics collection in background
        console.log('[AppInitializer] Phase 5A: Initializing metrics collection...');
        startMetricsCollection();
        console.log('[AppInitializer] ✅ Metrics collection started');

        // Warm chart data cache
        AppInitializer.warmChartDataCache();
      } catch (error) {
        console.warn('[AppInitializer] ⚠️ Deferred initialization error:', error);
        // Non-critical - app continues normally
      }
    });
  }

  /**
   * 🚀 PHASE 5F: Warm IndexedDB chart cache in background
   * Prefetches most common chart data (BTC-USD:1m) for instant repeat visits
   * Uses requestIdleCallback to avoid blocking main thread
   */
  private static warmChartDataCache(): void {
    // Use requestIdleCallback if available, otherwise use setTimeout
    const scheduleTask = (callback: () => void) => {
      if (typeof requestIdleCallback !== 'undefined') {
        requestIdleCallback(callback, { timeout: 10000 }); // 10s timeout
      } else {
        setTimeout(callback, 500); // Fallback: 500ms delay
      }
    };

    scheduleTask(async () => {
      try {
        console.log('[AppInitializer] 🔥 Starting background cache warming...');

        // Initialize IndexedDB if not already done
        await chartIndexedDBCache.initialize();

        // Prefetch most common chart data (BTC-USD with 1m granularity)
        const commonPair = 'BTC-USD';
        const commonGranularities = ['1m', '5m'];

        for (const granularity of commonGranularities) {
          try {
            // 🚀 PHASE 11 FIX: Always fetch fresh 1m data since it changes frequently
            // For 5m and coarser, use cache if fresh (< 5 minutes old)
            const cached = await chartIndexedDBCache.get(commonPair, granularity);
            const now = Date.now();
            const cacheAgeMs = cached ? (now - cached.timestamp) : Infinity;

            // 1m data changes every minute, so always fetch fresh
            // Other granularities can use cache if < 5 minutes old
            const shouldSkipFetch = granularity !== '1m' && cached && cacheAgeMs < 5 * 60 * 1000;

            if (shouldSkipFetch) {
              // Cache is fresh and not 1m, skip fetch
              console.log(`[AppInitializer] ✅ Chart cache warm (${commonPair}:${granularity})`);
              continue;
            }

            // Fetch fresh data and cache it
            console.log(`[AppInitializer] 📡 Warming chart cache: ${commonPair}:${granularity}...`);

            // 🚀 PHASE 11: Load appropriate amount per granularity for instant cache
            // Balance between memory (small) and UX (show meaningful data immediately)
            // Keep amounts reasonable to avoid memory issues
            const granularityCacheAmounts: Record<string, number> = {
              '1m': 200,     // ~3 hours of 1m data - enough for initial view
              '5m': 150,     // ~12 hours of 5m data
              '15m': 100,    // ~25 hours of 15m data
              '30m': 75,     // ~37 hours of 30m data
              '1h': 50,      // ~2 days of hourly data
              '4h': 30,      // ~5 days of 4h data
              '1d': 15       // ~2 weeks of daily data
            };

            const now_sec = Math.floor(Date.now() / 1000);
            const granularitySecondsMap: Record<string, number> = {
              '1m': 60, '5m': 300, '15m': 900, '30m': 1800, '1h': 3600, '4h': 14400, '1d': 86400
            };
            const granularitySeconds = granularitySecondsMap[granularity] || 60;
            const candleCount = granularityCacheAmounts[granularity] || 100;
            const startTime = now_sec - (candleCount * granularitySeconds);
            const endTime = now_sec;

            // Fetch from backend cache service with granularity-specific amounts
            const candles = await chartCacheService.fetchCandles({
              pair: commonPair,
              granularity,
              start: startTime,
              end: endTime,
              limit: candleCount
            });

            if (candles.length > 0) {
              // Store in IndexedDB
              await chartIndexedDBCache.set(commonPair, granularity, candles);
              console.log(`[AppInitializer] ✅ Cached ${candles.length} ${granularity} candles for ${commonPair}`);
            }
          } catch (error) {
            console.warn(`[AppInitializer] ⚠️ Failed to warm cache for ${commonPair}:${granularity}:`, error);
            // Continue with next granularity - cache warming is best-effort
          }
        }

        console.log('[AppInitializer] ✅ Background cache warming complete');
      } catch (error) {
        console.warn('[AppInitializer] ⚠️ Cache warming failed:', error);
        // Non-critical - app continues normally without cached data
      }
    });
  }

  /**
   * Setup global error handling with metrics collection
   */
  private static setupErrorHandling(): void {
    // Handle uncaught errors
    if (typeof window !== 'undefined') {
      window.addEventListener('error', (event) => {
        console.error('[AppInitializer] Uncaught error:', event.error);
        metricsCollector.recordEvent('error_uncaught', {
          message: event.message,
          filename: event.filename,
          lineno: event.lineno
        });
      });

      // Handle unhandled promise rejections
      window.addEventListener('unhandledrejection', (event) => {
        console.error('[AppInitializer] Unhandled rejection:', event.reason);
        metricsCollector.recordEvent('error_unhandled_promise', {
          reason: String(event.reason)
        });
      });
    }
  }

  /**
   * Shutdown application (cleanup)
   */
  static async shutdown(): Promise<void> {
    console.log('[AppInitializer] Shutting down application...');

    try {
      // Flush any pending metrics
      await metricsCollector.flush();

      // Stop animation manager
      animationManager.stop();

      // Cleanup data processing service
      chartDataProcessingService.destroy();

      console.log('[AppInitializer] ✅ Application shutdown complete');
    } catch (error) {
      console.error('[AppInitializer] Shutdown error:', error);
    }
  }

  /**
   * Get initialization status
   */
  static isInitialized(): boolean {
    return AppInitializer.initialized;
  }

  /**
   * Get detailed status info
   */
  static getStatus(): {
    initialized: boolean;
    initializing: boolean;
    storeManager: { totalStores: number; initializedStores: number };
    metrics: { size: number; usage: number };
  } {
    return {
      initialized: AppInitializer.initialized,
      initializing: AppInitializer.initializing,
      storeManager: {
        totalStores: storeManager.getStats().totalStores,
        initializedStores: storeManager.getStats().initializedStores
      },
      metrics: {
        size: metricsCollector.getBufferStats().size,
        usage: metricsCollector.getBufferStats().usage
      }
    };
  }
}

/**
 * Export convenience function for app startup
 */
export async function initializeApp(): Promise<void> {
  return AppInitializer.initialize();
}

/**
 * Export convenience function for app shutdown
 */
export async function shutdownApp(): Promise<void> {
  return AppInitializer.shutdown();
}

/**
 * Get app initialization status
 */
export function getAppStatus(): {
  initialized: boolean;
  initializing: boolean;
  storeManager: { totalStores: number; initializedStores: number };
  metrics: { size: number; usage: number };
} {
  return AppInitializer.getStatus();
}
