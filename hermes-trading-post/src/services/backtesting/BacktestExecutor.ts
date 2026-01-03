/**
 * BacktestExecutor - Handles trade execution during backtesting
 * Extracted from backtestingEngine.ts
 */

import type { StrategyState } from '../../strategies/base/StrategyTypes';

// Backtest-specific signal interface
interface BacktestSignal {
  action: 'BUY' | 'SELL' | 'HOLD';
  amount: number;
  reason: string;
  orderType?: 'limit' | 'market';
  confidence?: number;
  indicators?: Record<string, unknown>;
}

// Backtest-specific trade interface
interface BacktestTrade {
  id: string;
  type: 'BUY' | 'SELL';
  amount: number;
  price: number;
  fee: number;
  timestamp: number;
  reason: string;
  confidence?: number;
  strategyState?: Record<string, unknown>;
}

export interface ExecutionConfig {
  makerFeePercent: number;
  takerFeePercent: number;
  feeRebatePercent: number;
  slippage: number;
}

export class BacktestExecutor {
  private config: ExecutionConfig;
  private totalFeesCollected: number = 0;
  private totalFeeRebates: number = 0;
  
  constructor(config: ExecutionConfig) {
    this.config = config;
  }
  
  /**
   * Execute a trade signal
   */
  executeSignal(
    signal: BacktestSignal,
    currentPrice: number,
    state: StrategyState,
    timestamp: number
  ): {
    newState: StrategyState;
    trade: BacktestTrade | null;
    feeCollected: number;
    feeRebate: number;
  } {
    if (!signal || signal.action === 'HOLD') {
      return { 
        newState: state, 
        trade: null,
        feeCollected: 0,
        feeRebate: 0
      };
    }
    
    const executionPrice = this.applySlippage(currentPrice, signal.action);
    let feeCollected = 0;
    let feeRebate = 0;
    
    // Determine if this is a maker or taker order
    // For simplicity, assume limit orders are makers and market orders are takers
    const isMaker = signal.orderType === 'limit';
    const feePercent = isMaker ? this.config.makerFeePercent : this.config.takerFeePercent;
    
    if (signal.action === 'BUY' && signal.amount > 0) {
      const cost = signal.amount * executionPrice;
      const fee = (cost * feePercent) / 100;
      const rebate = (fee * this.config.feeRebatePercent) / 100;
      const netFee = fee - rebate;
      const totalCost = cost + netFee;
      
      if (state.balance.usd >= totalCost) {
        // Execute buy
        const newState = {
          ...state,
          balance: {
            ...state.balance,
            usd: state.balance.usd - totalCost,
            btcPositions: state.balance.btcPositions + signal.amount
          }
        };
        
        const trade: BacktestTrade = {
          id: `backtest-${timestamp}`,
          type: 'BUY',
          amount: signal.amount,
          price: executionPrice,
          fee: netFee,
          timestamp,
          reason: signal.reason,
          confidence: signal.confidence,
          strategyState: signal.indicators
        };
        
        feeCollected = fee;
        feeRebate = rebate;
        this.totalFeesCollected += fee;
        this.totalFeeRebates += rebate;
        
        return { newState, trade, feeCollected, feeRebate };
      }
    } else if (signal.action === 'SELL' && signal.amount > 0) {
      if (state.balance.btcPositions >= signal.amount) {
        const proceeds = signal.amount * executionPrice;
        const fee = (proceeds * feePercent) / 100;
        const rebate = (fee * this.config.feeRebatePercent) / 100;
        const netFee = fee - rebate;
        const netProceeds = proceeds - netFee;
        
        // Execute sell
        const newState = {
          ...state,
          balance: {
            ...state.balance,
            usd: state.balance.usd + netProceeds,
            btcPositions: state.balance.btcPositions - signal.amount
          }
        };
        
        const trade: BacktestTrade = {
          id: `backtest-${timestamp}`,
          type: 'SELL',
          amount: signal.amount,
          price: executionPrice,
          fee: netFee,
          timestamp,
          reason: signal.reason,
          confidence: signal.confidence,
          strategyState: signal.indicators
        };
        
        feeCollected = fee;
        feeRebate = rebate;
        this.totalFeesCollected += fee;
        this.totalFeeRebates += rebate;
        
        return { newState, trade, feeCollected, feeRebate };
      }
    }
    
    return { 
      newState: state, 
      trade: null,
      feeCollected: 0,
      feeRebate: 0
    };
  }
  
  /**
   * Apply slippage to execution price
   */
  private applySlippage(price: number, action: 'BUY' | 'SELL' | 'HOLD'): number {
    if (this.config.slippage === 0) return price;
    
    const slippageMultiplier = this.config.slippage / 100;
    
    if (action === 'BUY') {
      // Buying incurs positive slippage (pay more)
      return price * (1 + slippageMultiplier);
    } else if (action === 'SELL') {
      // Selling incurs negative slippage (receive less)
      return price * (1 - slippageMultiplier);
    }
    
    return price;
  }
  
  /**
   * Get total fees collected
   */
  getTotalFeesCollected(): number {
    return this.totalFeesCollected;
  }
  
  /**
   * Get total fee rebates
   */
  getTotalFeeRebates(): number {
    return this.totalFeeRebates;
  }
  
  /**
   * Get net fees (fees - rebates)
   */
  getNetFees(): number {
    return this.totalFeesCollected - this.totalFeeRebates;
  }
  
  /**
   * Reset executor state
   */
  reset(): void {
    this.totalFeesCollected = 0;
    this.totalFeeRebates = 0;
  }
  
  /**
   * Calculate position size based on risk management
   */
  calculatePositionSize(
    signal: BacktestSignal,
    balance: number,
    currentPrice: number,
    maxPositionPercent: number = 100
  ): number {
    if (!signal || signal.action === 'HOLD') return 0;
    
    // Apply confidence-based sizing
    const confidenceMultiplier = signal.confidence || 1;
    
    // Calculate maximum position based on balance
    const maxPositionValue = (balance * maxPositionPercent) / 100;
    const maxAmount = maxPositionValue / currentPrice;
    
    // Apply confidence and ensure we don't exceed max
    const targetAmount = signal.amount * confidenceMultiplier;
    
    return Math.min(targetAmount, maxAmount);
  }
}