// Export base types and classes
export * from './base/StrategyTypes';
export { Strategy } from './base/Strategy';

// New backend-first strategy adapter (recommended)
export { BackendStrategyAdapter, BackendStrategyFactory } from './adapters/BackendStrategyAdapter';
export type { BackendStrategyConfig } from './adapters/BackendStrategyAdapter';

// Legacy frontend strategy implementations (for migration)
export { ReverseRatioStrategy } from './implementations/ReverseRatioStrategy';
export { GridTradingStrategy } from './implementations/GridTradingStrategy';
export { RSIMeanReversionStrategy } from './implementations/RSIMeanReversionStrategy';
export { DCAStrategy } from './implementations/DCAStrategy';
export { VWAPBounceStrategy } from './implementations/VWAPBounceStrategy';
export { MicroScalpingStrategy } from './implementations/MicroScalpingStrategy';
export { UltraMicroScalpingStrategy } from './implementations/UltraMicroScalpingStrategy';
export { ProperScalpingStrategy } from './implementations/ProperScalpingStrategy';

// Import the classes for the registry
import { ReverseRatioStrategy } from './implementations/ReverseRatioStrategy';
import { GridTradingStrategy } from './implementations/GridTradingStrategy';
import { RSIMeanReversionStrategy } from './implementations/RSIMeanReversionStrategy';
import { DCAStrategy } from './implementations/DCAStrategy';
import { VWAPBounceStrategy } from './implementations/VWAPBounceStrategy';
import { MicroScalpingStrategy } from './implementations/MicroScalpingStrategy';
import { UltraMicroScalpingStrategy } from './implementations/UltraMicroScalpingStrategy';
import { ProperScalpingStrategy } from './implementations/ProperScalpingStrategy';

// Strategy registry for easy access
export const StrategyRegistry = {
  'reverse-descending-grid': ReverseRatioStrategy,
  'grid-trading': GridTradingStrategy,
  'rsi-mean-reversion': RSIMeanReversionStrategy,
  'dca': DCAStrategy,
  'vwap-bounce': VWAPBounceStrategy,
  'micro-scalping': MicroScalpingStrategy,
  'ultra-micro-scalping': UltraMicroScalpingStrategy,
  'proper-scalping': ProperScalpingStrategy
} as const;

export type StrategyType = keyof typeof StrategyRegistry;

// Export enhanced strategy registry with metadata
export { STRATEGIES, createStrategy, getStrategyList, getStrategyById } from './strategyRegistry';
export type { StrategyInfo } from './strategyRegistry';