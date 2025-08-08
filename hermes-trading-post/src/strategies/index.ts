// Export base types and classes
export * from './base/StrategyTypes';
export { Strategy } from './base/Strategy';

// Export strategy implementations
export { ReverseRatioStrategy } from './implementations/ReverseRatioStrategy';
export { GridTradingStrategy } from './implementations/GridTradingStrategy';
export { RSIMeanReversionStrategy } from './implementations/RSIMeanReversionStrategy';
export { DCAStrategy } from './implementations/DCAStrategy';
export { VWAPBounceStrategy } from './implementations/VWAPBounceStrategy';
export { MicroScalpingStrategy } from './implementations/MicroScalpingStrategy';
export { ProperScalpingStrategy } from './implementations/ProperScalpingStrategy';

// Import the classes for the registry
import { ReverseRatioStrategy } from './implementations/ReverseRatioStrategy';
import { GridTradingStrategy } from './implementations/GridTradingStrategy';
import { RSIMeanReversionStrategy } from './implementations/RSIMeanReversionStrategy';
import { DCAStrategy } from './implementations/DCAStrategy';
import { VWAPBounceStrategy } from './implementations/VWAPBounceStrategy';
import { MicroScalpingStrategy } from './implementations/MicroScalpingStrategy';
import { ProperScalpingStrategy } from './implementations/ProperScalpingStrategy';

// Strategy registry for easy access
export const StrategyRegistry = {
  'reverse-ratio': ReverseRatioStrategy,
  'grid-trading': GridTradingStrategy,
  'rsi-mean-reversion': RSIMeanReversionStrategy,
  'dca': DCAStrategy,
  'vwap-bounce': VWAPBounceStrategy,
  'micro-scalping': MicroScalpingStrategy,
  'proper-scalping': ProperScalpingStrategy
} as const;

export type StrategyType = keyof typeof StrategyRegistry;

// Export enhanced strategy registry with metadata
export { STRATEGIES, createStrategy, getStrategyList, getStrategyById } from './strategyRegistry';
export type { StrategyInfo } from './strategyRegistry';