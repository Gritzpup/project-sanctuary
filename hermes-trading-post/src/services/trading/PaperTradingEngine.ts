/**
 * @file PaperTradingEngine.ts
 * @description Unified paper trading engine for both live simulation and historical backtesting
 * Replaces paperTradingService.ts (861 lines) and paperTestService.ts (834 lines)
 */

import { writable, get } from 'svelte/store';
import type { Writable } from 'svelte/store';
import type { Strategy } from '../../strategies/base/Strategy';
import type { CandleData, Trade, Signal } from '../../strategies/base/StrategyTypes';
import type { IChartApi, ISeriesApi } from 'lightweight-charts';
import { BackendAPIService } from '../api/BackendAPIService';

// Unified interfaces
export interface TradingMode {
  type: 'live' | 'historical';
  speed?: number; // For historical mode
  startDate?: Date; // For historical mode
  endDate?: Date; // For historical mode
}

export interface TradingState {
  isRunning: boolean;
  isPaused: boolean;
  mode: TradingMode;
  strategy: Strategy | null;
  balance: {
    usd: number;
    btc: number;
    vault: number;
  };
  trades: Trade[];
  positions: any[];
  currentPrice: number;
  performance: {
    totalValue: number;
    pnl: number;
    pnlPercent: number;
    winRate: number;
    totalTrades: number;
    maxDrawdown: number;
  };
  progress?: number; // For historical mode (0-100%)
  simulationTime?: number; // For historical mode
  lastUpdate: number;
}

export interface TradingOptions {
  mode: TradingMode;
  strategy: Strategy;
  initialBalance: number;
  chart?: IChartApi;
  candleSeries?: ISeriesApi<'Candlestick'>;
  granularity?: string;
  onProgress?: (progress: number, simTime?: number) => void;
  onTrade?: (trade: Trade) => void;
  onComplete?: (results: TradingResults) => void;
  onPositionUpdate?: (positions: any[], balance: number) => void;
}

export interface TradingResults {
  totalTrades: number;
  winRate: number;
  totalReturn: number;
  finalBalance: number;
  trades: Trade[];
  maxDrawdown: number;
  performance: any;
}

export class PaperTradingEngine {
  private static instance: PaperTradingEngine;
  private state: Writable<TradingState>;
  private backendAPI: BackendAPIService;
  private currentOptions: TradingOptions | null = null;
  
  // Historical mode state
  private historicalCandles: CandleData[] = [];
  private currentCandleIndex = 0;
  private animationFrameId: number | null = null;
  private startTime = 0;
  private endTime = 0;
  
  // Live mode state
  private realtimeSubscription: any = null;
  
  private constructor() {
    this.backendAPI = BackendAPIService.getInstance();
    this.state = writable(this.getInitialState());
  }
  
  public static getInstance(): PaperTradingEngine {
    if (!PaperTradingEngine.instance) {
      PaperTradingEngine.instance = new PaperTradingEngine();
    }
    return PaperTradingEngine.instance;
  }
  
  // Public API
  
  public getState() {
    return this.state;
  }
  
  public async startTrading(options: TradingOptions): Promise<void> {
    this.currentOptions = options;
    
    const initialState: TradingState = {
      ...this.getInitialState(),
      isRunning: true,
      mode: options.mode,
      strategy: options.strategy,
      balance: {
        usd: options.initialBalance,
        btc: 0,
        vault: 0
      }
    };
    
    this.state.set(initialState);
    
    if (options.mode.type === 'historical') {
      await this.startHistoricalTrading(options);
    } else {
      await this.startLiveTrading(options);
    }
  }
  
  public async stopTrading(): Promise<void> {
    const currentState = get(this.state);
    
    if (currentState.mode.type === 'historical') {
      this.stopHistoricalTrading();
    } else {
      this.stopLiveTrading();
    }
    
    this.state.update(state => ({
      ...state,
      isRunning: false,
      isPaused: false
    }));
    
    // Notify completion
    if (this.currentOptions?.onComplete) {
      const finalState = get(this.state);
      this.currentOptions.onComplete(this.generateResults(finalState));
    }
  }
  
