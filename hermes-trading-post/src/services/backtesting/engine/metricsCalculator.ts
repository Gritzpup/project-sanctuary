/**
 * @file metricsCalculator.ts
 * @description Calculates comprehensive backtest metrics
 */

import type { BacktestResult, StrategyState, Trade } from '../../../types/strategy/strategy';
import type { CompoundEngine } from '../../trading/CompoundEngine';
import type { BacktestState, BacktestConfig } from './types';

export class MetricsCalculator {
  private config: BacktestConfig;
  private compoundEngine: CompoundEngine;

  constructor(config: BacktestConfig, compoundEngine: CompoundEngine) {
    this.config = config;
    this.compoundEngine = compoundEngine;
  }

  calculateMetrics(state: BacktestState, strategyState: StrategyState, lastPrice: number): BacktestResult['metrics'] {
    const trades = state.trades;
    const sellTrades = trades.filter(t => t.type === 'sell');
    const buyTrades = trades.filter(t => t.type === 'buy');
    
    // Basic metrics
    const wins = sellTrades.filter(t => (t.profit || 0) > 0).map(t => t.profit || 0);
    const losses = sellTrades.filter(t => (t.profit || 0) < 0).map(t => t.profit || 0);
    const winningTrades = wins.length;
    const losingTrades = losses.length;
    const winRate = sellTrades.length > 0 ? (winningTrades / sellTrades.length) * 100 : 0;
    
    // Portfolio value calculation
    const currentPrice = lastPrice;
    const btcValue = strategyState.balance.btcPositions * currentPrice;
    const btcVaultValue = strategyState.balance.btcVault * currentPrice;
    const totalValue = strategyState.balance.usd + btcValue + btcVaultValue + strategyState.balance.vault;
    
    const totalReturn = totalValue - this.config.initialBalance;
    const totalReturnPercent = (totalReturn / this.config.initialBalance) * 100;
    
    // Sharpe ratio (simplified)
    const returns = state.equityHistory.map((point, i) => {
      if (i === 0) return 0;
      return (point.value - state.equityHistory[i - 1].value) / state.equityHistory[i - 1].value;
    }).slice(1);
    
    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const returnStdDev = Math.sqrt(returns.reduce((sum, ret) => sum + Math.pow(ret - avgReturn, 2), 0) / returns.length);
    const sharpeRatio = returnStdDev > 0 ? (avgReturn / returnStdDev) * Math.sqrt(252) : 0;
    
    // Profit factor
    const grossProfit = wins.reduce((a, b) => a + b, 0);
    const grossLoss = Math.abs(losses.reduce((a, b) => a + b, 0));
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;
    
    // Average win/loss
    const averageWin = wins.length > 0 ? wins.reduce((a, b) => a + b, 0) / wins.length : 0;
    const averageLoss = losses.length > 0 ? Math.abs(losses.reduce((a, b) => a + b, 0) / losses.length) : 0;
    
    // Average hold time
    const holdTimes = sellTrades.map(sell => {
      const buyTrade = buyTrades.find(buy => buy.timestamp <= sell.timestamp);
      return buyTrade ? sell.timestamp - buyTrade.timestamp : 0;
    });
    const averageHoldTime = holdTimes.length > 0 ? holdTimes.reduce((a, b) => a + b, 0) / holdTimes.length : 0;
    
    // Position size metrics
    const avgPositionSize = buyTrades.length > 0 
      ? buyTrades.reduce((sum, t) => sum + t.value, 0) / buyTrades.length 
      : 0;

    // Trading frequency
    const timeSpanDays = (this.config.endTime - this.config.startTime) / (60 * 60 * 24);
    const tradesPerDay = trades.length / timeSpanDays;
    const tradesPerWeek = tradesPerDay * 7;
    const tradesPerMonth = tradesPerDay * 30;

    // Fee metrics
    const feesAsPercentOfProfit = grossProfit > 0 ? (state.totalFeesCollected / grossProfit) * 100 : 0;

    // CAGR calculation
    const years = timeSpanDays / 365;
    const vaultCAGR = years > 0 && strategyState.balance.vault > 0
      ? (Math.pow(1 + (strategyState.balance.vault / this.config.initialBalance), 1 / years) - 1) * 100
      : 0;

    // BTC growth
    const btcGrowthPercent = strategyState.balance.btcVault > 0 ? Infinity : 0;

    // Consecutive losses
    let maxConsecutiveLosses = 0;
    let currentConsecutiveLosses = 0;
    for (const trade of trades) {
      if (trade.type === 'sell' && (trade.profit || 0) < 0) {
        currentConsecutiveLosses++;
        maxConsecutiveLosses = Math.max(maxConsecutiveLosses, currentConsecutiveLosses);
      } else if (trade.type === 'sell' && (trade.profit || 0) > 0) {
        currentConsecutiveLosses = 0;
      }
    }

    // Risk reward ratio
    const riskRewardRatio = averageLoss > 0 ? averageWin / averageLoss : 0;
    
    // Compound metrics
    const compoundMetrics = this.compoundEngine.getMetrics(lastPrice);
    const compoundState = this.compoundEngine.getState();
    
    // Opportunity metrics
    const opportunityMetrics = {
      totalOpportunitiesDetected: state.detectedOpportunities.length,
      preEmptiveOpportunities: state.detectedOpportunities.filter(o => o.preEmptive).length,
      multiTimeframeSignals: state.detectedOpportunities.filter(o => o.timeframe === 'multi').length,
      opportunitySuccessRate: 0
    };

    return {
      totalTrades: trades.length,
      winningTrades,
      losingTrades,
      winRate,
      totalReturn,
      totalReturnPercent,
      maxDrawdown: state.maxDrawdown,
      maxDrawdownPercent: state.maxDrawdown,
      sharpeRatio,
      profitFactor,
      averageWin,
      averageLoss,
      averageHoldTime: averageHoldTime / 3600,
      vaultBalance: strategyState.balance.vault,
      btcGrowth: strategyState.balance.btcVault,
      avgPositionSize,
      tradesPerDay,
      tradesPerWeek,
      tradesPerMonth,
      totalFees: state.totalFeesCollected,
      feesAsPercentOfProfit,
      vaultCAGR,
      btcGrowthPercent,
      maxConsecutiveLosses,
      riskRewardRatio,
      initialBalanceGrowth: state.initialBalanceGrowth,
      initialBalanceGrowthPercent: (state.initialBalanceGrowth / this.config.initialBalance) * 100,
      finalTradingBalance: strategyState.balance.usd,
      totalFeeRebates: state.totalFeeRebates,
      netFeesAfterRebates: state.totalFeesCollected - state.totalFeeRebates,
      totalCompounded: compoundState.totalCompounded,
      compoundCount: compoundState.compoundCount,
      avgCompoundSize: compoundMetrics.avgCompoundSize,
      compoundAllocations: compoundMetrics.allocations,
      btcVaultValue: compoundMetrics.btcVaultValue,
      compoundGrowthRate: compoundState.totalCompounded > 0 ? (compoundState.totalCompounded / this.config.initialBalance) * 100 : 0,
      opportunitiesDetected: opportunityMetrics.totalOpportunitiesDetected,
      preEmptiveOpportunities: opportunityMetrics.preEmptiveOpportunities,
      multiTimeframeSignals: opportunityMetrics.multiTimeframeSignals,
      opportunitySuccessRate: opportunityMetrics.opportunitySuccessRate
    };
  }

