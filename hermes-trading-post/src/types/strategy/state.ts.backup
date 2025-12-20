/**
 * @file strategy/state.ts
 * @description Strategy state and execution types
 */

import type { Position, Signal, Trade } from '../trading/core';
import type { DetailedBalance } from '../trading/balance';

// ============================
// Strategy State Types
// ============================

/**
 * Strategy state during execution
 */
export interface StrategyState {
  positions: Position[];          // Active positions
  balance: DetailedBalance;       // Current balance state
  lastSignal?: Signal;            // Most recent signal
  metadata?: {                    // Strategy-specific state
    [key: string]: any;
  };
}

/**
 * Paper trading state
 */
export interface PaperTradingState {
  isRunning: boolean;             // Whether paper trading is active
  strategy: any;                  // Active strategy instance
  balance: DetailedBalance;
  trades: Trade[];                // Executed trades
  currentSignal: Signal | null;   // Current signal
  performance: {
    totalValue: number;
    pnl: number;
    pnlPercent: number;
    winRate: number;
    totalTrades: number;
  };
  lastUpdate: number;             // Last update timestamp
}

/**
 * Persistent trading state for saving/loading
 */
export interface PersistentTradingState {
  isRunning: boolean;
  strategyType: string;
  strategyConfig: any;
  balance: DetailedBalance;
  positions: Position[];
  trades: Trade[];
  startTime: number;
  lastUpdateTime: number;
}
