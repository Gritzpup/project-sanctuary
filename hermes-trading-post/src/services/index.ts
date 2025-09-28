/**
 * @file services/index.ts
 * @description Main services export for easy access and migration
 * Clean, modular architecture with backend-first approach
 */

// ✨ New recommended services (backend-first architecture)
export { backendCache, BackendCacheService } from './cache/BackendCacheService';
export { paperTradingEngine, PaperTradingEngine } from './trading/PaperTradingEngine';
export { BackendAPIService, backendAPI } from './api/BackendAPIService';

// 🔄 Strategy adapters (eliminates frontend/backend duplication)
export { BackendStrategyAdapter, BackendStrategyFactory } from '../strategies/adapters/BackendStrategyAdapter';

// Full module exports for existing code
export * from './api';
export * from './cache';
export * from './chart';
export * from './core';
export * from './data';
export * from './state';
export * from './trading';
export * from './backtesting';

// Quick access to most commonly used services
export const services = {
  // New unified services (recommended)
  cache: () => import('./cache/BackendCacheService').then(m => m.backendCache),
  trading: () => import('./trading/PaperTradingEngine').then(m => m.paperTradingEngine),
  api: () => import('./api/BackendAPIService').then(m => m.backendAPI),
  
  // Legacy services (for migration)
  legacyCache: () => import('./cache/indexedDB').then(m => new m.IndexedDBCache()),
  legacyPaperTrading: () => import('./state/paperTradingService'),
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
      const { IndexedDBCache } = await import('./cache/indexedDB');
      return new IndexedDBCache();
    }
  },
  
  // Trading engine migration
  async getTradingEngine(useUnified = true) {
    if (useUnified) {
      return (await import('./trading/PaperTradingEngine')).paperTradingEngine;
    } else {
      // Return legacy service selector
      return {
        paperTrading: () => import('./state/paperTradingService'),
        paperTest: () => import('./state/paperTestService')
      };
    }
  },
  
  // Strategy migration
  async getStrategy(strategyType: string, useBackend = true) {
    if (useBackend) {
      const { BackendStrategyFactory } = await import('../strategies/adapters/BackendStrategyAdapter');
      return BackendStrategyFactory.createReverseRatio(); // Example
    } else {
      const { StrategyRegistry } = await import('../strategies');
      return new StrategyRegistry[strategyType as keyof typeof StrategyRegistry]();
    }
  }
};