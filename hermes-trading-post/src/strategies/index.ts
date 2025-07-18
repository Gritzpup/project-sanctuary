// Export base types and classes
export * from './base/StrategyTypes';
export { Strategy } from './base/Strategy';

// Export strategy implementations
export { ReverseRatioStrategy } from './implementations/ReverseRatioStrategy';
export { GridTradingStrategy } from './implementations/GridTradingStrategy';
export { RSIMeanReversionStrategy } from './implementations/RSIMeanReversionStrategy';
export { DCAStrategy } from './implementations/DCAStrategy';
export { VWAPBounceStrategy } from './implementations/VWAPBounceStrategy';

// Strategy registry for easy access
export const StrategyRegistry = {
  'reverse-ratio': ReverseRatioStrategy,
  'grid-trading': GridTradingStrategy,
  'rsi-mean-reversion': RSIMeanReversionStrategy,
  'dca': DCAStrategy,
  'vwap-bounce': VWAPBounceStrategy
} as const;

export type StrategyType = keyof typeof StrategyRegistry;

// Export enhanced strategy registry with metadata
export { STRATEGIES, createStrategy, getStrategyList, getStrategyById } from './strategyRegistry';
export type { StrategyInfo } from './strategyRegistry';