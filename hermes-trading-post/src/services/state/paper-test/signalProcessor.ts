// @ts-nocheck - Signal 'confidence' property compatibility
/**
 * @file signalProcessor.ts
 * @description Processes trading signals and manages strategy interaction
 */

import type { CandleData } from '../../../types/coinbase';
import type { PaperTestOptions } from './types';
import type { PaperTestStateManager } from './stateManager';
import type { TradeExecutor } from './tradeExecutor';

export class SignalProcessor {
  private stateManager: PaperTestStateManager;
  private tradeExecutor: TradeExecutor;

  constructor(stateManager: PaperTestStateManager, tradeExecutor: TradeExecutor) {
    this.stateManager = stateManager;
    this.tradeExecutor = tradeExecutor;
  }

  processCandle(candle: CandleData, options: PaperTestOptions): void {
    const state = this.stateManager.getState();
    
    // Update current price
    const currentPrice = candle.close;
    
    // Add candle to processed list
    this.stateManager.addProcessedCandle(candle);
    
    // Check if we have enough historical data for the strategy
    const requiredData = options.strategy.getRequiredHistoricalData();
    if (state.processedCandles.length < requiredData) {
      return; // Not enough data yet
    }
    
    // Feed candles array and current price to strategy
    const signal = options.strategy.analyze(state.processedCandles, currentPrice);
    
    // Log strategy signal
    if (signal.type !== 'hold') {
      this.stateManager.log(`Paper Test: Strategy signal - ${signal.type.toUpperCase()} at ${new Date(candle.time * 1000).toISOString()}, price: ${currentPrice}`);
      if (signal.confidence !== undefined) {
        this.stateManager.log(`Paper Test: Signal confidence: ${signal.confidence}`);
      }
    }
    
    // Process signal based on type
    this.processSignal(signal, currentPrice, candle.time, options);
    
    // Update positions with current price
    this.tradeExecutor.updatePositions(currentPrice);
  }

  private processSignal(signal: any, currentPrice: number, timestamp: number, options: PaperTestOptions): void {
    const state = this.stateManager.getState();

    if (signal.type === 'buy') {
      // Calculate position size based on available balance
      const size = options.strategy.calculatePositionSize(state.balance, signal, currentPrice);
      if (size > 0) {
        const amount = size * currentPrice;
        this.stateManager.log(`Paper Test: Executing BUY - Size: ${size.toFixed(8)} BTC, Amount: $${amount.toFixed(2)}, Balance: $${state.balance.toFixed(2)}`);
        this.tradeExecutor.executeBuy(amount, currentPrice, timestamp, options, signal.metadata);
      } else {
        this.stateManager.log(`Paper Test: BUY signal but insufficient balance or position size is 0`);
      }
    } else if (signal.type === 'sell' && signal.size) {
      this.stateManager.log(`Paper Test: Executing SELL - Size: ${signal.size.toFixed(8)} BTC, Price: $${currentPrice.toFixed(2)}, BTC Balance: ${state.btcBalance.toFixed(8)}`);
      this.tradeExecutor.executeSell(signal.size, currentPrice, timestamp, options);
    }
  }

  resetStrategyState(options: PaperTestOptions): void {
    if (!options.strategy) return;

    // Reset strategy-specific state
    const strategy = options.strategy as any;
    
    // Reset common strategy properties
    if (strategy.lastBuyTime !== undefined) {
      strategy.lastBuyTime = 0;
    }
    if (strategy.averageCost !== undefined) {
      strategy.averageCost = 0;
    }
    if (strategy.totalInvested !== undefined) {
      strategy.totalInvested = 0;
    }
    
    // Clear strategy positions
    if (strategy.state?.positions) {
      strategy.state.positions = [];
    }
    
    // Reset any other strategy-specific state
    if (strategy.reset && typeof strategy.reset === 'function') {
      strategy.reset();
    }
    
    this.stateManager.log('Paper Test: Strategy state reset');
  }
}