  generateChartData(state: BacktestState): BacktestResult['chartData'] {
    // Generate trade distribution data
    const tradeDistribution = {
      daily: new Map<string, number>(),
      weekly: new Map<string, number>(),
      monthly: new Map<string, number>()
    };

    for (const trade of state.trades) {
      const date = new Date(trade.timestamp * 1000);
      
      // Daily
      const dayKey = date.toISOString().split('T')[0];
      tradeDistribution.daily.set(dayKey, (tradeDistribution.daily.get(dayKey) || 0) + 1);
      
      // Weekly
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay());
      const weekKey = weekStart.toISOString().split('T')[0];
      tradeDistribution.weekly.set(weekKey, (tradeDistribution.weekly.get(weekKey) || 0) + 1);
      
      // Monthly
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      tradeDistribution.monthly.set(monthKey, (tradeDistribution.monthly.get(monthKey) || 0) + 1);
    }

    // Generate compound transaction timeline
    const compoundTimeline = state.compoundTransactions.map(ct => ({
      time: ct.timestamp,
      amount: ct.profitAmount,
      btcAllocation: ct.btcAllocation,
      usdAllocation: ct.usdAllocation,
      usdcAllocation: ct.usdcAllocation
    }));

    return {
      vaultGrowth: state.vaultGrowthHistory || [],
      btcGrowth: state.btcGrowthHistory || [],
      equityCurve: (state.equityHistory || []).map(e => ({ time: e.timestamp, value: e.value })),
      drawdown: state.drawdownHistory || [],
      tradeDistribution,
      compoundTimeline
    };
  }
}