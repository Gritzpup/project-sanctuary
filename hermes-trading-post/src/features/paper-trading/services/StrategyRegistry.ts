/**
 * Strategy Registry with Lazy Loading
 * Strategies are only loaded when they're actually selected
 * This reduces initial bundle size by ~40KB per strategy
 */

import type { Strategy } from '../../../strategies/base/Strategy';

export interface StrategyConstructor {
  new (): Strategy;
}

interface StrategyLoader {
  name: string;
  displayName: string;
  description: string;
  load: () => Promise<{ default: StrategyConstructor }>;
}

// Strategy registry with lazy loading
export const STRATEGY_REGISTRY: Record<string, StrategyLoader> = {
  'reverse-ratio': {
    name: 'reverse-ratio',
    displayName: 'Reverse Ratio Strategy',
    description: 'Trades based on reverse ratio calculations',
    load: () => import('../../../strategies/implementations/ReverseRatioStrategy').then(m => ({
      default: m.ReverseRatioStrategy as unknown as StrategyConstructor
    }))
  },
  'grid-trading': {
    name: 'grid-trading',
    displayName: 'Grid Trading Strategy',
    description: 'Places buy and sell orders at regular intervals',
    load: () => import('../../../strategies/implementations/GridTradingStrategy').then(m => ({
      default: m.GridTradingStrategy as unknown as StrategyConstructor
    }))
  },
  'rsi-mean-reversion': {
    name: 'rsi-mean-reversion',
    displayName: 'RSI Mean Reversion',
    description: 'Trades based on RSI oversold/overbought conditions',
    load: () => import('../../../strategies/implementations/RSIMeanReversionStrategy').then(m => ({
      default: m.RSIMeanReversionStrategy as unknown as StrategyConstructor
    }))
  },
  'dca': {
    name: 'dca',
    displayName: 'Dollar Cost Averaging',
    description: 'Buys at regular intervals regardless of price',
    load: () => import('../../../strategies/implementations/DCAStrategy').then(m => ({
      default: m.DCAStrategy as unknown as StrategyConstructor
    }))
  },
  'vwap-bounce': {
    name: 'vwap-bounce',
    displayName: 'VWAP Bounce Strategy',
    description: 'Trades bounces off VWAP levels',
    load: () => import('../../../strategies/implementations/VWAPBounceStrategy').then(m => ({
      default: m.VWAPBounceStrategy as unknown as StrategyConstructor
    }))
  },
  'micro-scalping': {
    name: 'micro-scalping',
    displayName: 'Micro Scalping',
    description: 'Quick trades on small price movements',
    load: () => import('../../../strategies/implementations/MicroScalpingStrategy').then(m => ({
      default: m.MicroScalpingStrategy as unknown as StrategyConstructor
    }))
  },
  'proper-scalping': {
    name: 'proper-scalping',
    displayName: 'Proper Scalping',
    description: 'Professional scalping with tight risk management',
    load: () => import('../../../strategies/implementations/ProperScalpingStrategy').then(m => ({
      default: m.ProperScalpingStrategy as unknown as StrategyConstructor
    }))
  },
  'reverse-descending-grid': {
    name: 'reverse-descending-grid',
    displayName: 'Reverse Descending Grid',
    description: 'Advanced grid strategy with descending levels',
    load: () => import('../../../strategies/implementations/ReverseRatioStrategy').then(m => ({
      default: m.ReverseRatioStrategy as unknown as StrategyConstructor
    }))
  }
};

// Cache loaded strategies to avoid re-importing
const loadedStrategies = new Map<string, StrategyConstructor>();

/**
 * Load a strategy by name (with caching)
 */
export async function loadStrategy(strategyName: string): Promise<Strategy | null> {
  // Check cache first
  if (loadedStrategies.has(strategyName)) {
    const StrategyClass = loadedStrategies.get(strategyName)!;
    return new StrategyClass();
  }

  // Load from registry
  const loader = STRATEGY_REGISTRY[strategyName];
  if (!loader) {
    return null;
  }

  try {
    const module = await loader.load();
    const StrategyClass = module.default;

    // Cache for future use
    loadedStrategies.set(strategyName, StrategyClass);

    // Create and return instance
    return new StrategyClass();
  } catch (error) {
    return null;
  }
}

/**
 * Preload a strategy without creating an instance
 * Useful for warming up the cache
 */
export async function preloadStrategy(strategyName: string): Promise<boolean> {
  if (loadedStrategies.has(strategyName)) {
    return true;
  }

  const loader = STRATEGY_REGISTRY[strategyName];
  if (!loader) {
    return false;
  }

  try {
    const module = await loader.load();
    loadedStrategies.set(strategyName, module.default);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Get list of available strategies
 */
export function getAvailableStrategies(): string[] {
  return Object.keys(STRATEGY_REGISTRY);
}

/**
 * Get strategy metadata without loading it
 */
export function getStrategyInfo(strategyName: string) {
  const loader = STRATEGY_REGISTRY[strategyName];
  if (!loader) return null;

  return {
    name: loader.name,
    displayName: loader.displayName,
    description: loader.description
  };
}