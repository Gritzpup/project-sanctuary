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

      // Phase 3: Initialize Chart Services
      console.log('[AppInitializer] Phase 3: Initializing chart services...');
      await Promise.all([
        chartCacheService.initialize(),
        new Promise((resolve) => {
          chartDataProcessingService.initialize();
          resolve(null);
        })
      ]);
      console.log('[AppInitializer] ✅ Chart services ready');

      // Phase 4: Initialize Metrics Collection
      console.log('[AppInitializer] Phase 4: Initializing metrics collection...');
      startMetricsCollection();
      console.log('[AppInitializer] ✅ Metrics collection started');

      // Phase 5: Set up global error handling
      console.log('[AppInitializer] Phase 5: Setting up error handling...');
      setupErrorHandling();
      console.log('[AppInitializer] ✅ Error handling initialized');

      AppInitializer.initialized = true;
      console.log('[AppInitializer] ✅ All systems initialized and ready');
    } catch (error) {
      console.error('[AppInitializer] Initialization failed:', error);
      throw error;
    } finally {
      AppInitializer.initializing = false;
    }
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
