import { ReverseRatioStrategy } from './implementations/ReverseRatioStrategy';
import { GridTradingStrategy } from './implementations/GridTradingStrategy';
import { RSIMeanReversionStrategy } from './implementations/RSIMeanReversionStrategy';
import { DCAStrategy } from './implementations/DCAStrategy';
import { VWAPBounceStrategy } from './implementations/VWAPBounceStrategy';
import { MicroScalpingStrategy } from './implementations/MicroScalpingStrategy';
import { ProperScalpingStrategy } from './implementations/ProperScalpingStrategy';
import type { Strategy } from './base/Strategy';

export interface StrategyInfo {
  id: string;
  name: string;
  description: string;
  category: 'Trend Following' | 'Mean Reversion' | 'Grid' | 'DCA' | 'Scalping' | 'Custom';
  riskLevel: 'Low' | 'Medium' | 'High';
  StrategyClass: new () => Strategy;
}

export const STRATEGIES: Record<string, StrategyInfo> = {
  reverseRatio: {
    id: 'reverseRatio',
    name: 'Reverse Ratio Buying',
    description: 'Buys on dips with increasing ratios, sells at 7% profit. Never sells at a loss.',
    category: 'Mean Reversion',
    riskLevel: 'Medium',
    StrategyClass: ReverseRatioStrategy
  },
  grid: {
    id: 'grid',
    name: 'Grid Trading',
    description: 'Places buy/sell orders at regular intervals to profit from volatility.',
    category: 'Grid',
    riskLevel: 'Low',
    StrategyClass: GridTradingStrategy
  },
  rsiMeanReversion: {
    id: 'rsiMeanReversion',
    name: 'RSI Mean Reversion',
    description: 'Trades based on RSI oversold/overbought conditions.',
    category: 'Mean Reversion',
    riskLevel: 'Medium',
    StrategyClass: RSIMeanReversionStrategy
  },
  dca: {
    id: 'dca',
    name: 'Dollar Cost Averaging',
    description: 'Regular interval buying with technical exit conditions.',
    category: 'DCA',
    riskLevel: 'Low',
    StrategyClass: DCAStrategy
  },
  vwapBounce: {
    id: 'vwapBounce',
    name: 'VWAP Bounce',
    description: 'Trades price bounces off VWAP levels with volume confirmation.',
    category: 'Mean Reversion',
    riskLevel: 'High',
    StrategyClass: VWAPBounceStrategy
  },
  microScalping: {
    id: 'microScalping',
    name: 'Micro Scalping (1H)',
    description: 'High-frequency 1H trading with 0.8% entries and 1.5% profit targets.',
    category: 'Scalping',
    riskLevel: 'High',
    StrategyClass: MicroScalpingStrategy
  },
  properScalping: {
    id: 'properScalping',
    name: 'Proper Scalping',
    description: 'Professional scalping with RSI, MACD, stop losses, and proper risk management.',
    category: 'Scalping',
    riskLevel: 'High',
    StrategyClass: ProperScalpingStrategy
  }
};

export function createStrategy(strategyId: string): Strategy {
  const strategyInfo = STRATEGIES[strategyId];
  if (!strategyInfo) {
    throw new Error(`Unknown strategy: ${strategyId}`);
  }
  return new strategyInfo.StrategyClass();
}

export function getStrategyList(): StrategyInfo[] {
  return Object.values(STRATEGIES);
}

export function getStrategyById(id: string): StrategyInfo | undefined {
  return STRATEGIES[id];
}