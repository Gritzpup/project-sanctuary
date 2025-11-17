/**
 * TradeExecutor - Handles trade execution logic
 * Extracted from paperTradingService.ts
 */

import type { Trade, Signal } from '../../strategies/base/StrategyTypes';
import type { PaperTradingState } from './TradingStateManager';

export class TradeExecutor {
  private feePercent: number = 0.1;
  private asset: string = 'BTC';
  
  constructor(feePercent: number = 0.1, asset: string = 'BTC') {
    this.feePercent = feePercent;
    this.asset = asset;
  }
  
  /**
   * Process a trading signal and execute trades
   */
  processSignal(signal: Signal, currentPrice: number, state: PaperTradingState): PaperTradingState {
    const newState = { ...state };
    newState.currentSignal = signal;
    
    if (!signal || signal.action === 'HOLD') {
      return newState;
    }
    
    const fee = (signal.amount * currentPrice * this.feePercent) / 100;
    
    if (signal.action === 'BUY') {
      const totalCost = (signal.amount * currentPrice) + fee;
      
      if (newState.balance.usd >= totalCost) {
        // Execute buy
        newState.balance.usd -= totalCost;
        newState.balance.btcPositions += signal.amount;
        
        const trade: Trade = {
          id: `trade-${Date.now()}`,
          type: 'BUY',
          amount: signal.amount,
          price: currentPrice,
          fee,
          timestamp: Date.now(),
          reason: signal.reason,
          confidence: signal.confidence,
          strategyState: signal.indicators
        };
        
        newState.trades.push(trade);
        
      } else {
      }
    } else if (signal.action === 'SELL') {
      if (newState.balance.btcPositions >= signal.amount) {
        // Execute sell
        const proceeds = (signal.amount * currentPrice) - fee;
        newState.balance.usd += proceeds;
        newState.balance.btcPositions -= signal.amount;
        
        const trade: Trade = {
          id: `trade-${Date.now()}`,
          type: 'SELL',
          amount: signal.amount,
          price: currentPrice,
          fee,
          timestamp: Date.now(),
          reason: signal.reason,
          confidence: signal.confidence,
          strategyState: signal.indicators
        };
        
        newState.trades.push(trade);
        
      } else {
      }
    }
    
    // Update performance metrics
    newState.performance = this.calculatePerformance(newState, currentPrice);
    newState.lastUpdate = Date.now();
    
    return newState;
  }
  
  /**
   * Execute a manual buy order
   */
  executeManualBuy(amount: number, currentPrice: number, state: PaperTradingState): PaperTradingState {
    const newState = { ...state };
    const fee = (amount * currentPrice * this.feePercent) / 100;
    const totalCost = (amount * currentPrice) + fee;
    
    if (newState.balance.usd >= totalCost) {
      newState.balance.usd -= totalCost;
      newState.balance.btcPositions += amount;
      
      const trade: Trade = {
        id: `manual-${Date.now()}`,
        type: 'BUY',
        amount,
        price: currentPrice,
        fee,
        timestamp: Date.now(),
        reason: 'Manual Buy',
        confidence: 1.0
      };
      
      newState.trades.push(trade);
      newState.performance = this.calculatePerformance(newState, currentPrice);
      newState.lastUpdate = Date.now();
      
    }
    
    return newState;
  }
  
  /**
   * Execute a manual sell order
   */
  executeManualSell(amount: number, currentPrice: number, state: PaperTradingState): PaperTradingState {
    const newState = { ...state };
    
    if (newState.balance.btcPositions >= amount) {
      const fee = (amount * currentPrice * this.feePercent) / 100;
      const proceeds = (amount * currentPrice) - fee;
      
      newState.balance.usd += proceeds;
      newState.balance.btcPositions -= amount;
      
      const trade: Trade = {
        id: `manual-${Date.now()}`,
        type: 'SELL',
        amount,
        price: currentPrice,
        fee,
        timestamp: Date.now(),
        reason: 'Manual Sell',
        confidence: 1.0
      };
      
      newState.trades.push(trade);
      newState.performance = this.calculatePerformance(newState, currentPrice);
      newState.lastUpdate = Date.now();
      
    }
    
    return newState;
  }
  
  /**
   * Calculate performance metrics
   */
  private calculatePerformance(state: PaperTradingState, currentPrice: number): PaperTradingState['performance'] {
    const btcValue = state.balance.btcPositions * currentPrice;
    const btcVaultValue = state.balance.btcVault * currentPrice;
    const totalValue = state.balance.usd + btcValue + btcVaultValue + state.balance.vault;
    
    const initialBalance = 10000; // This should be passed as parameter
    const pnl = totalValue - initialBalance;
    const pnlPercent = (pnl / initialBalance) * 100;
    
    // Calculate win rate
    const completedTrades = state.trades.filter(t => t.type === 'SELL');
    let winningTrades = 0;
    
    for (let i = 0; i < completedTrades.length; i++) {
      const sellTrade = completedTrades[i];
      // Find corresponding buy trade
      const buyTrades = state.trades.filter(t => 
        t.type === 'BUY' && 
        t.timestamp < sellTrade.timestamp
      );
      
      if (buyTrades.length > 0) {
        const lastBuy = buyTrades[buyTrades.length - 1];
        if (sellTrade.price > lastBuy.price) {
          winningTrades++;
        }
      }
    }
    
    const winRate = completedTrades.length > 0 
      ? (winningTrades / completedTrades.length) * 100 
      : 0;
    
    return {
      totalValue,
      pnl,
      pnlPercent,
      winRate,
      totalTrades: state.trades.length
    };
  }
  
  /**
   * Set fee percentage
   */
  setFeePercent(feePercent: number): void {
    this.feePercent = feePercent;
  }
  
  /**
   * Set asset symbol
   */
  setAsset(asset: string): void {
    this.asset = asset;
  }
}