/**
 * Built-in strategy definitions for Paper Trading
 */

import type { StrategyDefinition } from '../types/TradingTypes';

export const builtInStrategies: StrategyDefinition[] = [
  { value: 'reverse-descending-grid', label: 'Reverse Descending Grid', description: 'Grid trading with reverse position sizing', isCustom: false },
  { value: 'grid-trading', label: 'Grid Trading', description: 'Classic grid trading strategy', isCustom: false },
  { value: 'rsi-mean-reversion', label: 'RSI Mean Reversion', description: 'Trade RSI oversold/overbought', isCustom: false },
  { value: 'dca', label: 'Dollar Cost Averaging', description: 'Regular periodic purchases', isCustom: false },
  { value: 'vwap-bounce', label: 'VWAP Bounce', description: 'Trade VWAP support/resistance', isCustom: false },
  { value: 'micro-scalping', label: 'Micro Scalping', description: 'High-frequency trading', isCustom: false },
  { value: 'proper-scalping', label: 'Proper Scalping', description: 'Professional scalping', isCustom: false },
  { value: 'ultra-micro-scalping', label: 'Ultra Micro Scalping', description: 'Hyper-aggressive 1-minute scalping', isCustom: false },
  { value: 'test', label: 'Test', description: 'High-frequency: 0.05% entry, 0.3% profit (5x more trades)', isCustom: false }
];

export const DEFAULT_STRATEGY_CONFIG = {
  initialDropPercent: 0.02,   // Ultra aggressive: 0.02% drop for first level
  levelDropPercent: 0.02,     // Ultra aggressive: 0.02% additional drop per level
  profitTargetPercent: 0.5,   // Optimized: 0.5% profit target (covers fees + vault + rebalance)
  maxLevels: 15              // Increased to 15 levels for more frequent buys
};

export const DEFAULT_BALANCE = 10000;