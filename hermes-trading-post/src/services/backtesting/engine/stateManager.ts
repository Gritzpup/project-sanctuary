/**
 * @file stateManager.ts
 * @description Manages backtesting state and equity tracking
 */

import type { CandleData, StrategyState } from '../../../types/strategy/strategy';
import type { BacktestState, BacktestConfig } from './types';

export class BacktestStateManager {
  private state: BacktestState;
  private config: BacktestConfig;

  constructor(config: BacktestConfig) {
    this.config = config;
    this.state = this.createInitialState();
  }

  private createInitialState(): BacktestState {
    return {
      trades: [],
      equityHistory: [],
      peakValue: this.config.initialBalance,
      maxDrawdown: 0,
      vaultGrowthHistory: [],
      btcGrowthHistory: [],
      drawdownHistory: [],
      totalFeesCollected: 0,
      totalFeeRebates: 0,
      initialBalanceGrowth: 0,
      compoundTransactions: [],
      detectedOpportunities: []
    };
  }

  getState(): BacktestState {
    return this.state;
  }

  reset(): void {
    this.state = this.createInitialState();
  }

  addTrade(trade: any): void {
    this.state.trades.push(trade);
  }

  addCompoundTransaction(transaction: any): void {
    this.state.compoundTransactions.push(transaction);
  }

  addDetectedOpportunity(opportunity: any): void {
    this.state.detectedOpportunities.push(opportunity);
  }

  updateFees(grossFee: number, feeRebate: number): void {
    this.state.totalFeesCollected += grossFee;
    this.state.totalFeeRebates += feeRebate;
  }

  updateInitialBalanceGrowth(growth: number): void {
    this.state.initialBalanceGrowth = growth;
  }

  updateEquity(candle: CandleData, strategyState: StrategyState): void {
    // Calculate total portfolio value
    const currentPrice = candle.close;
    const btcValue = strategyState.balance.btcPositions * currentPrice;
    const btcVaultValue = strategyState.balance.btcVault * currentPrice;
    const totalValue = strategyState.balance.usd + btcValue + btcVaultValue + strategyState.balance.vault;

    // Record equity point
    this.state.equityHistory.push({
      timestamp: candle.time,
      value: totalValue,
      btcBalance: strategyState.balance.btcPositions,
      usdBalance: strategyState.balance.usd,
      vaultBalance: strategyState.balance.vault
    });

    // Update drawdown tracking
    if (totalValue > this.state.peakValue) {
      this.state.peakValue = totalValue;
    } else {
      const drawdown = ((this.state.peakValue - totalValue) / this.state.peakValue) * 100;
      this.state.maxDrawdown = Math.max(this.state.maxDrawdown, drawdown);
    }

    // Update vault growth history
    this.state.vaultGrowthHistory.push({
      time: candle.time,
      value: strategyState.balance.vault
    });

    // Update BTC growth history
    this.state.btcGrowthHistory.push({
      time: candle.time,
      value: btcVaultValue
    });

    // Update drawdown history
    const currentDrawdown = this.state.peakValue > 0 
      ? ((this.state.peakValue - totalValue) / this.state.peakValue) * 100 
      : 0;
    this.state.drawdownHistory.push({
      time: candle.time,
      value: currentDrawdown
    });
  }
}