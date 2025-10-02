/**
 * @file types.ts
 * @description Type definitions for backtesting engine
 */

import type { CandleData, Trade, BacktestResult, StrategyState } from '../../../types/strategy/strategy';
import type { CompoundTransaction } from '../../trading/CompoundEngine';
import type { OpportunitySignal } from '../../trading/OpportunityDetector';

export interface BacktestConfig {
  initialBalance: number;
  startTime: number;
  endTime: number;
  feePercent: number; // Legacy - keeping for compatibility
  makerFeePercent: number; // Maker fee (limit orders)
  takerFeePercent: number; // Taker fee (market orders)
  feeRebatePercent: number; // Percentage of fees rebated (e.g., 25%)
  slippage: number;
}

export interface BacktestState {
  trades: Trade[];
  equityHistory: Array<{
    timestamp: number;
    value: number;
    btcBalance: number;
    usdBalance: number;
    vaultBalance: number;
  }>;
  peakValue: number;
  maxDrawdown: number;
  vaultGrowthHistory: Array<{time: number; value: number}>;
  btcGrowthHistory: Array<{time: number; value: number}>;
  drawdownHistory: Array<{time: number; value: number}>;
  totalFeesCollected: number;
  totalFeeRebates: number;
  initialBalanceGrowth: number;
  compoundTransactions: CompoundTransaction[];
  detectedOpportunities: OpportunitySignal[];
}

export interface TradeExecution {
  candle: CandleData;
  signal: any;
  state: StrategyState;
  executionPrice: number;
  size: number;
  cost: number;
  grossFee: number;
  feeRebate: number;
}

export interface ProfitDistribution {
  totalCost: number;
  netProceeds: number;
  profit: number;
  profitPercent: number;
  feeRebate: number;
}