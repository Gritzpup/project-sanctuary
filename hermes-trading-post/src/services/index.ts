/**
 * @file services/index.ts
 * @description Main services export for easy access and migration
 * Clean, modular architecture with backend-first approach
 */

// ✨ New recommended services (backend-first architecture)
export { backendCache, BackendCacheService } from './cache/BackendCacheService';
export { BackendAPIService } from './api/BackendAPIService';

// 🔄 Strategy adapters (eliminates frontend/backend duplication)
export { BackendStrategyAdapter, BackendStrategyFactory } from '../strategies/adapters/BackendStrategyAdapter';

// Full module exports for existing code
export * from './api';
export * from './cache';
export * from './chart';
export * from './core';
export * from './data';
// Note: ./state has no index.ts - import individual files directly
// export * from './state';
export * from './trading';
export * from './backtesting';

// Quick access to most commonly used services
export const services = {
  // New unified services (recommended)
  cache: () => import('./cache/BackendCacheService').then(m => m.backendCache),
  api: () => import('./api/BackendAPIService').then(m => m.BackendAPIService.getInstance()),

  // Legacy services (for migration)
  legacyCache: () => import('./cache/indexeddb').then(m => m.IndexedDBService),
  legacyPaperTrading: () => import('./paper-trading/paperTradingService'),
  legacyPaperTest: () => import('./state/paperTestService')
};

/**
 * Migration helper - provides both old and new service interfaces
 */
export const migration = {
  // Cache migration
  async getCache(useBackend = true) {
    if (useBackend) {
      return (await import('./cache/BackendCacheService')).backendCache;
    } else {
      const { IndexedDBService } = await import('./cache/indexeddb');
      return IndexedDBService;
    }
  },

  // Trading engine migration
  async getTradingEngine() {
    // Return legacy service selector
    return {
      paperTrading: () => import('./paper-trading/paperTradingService'),
      paperTest: () => import('./state/paperTestService')
    };
  },

  // Strategy migration
  async getStrategy(strategyType: string, useBackend = true) {
    if (useBackend) {
      const { BackendStrategyFactory } = await import('../strategies/adapters/BackendStrategyAdapter');
      return BackendStrategyFactory.createReverseRatio(); // Example
    } else {
      // Import strategy directly from implementations
      const strategies = await import('../strategies/implementations/ReverseRatioStrategy');
      return new strategies.ReverseRatioStrategy();
    }
  }
};