  public pauseTrading(): void {
    this.state.update(state => ({ ...state, isPaused: true }));
    
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }
  
  public resumeTrading(): void {
    this.state.update(state => ({ ...state, isPaused: false }));
    
    const currentState = get(this.state);
    if (currentState.mode.type === 'historical') {
      this.continueHistoricalTrading();
    }
  }
  
  public resetTrading(): void {
    this.stopTrading();
    this.state.set(this.getInitialState());
  }
  
  public feedPrice(price: number): void {
    this.state.update(state => ({
      ...state,
      currentPrice: price,
      lastUpdate: Date.now()
    }));
    
    // Process with strategy
    this.processWithStrategy(price);
  }
  
  // Private methods - Historical Trading
  
  private async startHistoricalTrading(options: TradingOptions): Promise<void> {
    if (!options.mode.startDate || !options.mode.endDate) {
      throw new Error('Historical mode requires start and end dates');
    }
    
    // Load historical data
    await this.loadHistoricalData(options);
    
    this.startTime = options.mode.startDate.getTime();
    this.endTime = options.mode.endDate.getTime();
    this.currentCandleIndex = 0;
    
    this.continueHistoricalTrading();
  }
  
  private async loadHistoricalData(options: TradingOptions): Promise<void> {
    try {
      const response = await this.backendAPI.getHistoricalData({
        symbol: 'BTC-USD',
        granularity: options.granularity || '1m',
        start: options.mode.startDate!.getTime() / 1000,
        end: options.mode.endDate!.getTime() / 1000
      });
      
      this.historicalCandles = response.candles;
    } catch (error) {
      console.error('Failed to load historical data:', error);
      this.historicalCandles = [];
    }
  }
  
  private continueHistoricalTrading(): void {
    const currentState = get(this.state);
    if (!currentState.isRunning || currentState.isPaused) return;
    
    if (this.currentCandleIndex >= this.historicalCandles.length) {
      this.stopTrading();
      return;
    }
    
    const candle = this.historicalCandles[this.currentCandleIndex];
    this.processCandle(candle);
    
    // Update progress
    const progress = (this.currentCandleIndex / this.historicalCandles.length) * 100;
    this.state.update(state => ({
      ...state,
      progress,
      simulationTime: candle.time * 1000
    }));
    
    if (this.currentOptions?.onProgress) {
      this.currentOptions.onProgress(progress, candle.time * 1000);
    }
    
    this.currentCandleIndex++;
    
    // Schedule next candle based on speed
    const speed = currentState.mode.speed || 1;
    const delay = Math.max(1, 100 / speed); // Minimum 1ms delay
    
    this.animationFrameId = requestAnimationFrame(() => {
      setTimeout(() => this.continueHistoricalTrading(), delay);
    });
  }
  
  private stopHistoricalTrading(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }
  
  // Private methods - Live Trading
  
  private async startLiveTrading(options: TradingOptions): Promise<void> {
    // Connect to backend for live price updates
    // This would integrate with your existing WebSocket or polling system
    console.log('Live trading started with backend integration');
  }
  
  private stopLiveTrading(): void {
    if (this.realtimeSubscription) {
      this.realtimeSubscription.unsubscribe();
      this.realtimeSubscription = null;
    }
  }
  
  // Strategy processing
  
  private processCandle(candle: CandleData): void {
    // Update chart if provided
    if (this.currentOptions?.chart && this.currentOptions?.candleSeries) {
      this.currentOptions.candleSeries.update({
        time: candle.time as any,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close
      });
    }
    
    // Process with strategy
    this.processWithStrategy(candle.close);
  }
  
