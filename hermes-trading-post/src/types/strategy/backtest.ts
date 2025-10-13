/**
 * @file strategy/backtest.ts
 * @description Backtesting result and metrics types
 */

import type { Trade } from '../trading/core';

// ============================
// Backtest Result Types
// ============================

/**
 * Backtest result with comprehensive metrics
 */
export interface BacktestResult {
  trades: Trade[];                // All executed trades
  metrics: BacktestMetrics;
  equity: EquityPoint[];          // Equity curve data points
  chartData: BacktestChartData;   // Time series data for charts
}

/**
 * Comprehensive backtest metrics
 */
export interface BacktestMetrics {
  // Basic metrics
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  totalReturn: number;
  totalReturnPercent: number;
  maxDrawdown: number;
  maxDrawdownPercent: number;
  sharpeRatio: number;
  profitFactor: number;
  averageWin: number;
  averageLoss: number;
  averageHoldTime: number;        // in hours
  vaultBalance: number;
  btcGrowth: number;

  // Advanced metrics
  avgPositionSize: number;
  tradesPerDay: number;
  tradesPerWeek: number;
  tradesPerMonth: number;
  totalFees: number;
  feesAsPercentOfProfit: number;
  vaultCAGR: number;              // Compound Annual Growth Rate
  btcGrowthPercent: number;
  maxConsecutiveLosses: number;
  riskRewardRatio: number;

  // Balance growth metrics
  initialBalanceGrowth: number;
  initialBalanceGrowthPercent: number;
  finalTradingBalance: number;
  totalFeeRebates: number;
  netFeesAfterRebates: number;

  // Compound system metrics
  totalCompounded: number;
  compoundCount: number;
  avgCompoundSize: number;
  compoundAllocations: {
    btc: number;
    usd: number;
    usdc: number;
  };
  btcVaultValue: number;
  compoundGrowthRate: number;

  // Opportunity detection metrics
  opportunitiesDetected: number;
  preEmptiveOpportunities: number;
  multiTimeframeSignals: number;
  opportunitySuccessRate: number;
}

/**
 * Equity curve data point
 */
export interface EquityPoint {
  timestamp: number;
  value: number;
  btcBalance: number;
  usdBalance: number;
  vaultBalance: number;
}

/**
 * Chart data for backtest visualization
 */
export interface BacktestChartData {
  vaultGrowth: Array<{time: number; value: number}>;
  btcGrowth: Array<{time: number; value: number}>;
  equityCurve: Array<{time: number; value: number}>;
  drawdown: Array<{time: number; value: number}>;
  tradeDistribution: {
    daily: Map<string, number>;
    weekly: Map<string, number>;
    monthly: Map<string, number>;
  };
  compoundTimeline: Array<{
    time: number;
    amount: number;
    btcAllocation: number;
    usdAllocation: number;
    usdcAllocation: number;
  }>;
}
