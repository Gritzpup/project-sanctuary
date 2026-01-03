/**
 * @file execution.ts
 * @description Paper trading execution engine
 */

import type { Strategy } from '../../strategies/base/Strategy';
import type { CandleData, Trade, Signal, StrategyState } from '../../strategies/base/StrategyTypes';
import type { PaperTradingState, PaperTradingConfig } from './state';

export class PaperTradingExecution {
  constructor(private config: PaperTradingConfig) {}

  /**
   * Execute a buy order
   */
  executeBuy(
    state: PaperTradingState,
    price: number,
    amount: number,
    signal: Signal
  ): { success: boolean; trade?: Trade; error?: string } {
    const fee = (amount * price) * (this.config.feePercent / 100);
    const totalCost = (amount * price) + fee;

    if (state.balance.usd < totalCost) {
      return {
        success: false,
        error: `Insufficient balance. Need $${totalCost.toFixed(2)}, have $${state.balance.usd.toFixed(2)}`
      };
    }

    // Create trade record
    const trade: Trade = {
      id: this.generateTradeId(),
      timestamp: Date.now(),
      type: 'buy',
      price,
      size: amount,
      fee,
      value: amount * price,
      signal: signal.reason,
      strategyType: state.strategy?.constructor.name || 'Unknown'
    };

    // Update balances
    state.balance.usd -= totalCost;
    state.balance.btcPositions += amount;
    state.trades.push(trade);

    return { success: true, trade };
  }

  /**
   * Execute a sell order
   */
  executeSell(
    state: PaperTradingState,
    price: number,
    amount: number,
    signal: Signal
  ): { success: boolean; trade?: Trade; error?: string } {
    if (state.balance.btcPositions < amount) {
      return {
        success: false,
        error: `Insufficient BTC. Need ${amount}, have ${state.balance.btcPositions}`
      };
    }

    const grossProceeds = amount * price;
    const fee = grossProceeds * (this.config.feePercent / 100);
    const netProceeds = grossProceeds - fee;

    // Create trade record
    const trade: Trade = {
      id: this.generateTradeId(),
      timestamp: Date.now(),
      type: 'sell',
      price,
      size: amount,
      fee,
      value: grossProceeds,
      signal: signal.reason,
      strategyType: state.strategy?.constructor.name || 'Unknown'
    };

    // Update balances
    state.balance.btcPositions -= amount;
    state.balance.usd += netProceeds;
    state.trades.push(trade);

    return { success: true, trade };
  }

  /**
   * Process a signal from the strategy
   */
  processSignal(
    state: PaperTradingState,
    signal: Signal,
    currentPrice: number
  ): { executed: boolean; trade?: Trade; error?: string } {
    if (!signal || signal.type === 'hold') {
      return { executed: false };
    }

    const amount = this.calculateTradeAmount(state, signal, currentPrice);
    
    if (amount <= 0) {
      return { executed: false, error: 'Invalid trade amount' };
    }

    if (signal.type === 'buy') {
      const result = this.executeBuy(state, currentPrice, amount, signal);
      return {
        executed: result.success,
        trade: result.trade,
        error: result.error
      };
    } else if (signal.type === 'sell') {
      const result = this.executeSell(state, currentPrice, amount, signal);
      return {
        executed: result.success,
        trade: result.trade,
        error: result.error
      };
    }

    return { executed: false, error: 'Unknown signal type' };
  }

  /**
   * Calculate trade amount based on signal and available balance
   */
  private calculateTradeAmount(
    state: PaperTradingState,
    signal: Signal,
    currentPrice: number
  ): number {
    if (signal.size && signal.size > 0) {
      return signal.size;
    }

    if (signal.type === 'buy') {
      // Use a percentage of available USD balance
      const availableUsd = state.balance.usd * 0.95; // Leave 5% buffer
      const fee = availableUsd * (this.config.feePercent / 100);
      const netAvailable = availableUsd - fee;
      return netAvailable / currentPrice;
    } else if (signal.type === 'sell') {
      // Sell all or percentage of BTC positions
      return state.balance.btcPositions;
    }

    return 0;
  }

  /**
   * Update strategy with current market data
   */
  updateStrategy(strategy: Strategy, candles: CandleData[]): void {
    if (!strategy || candles.length === 0) return;

    try {
      strategy.update(candles);
    } catch (error) {
    }
  }

  /**
   * Get strategy state for monitoring
   */
  getStrategyState(strategy: Strategy): StrategyState | null {
    if (!strategy) return null;

    try {
      return strategy.getState();
    } catch (error) {
      return null;
    }
  }

  /**
   * Generate unique trade ID
   */
  private generateTradeId(): string {
    return `trade_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}