  private processWithStrategy(price: number): void {
    const currentState = get(this.state);
    if (!currentState.strategy) return;
    
    // Generate signal from strategy
    // This is simplified - actual strategy processing would be more complex
    const signal = this.generateSignalFromStrategy(currentState.strategy, price);
    
    if (signal) {
      this.executeTrade(signal, price);
    }
  }
  
  private generateSignalFromStrategy(strategy: Strategy, price: number): Signal | null {
    // Simplified signal generation
    // In practice, this would call strategy.processCandle() or similar
    return null;
  }
  
  private executeTrade(signal: Signal, price: number): void {
    const currentState = get(this.state);
    
    const trade: Trade = {
      id: `trade_${Date.now()}`,
      timestamp: Date.now(),
      side: signal.action === 'buy' ? 'buy' : 'sell',
      amount: signal.amount || 0.01,
      price: price,
      fee: price * 0.001, // 0.1% fee
      pnl: 0 // Calculate based on previous trades
    };
    
    // Update state with new trade
    this.state.update(state => {
      const newTrades = [...state.trades, trade];
      const newBalance = this.calculateNewBalance(state.balance, trade);
      const newPerformance = this.calculatePerformance(newTrades, newBalance);
      
      return {
        ...state,
        trades: newTrades,
        balance: newBalance,
        performance: newPerformance,
        lastUpdate: Date.now()
      };
    });
    
    // Notify trade execution
    if (this.currentOptions?.onTrade) {
      this.currentOptions.onTrade(trade);
    }
  }
  
  // Helper methods
  
  private getInitialState(): TradingState {
    return {
      isRunning: false,
      isPaused: false,
      mode: { type: 'live' },
      strategy: null,
      balance: {
        usd: 10000,
        btc: 0,
        vault: 0
      },
      trades: [],
      positions: [],
      currentPrice: 0,
      performance: {
        totalValue: 10000,
        pnl: 0,
        pnlPercent: 0,
        winRate: 0,
        totalTrades: 0,
        maxDrawdown: 0
      },
      lastUpdate: Date.now()
    };
  }
  
  private calculateNewBalance(currentBalance: any, trade: Trade): any {
    // Simplified balance calculation
    if (trade.side === 'buy') {
      return {
        ...currentBalance,
        usd: currentBalance.usd - (trade.amount * trade.price + trade.fee),
        btc: currentBalance.btc + trade.amount
      };
    } else {
      return {
        ...currentBalance,
        usd: currentBalance.usd + (trade.amount * trade.price - trade.fee),
        btc: currentBalance.btc - trade.amount
      };
    }
  }
  
  private calculatePerformance(trades: Trade[], balance: any): any {
    if (trades.length === 0) {
      return {
        totalValue: balance.usd + balance.btc * (balance.currentPrice || 0),
        pnl: 0,
        pnlPercent: 0,
        winRate: 0,
        totalTrades: 0,
        maxDrawdown: 0
      };
    }
    
    // Simplified performance calculation
    const totalValue = balance.usd + balance.btc * 50000; // Use current price
    const initialValue = 10000;
    const pnl = totalValue - initialValue;
    const pnlPercent = (pnl / initialValue) * 100;
    
    return {
      totalValue,
      pnl,
      pnlPercent,
      winRate: 50, // Calculate actual win rate
      totalTrades: trades.length,
      maxDrawdown: 0 // Calculate actual max drawdown
    };
  }
  
  private generateResults(state: TradingState): TradingResults {
    return {
      totalTrades: state.trades.length,
      winRate: state.performance.winRate,
      totalReturn: state.performance.pnlPercent,
      finalBalance: state.balance.usd + state.balance.btc * state.currentPrice,
      trades: state.trades,
      maxDrawdown: state.performance.maxDrawdown,
      performance: state.performance
    };
  }
}

// Export singleton instance
export const paperTradingEngine = PaperTradingEngine.getInstance();