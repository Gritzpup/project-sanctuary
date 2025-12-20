/**
 * BacktestMetrics - Calculates and manages backtest performance metrics
 * Extracted from backtestingEngine.ts
 */

import type { Trade, BacktestResult } from '../../strategies/base/StrategyTypes';

export class BacktestMetrics {
  private peakValue: number = 0;
  private maxDrawdown: number = 0;
  private equityHistory: Array<{
    timestamp: number;
    value: number;
    btcBalance: number;
    usdBalance: number;
    vaultBalance: number;
  }> = [];
  private vaultGrowthHistory: Array<{time: number; value: number}> = [];
  private btcGrowthHistory: Array<{time: number; value: number}> = [];
  private drawdownHistory: Array<{time: number; value: number}> = [];
  
  constructor(initialBalance: number) {
    this.peakValue = initialBalance;
  }
  
  /**
   * Update equity tracking
   */
  updateEquity(
    timestamp: number,
    totalValue: number,
    btcBalance: number,
    usdBalance: number,
    vaultBalance: number
  ): void {
    this.equityHistory.push({
      timestamp,
      value: totalValue,
      btcBalance,
      usdBalance,
      vaultBalance
    });
    
    // Update peak and drawdown
    if (totalValue > this.peakValue) {
      this.peakValue = totalValue;
    }
    
    const currentDrawdown = ((this.peakValue - totalValue) / this.peakValue) * 100;
    if (currentDrawdown > this.maxDrawdown) {
      this.maxDrawdown = currentDrawdown;
    }
    
    this.drawdownHistory.push({
      time: timestamp,
      value: currentDrawdown
    });
  }
  
  /**
   * Update vault growth tracking
   */
  updateVaultGrowth(timestamp: number, vaultValue: number): void {
    this.vaultGrowthHistory.push({
      time: timestamp,
      value: vaultValue
    });
  }
  
  /**
   * Update BTC growth tracking
   */
  updateBtcGrowth(timestamp: number, btcValue: number): void {
    this.btcGrowthHistory.push({
      time: timestamp,
      value: btcValue
    });
  }
  
  /**
   * Calculate final metrics
   */
  calculateFinalMetrics(
    trades: Trade[],
    initialBalance: number,
    finalValue: number,
    totalFeesCollected: number,
    totalFeeRebates: number
  ): Partial<BacktestResult> {
    const totalReturn = ((finalValue - initialBalance) / initialBalance) * 100;
    
    // Calculate win rate
    let winningTrades = 0;
    let losingTrades = 0;
    let totalProfit = 0;
    let totalLoss = 0;
    
    // Group trades by position (buy followed by sell)
    const positions: Array<{buyPrice: number; sellPrice: number; profit: number}> = [];
    let currentBuyPrice = 0;
    
    for (const trade of trades) {
      if (trade.type === 'BUY') {
        currentBuyPrice = trade.price;
      } else if (trade.type === 'SELL' && currentBuyPrice > 0) {
        const profit = (trade.price - currentBuyPrice) * trade.amount - trade.fee;
        positions.push({
          buyPrice: currentBuyPrice,
          sellPrice: trade.price,
          profit
        });
        
        if (profit > 0) {
          winningTrades++;
          totalProfit += profit;
        } else {
          losingTrades++;
          totalLoss += Math.abs(profit);
        }
        
        currentBuyPrice = 0;
      }
    }
    
    const winRate = trades.length > 0 
      ? (winningTrades / (winningTrades + losingTrades)) * 100 
      : 0;
    
    const profitFactor = totalLoss > 0 ? totalProfit / totalLoss : totalProfit > 0 ? Infinity : 0;
    
    // Calculate Sharpe ratio (simplified - assuming daily returns)
    const returns: number[] = [];
    for (let i = 1; i < this.equityHistory.length; i++) {
      const dailyReturn = (this.equityHistory[i].value - this.equityHistory[i-1].value) / this.equityHistory[i-1].value;
      returns.push(dailyReturn);
    }
    
    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const stdDev = Math.sqrt(
      returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length
    );
    
    const sharpeRatio = stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(252) : 0; // Annualized
    
    return {
      totalReturn,
      winRate,
      maxDrawdown: this.maxDrawdown,
      sharpeRatio,
      profitFactor,
      totalTrades: trades.length,
      winningTrades,
      losingTrades,
      equityHistory: this.equityHistory,
      vaultGrowthHistory: this.vaultGrowthHistory,
      btcGrowthHistory: this.btcGrowthHistory,
      drawdownHistory: this.drawdownHistory,
      totalFeesCollected,
      totalFeeRebates,
      netFees: totalFeesCollected - totalFeeRebates
    };
  }
  
  /**
   * Reset all metrics
   */
  reset(initialBalance: number): void {
    this.peakValue = initialBalance;
    this.maxDrawdown = 0;
    this.equityHistory = [];
    this.vaultGrowthHistory = [];
    this.btcGrowthHistory = [];
    this.drawdownHistory = [];
  }
  
  /**
   * Get current metrics snapshot
   */
  getSnapshot(): {
    peakValue: number;
    maxDrawdown: number;
    equityCount: number;
  } {
    return {
      peakValue: this.peakValue,
      maxDrawdown: this.maxDrawdown,
      equityCount: this.equityHistory.length
    };
  }
}