/**
 * @file state.ts
 * @description Paper trading state management and interfaces
 */

import type { Strategy } from '../../strategies/base/Strategy';
import type { Trade, Signal } from '../../strategies/base/StrategyTypes';

export interface PaperTradingState {
  isRunning: boolean;
  isPaused?: boolean;
  strategy: Strategy | null;
  balance: {
    usd: number;
    btcVault: number;
    btcPositions: number;
    vault: number;
  };
  trades: Trade[];
  currentSignal: Signal | null;
  performance: {
    totalValue: number;
    pnl: number;
    pnlPercent: number;
    winRate: number;
    totalTrades: number;
    totalRebalance: number;
  };
  lastUpdate: number;
  chartData?: {
    recentHigh: number;
    recentLow: number;
    initialTradingPrice: number;
    initialRecentHigh: number;
    initialTradingAngle: number;
    lastTradeTime: number;
  };
}

export interface PaperTradingConfig {
  initialBalance: number;
  feePercent: number;
  asset: string;
  autoSaveInterval: number;
}

export const DEFAULT_CONFIG: PaperTradingConfig = {
  initialBalance: 10000,
  feePercent: 0.1,
  asset: 'BTC',
  autoSaveInterval: 100
};

export function createInitialState(config: PaperTradingConfig): PaperTradingState {
  return {
    isRunning: false,
    isPaused: false,
    strategy: null,
    balance: {
      usd: config.initialBalance,
      btcVault: 0,
      btcPositions: 0,
      vault: 0
    },
    trades: [],
    currentSignal: null,
    performance: {
      totalValue: config.initialBalance,
      pnl: 0,
      pnlPercent: 0,
      winRate: 0,
      totalTrades: 0,
      totalRebalance: 0
    },
    lastUpdate: Date.now(),
    chartData: undefined
  };
}