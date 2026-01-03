/**
 * @file calculator.ts
 * @description Performance calculation utilities for paper trading
 */

import type { Trade } from '../../strategies/base/StrategyTypes';
import type { PaperTradingState } from './state';

export class PaperTradingCalculator {
  /**
   * Calculate current performance metrics
   */
  calculatePerformance(
    state: PaperTradingState,
    currentPrice: number,
    initialBalance: number
  ): void {
    const btcValue = state.balance.btcPositions * currentPrice;
    const totalValue = state.balance.usd + btcValue + state.balance.vault;
    
    const pnl = totalValue - initialBalance;
    const pnlPercent = ((totalValue - initialBalance) / initialBalance) * 100;
    
    const { winRate, totalTrades } = this.calculateTradeStats(state.trades);
    
    state.performance = {
      totalValue,
      pnl,
      pnlPercent,
      winRate,
      totalTrades,
      totalRebalance: state.balance.vault
    };
  }

  /**
   * Calculate win rate and trade statistics
   */
  private calculateTradeStats(trades: Trade[]): { winRate: number; totalTrades: number } {
    if (trades.length === 0) {
      return { winRate: 0, totalTrades: 0 };
    }

    // Group trades into buy/sell pairs to calculate profits
    const buyTrades = trades.filter(t => t.type === 'buy');
    const sellTrades = trades.filter(t => t.type === 'sell');
    
    let completedTrades = 0;
    let profitableTrades = 0;
    
    // Simple profit calculation based on chronological order
    for (let i = 0; i < Math.min(buyTrades.length, sellTrades.length); i++) {
      const buy = buyTrades[i];
      const sell = sellTrades[i];
      
      if (buy && sell) {
        const profit = (sell.price - buy.price) * Math.min(buy.size, sell.size);
        completedTrades++;
        
        if (profit > 0) {
          profitableTrades++;
        }
      }
    }
    
    const winRate = completedTrades > 0 ? (profitableTrades / completedTrades) * 100 : 0;
    
    return {
      winRate,
      totalTrades: trades.length
    };
  }

  /**
   * Calculate total fees paid
   */
  calculateTotalFees(trades: Trade[]): number {
    return trades.reduce((total, trade) => total + (trade.fee || 0), 0);
  }

  /**
   * Calculate average trade size
   */
  calculateAverageTradeSize(trades: Trade[]): number {
    if (trades.length === 0) return 0;
    
    const totalSize = trades.reduce((total, trade) => total + trade.value, 0);
    return totalSize / trades.length;
  }

  /**
   * Calculate portfolio allocation
   */
  calculateAllocation(
    state: PaperTradingState,
    currentPrice: number
  ): { usd: number; btc: number; vault: number } {
    const btcValue = state.balance.btcPositions * currentPrice;
    const totalValue = state.balance.usd + btcValue + state.balance.vault;
    
    if (totalValue === 0) {
      return { usd: 0, btc: 0, vault: 0 };
    }
    
    return {
      usd: (state.balance.usd / totalValue) * 100,
      btc: (btcValue / totalValue) * 100,
      vault: (state.balance.vault / totalValue) * 100
    };
  }

  /**
   * Calculate maximum drawdown
   */
  calculateMaxDrawdown(trades: Trade[], initialBalance: number): number {
    if (trades.length === 0) return 0;
    
    let balance = initialBalance;
    let peak = initialBalance;
    let maxDrawdown = 0;
    
    trades.forEach(trade => {
      if (trade.type === 'buy') {
        balance -= trade.value + (trade.fee || 0);
      } else {
        balance += trade.value - (trade.fee || 0);
      }
      
      if (balance > peak) {
        peak = balance;
      }
      
      const drawdown = ((peak - balance) / peak) * 100;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    });
    
    return maxDrawdown;
  }

  /**
   * Calculate Sharpe ratio (simplified)
   */
  calculateSharpeRatio(trades: Trade[], timeframe: number = 365): number {
    if (trades.length < 2) return 0;
    
    const returns = this.calculateDailyReturns(trades);
    if (returns.length === 0) return 0;
    
    const avgReturn = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
    const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - avgReturn, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);
    
    if (stdDev === 0) return 0;
    
    // Annualized Sharpe ratio (assuming risk-free rate of 2%)
    const riskFreeRate = 0.02 / timeframe; // Daily risk-free rate
    return (avgReturn - riskFreeRate) / stdDev;
  }

  /**
   * Calculate daily returns from trades
   */
  private calculateDailyReturns(trades: Trade[]): number[] {
    const dailyBalances = new Map<string, number>();
    let currentBalance = 10000; // Initial balance
    
    trades.forEach(trade => {
      const date = new Date(trade.timestamp).toDateString();
      
      if (trade.type === 'buy') {
        currentBalance -= trade.value + (trade.fee || 0);
      } else {
        currentBalance += trade.value - (trade.fee || 0);
      }
      
      dailyBalances.set(date, currentBalance);
    });
    
    const balances = Array.from(dailyBalances.values());
    const returns: number[] = [];
    
    for (let i = 1; i < balances.length; i++) {
      const dailyReturn = (balances[i] - balances[i - 1]) / balances[i - 1];
      returns.push(dailyReturn);
    }
    
    return returns;
  }
}