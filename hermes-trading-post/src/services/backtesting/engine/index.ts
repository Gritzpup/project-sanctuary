/**
 * @file index.ts
 * @description Exports for backtesting engine modules
 */

export { BacktestingEngine } from './backtestingEngine';
export { BacktestStateManager } from './stateManager';
export { TradeExecutor } from './tradeExecutor';
export { ProfitDistributor } from './profitDistributor';
export { MetricsCalculator } from './metricsCalculator';
export type { BacktestConfig, BacktestState, TradeExecution, ProfitDistribution } from './types';