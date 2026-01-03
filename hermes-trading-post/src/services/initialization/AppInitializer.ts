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
// ✅ REMOVED: chartIndexedDBCache - not needed with Redis-only architecture

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

      // Phase 1: Initialize Store Manager
      await initializeStores();

      // Phase 2: Initialize Animation Manager
      initializeAnimationManager();

      // Phase 3: Initialize Chart Services (critical - blocking)
      await Promise.all([
        chartCacheService.initialize(),
        new Promise((resolve) => {
          chartDataProcessingService.initialize();
          resolve(null);
        })
      ]);

      // Phase 4: Set up global error handling (critical - blocking)
      AppInitializer.setupErrorHandling();

      AppInitializer.initialized = true;

      // 🚀 PHASE 5F: Defer non-critical initialization
      // Schedule these after app is interactive to reduce initial render time
      AppInitializer.deferNonCriticalInit();
    } catch (error) {
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

        // Initialize metrics collection in background
        startMetricsCollection();

        // Warm chart data cache
        AppInitializer.warmChartDataCache();
      } catch (error) {
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

    // ✅ SIMPLIFIED: No cache warming needed
    // Redis/backend already has all data pre-loaded by WebSocket feed
    // ChartCacheService has built-in LRU memory cache with 5s TTL
    // Frontend just loads from Redis when needed
  }

  /**
   * Setup global error handling with metrics collection
   */
  private static setupErrorHandling(): void {
    // Handle uncaught errors
    if (typeof window !== 'undefined') {
      window.addEventListener('error', (event) => {
        metricsCollector.recordEvent('error_uncaught', {
          message: event.message,
          filename: event.filename,
          lineno: event.lineno
        });
      });

      // Handle unhandled promise rejections
      window.addEventListener('unhandledrejection', (event) => {
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

    try {
      // Flush any pending metrics
      await metricsCollector.flush();

      // Stop animation manager
      animationManager.stop();

      // Cleanup data processing service
      chartDataProcessingService.destroy();

    } catch (error) {
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
    metrics: { size: number; capacity: number; usage: number };
  } {
    const bufferStats = metricsCollector.getBufferStats();
    return {
      initialized: AppInitializer.initialized,
      initializing: AppInitializer.initializing,
      storeManager: {
        totalStores: storeManager.getStats().totalStores,
        initializedStores: storeManager.getStats().initializedStores
      },
      metrics: {
        size: bufferStats.size,
        capacity: bufferStats.capacity,
        usage: bufferStats.usage
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
  metrics: { size: number; capacity: number; usage: number };
} {
  return AppInitializer.getStatus();
}
