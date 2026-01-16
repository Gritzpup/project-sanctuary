// @ts-nocheck - Trade execution with complex type interactions
/**
 * @file tradeExecutor.ts
 * @description Handles trade execution logic and fee calculations
 */

import type { CandleData, Trade, StrategyState } from '../../../types/strategy/strategy';
import type { Strategy } from '../../../strategies/base/Strategy';
import type { BacktestConfig, TradeExecution, ProfitDistribution } from './types';
import type { BacktestStateManager } from './stateManager';

export class TradeExecutor {
  private config: BacktestConfig;
  private stateManager: BacktestStateManager;

  constructor(config: BacktestConfig, stateManager: BacktestStateManager) {
    this.config = config;
    this.stateManager = stateManager;
  }

  processBuySignal(signal: any, candle: CandleData, state: StrategyState, strategy: Strategy): void {
    const size = signal.size || (state.balance.usd * 0.95) / candle.close;
    
    // Apply slippage
    const executionPrice = candle.close * (1 + this.config.slippage / 100);
    const cost = size * executionPrice;
    
    if (cost > state.balance.usd) {
      return;
    }

    // Use maker fee for buys (limit orders)
    const feePercent = this.config.makerFeePercent || this.config.feePercent || 0.50;
    const grossFee = cost * (feePercent / 100);
    const feeRebate = grossFee * ((this.config.feeRebatePercent || 0) / 100);
    
    // Deduct cost and full gross fee from USD
    state.balance.usd -= (cost + grossFee);
    state.balance.btcPositions += size;
    
    // Add fee rebate back to USD balance
    if (feeRebate > 0) {
      state.balance.usd += feeRebate;
    }
    
    this.stateManager.updateFees(grossFee, feeRebate);

    // Calculate actual cost per BTC including fees for accurate P&L tracking
    const actualCostPerBtc = (cost + grossFee - feeRebate) / size;
    
    // Create position record
    const position = {
      entryPrice: executionPrice,
      entryTime: candle.time,
      size: size,
      type: 'long' as const,
      metadata: {
        level: signal.metadata?.level,
        reason: signal.reason,
        actualCostPerBtc: actualCostPerBtc
      }
    };

    strategy.addPosition(position);

    // Record trade
    const trade: Trade = {
      id: `trade-${this.stateManager.getState().trades.length + 1}`,
      timestamp: candle.time,
      type: 'buy',
      price: executionPrice,
      size: size,
      value: cost,
      fee: grossFee,
      grossFee: grossFee,
      feeRebate: feeRebate,
      position: position,
      reason: signal.reason
    };

    this.stateManager.addTrade(trade);
    
    // Update strategy state after trade
    strategy.setState(state);
  }

  processSellSignal(signal: any, candle: CandleData, state: StrategyState, strategy: Strategy): void {
    const size = signal.size || strategy.getTotalPositionSize();
    if (size <= 0) return;
    
    // Double-check we have enough BTC to sell
    if (size > state.balance.btcPositions) {
      return;
    }

    // Apply slippage
    const executionPrice = candle.close * (1 - this.config.slippage / 100);
    const proceeds = size * executionPrice;
    
    // Use taker fee for sells (market orders)
    const feePercent = this.config.takerFeePercent || this.config.feePercent || 0.75;
    const grossFee = proceeds * (feePercent / 100);
    const feeRebate = grossFee * ((this.config.feeRebatePercent || 0) / 100);
    
    // Deduct full gross fee from proceeds
    const netProceeds = proceeds - grossFee;
    
    // Add fee rebate back to USD balance BEFORE profit distribution
    if (feeRebate > 0) {
      state.balance.usd += feeRebate;
    }

    this.stateManager.updateFees(grossFee, feeRebate);

    // Calculate profit using FIFO accounting
    const profitData = this.calculateProfit(size, netProceeds, strategy);

    // Update BTC positions
    state.balance.btcPositions -= size;
    

    // Handle position cleanup
    this.handlePositionCleanup(signal, state, strategy);

    // Record trade
    const trade: Trade = {
      id: `trade-${this.stateManager.getState().trades.length + 1}`,
      timestamp: candle.time,
      type: 'sell',
      price: executionPrice,
      size: size,
      value: proceeds,
      fee: grossFee,
      grossFee: grossFee,
      feeRebate: feeRebate,
      profit: profitData.profit,
      profitPercent: profitData.profitPercent,
      reason: signal.reason
    };

    this.stateManager.addTrade(trade);
    
    // Update strategy state after trade
    strategy.setState(state);

    // Return profit data for compound processing
    return profitData;
  }

  private calculateProfit(size: number, netProceeds: number, strategy: Strategy): ProfitDistribution {
    // Calculate profit using FIFO (First In, First Out) accounting
    const positions = strategy.getPositions();
    let totalCost = 0;
    let remainingSize = size;

    // FIFO position closing - iterate through positions in order acquired
    const closedPositions = [];
    for (const position of positions) {
      if (remainingSize <= 0) break;
      
      // Calculate how much of this position to close
      const closeSize = Math.min(remainingSize, position.size);
      
      // Use actual cost per BTC including buy fees for accurate P&L
      const costPerBtc = position.metadata?.actualCostPerBtc || position.entryPrice;
      totalCost += closeSize * costPerBtc;
      remainingSize -= closeSize;
      
      // Mark position for removal if fully closed
      if (closeSize === position.size) {
        closedPositions.push(position);
      }
    }

    // Remove closed positions
    closedPositions.forEach(p => strategy.removePosition(p));

    // Calculate net profit after all fees
    const profit = netProceeds - totalCost;
    const profitPercent = (profit / totalCost) * 100;

    return {
      totalCost,
      netProceeds,
      profit,
      profitPercent,
      feeRebate: 0 // This is handled separately
    };
  }

  private handlePositionCleanup(signal: any, state: StrategyState, strategy: Strategy): void {
    // If this was a complete exit, ensure all positions are cleared
    if (signal.metadata?.isCompleteExit && state.balance.btcPositions <= 0.0000001) {
      // Clear all remaining positions from strategy
      const remainingPositions = strategy.getPositions();
      remainingPositions.forEach(p => strategy.removePosition(p));
    }
  }
}