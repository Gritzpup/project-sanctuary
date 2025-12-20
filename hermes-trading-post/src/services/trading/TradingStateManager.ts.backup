/**
 * TradingStateManager - Manages paper trading state
 * Extracted from paperTradingService.ts
 */

import { writable } from 'svelte/store';
import type { Writable } from 'svelte/store';
import type { Strategy } from '../../strategies/base/Strategy';
import type { Trade, Signal } from '../../strategies/base/StrategyTypes';

export interface PaperTradingState {
  isRunning: boolean;
  isPaused?: boolean;
  strategy: Strategy | null;
  balance: {
    usd: number;
    btcVault: number;
    btcPositions: number;
    vault: number;
  };
  trades: Trade[];
  currentSignal: Signal | null;
  performance: {
    totalValue: number;
    pnl: number;
    pnlPercent: number;
    winRate: number;
    totalTrades: number;
  };
  lastUpdate: number;
  chartData?: {
    recentHigh: number;
    recentLow: number;
    initialTradingPrice: number;
    initialRecentHigh: number;
    initialTradingAngle: number;
    lastTradeTime: number;
  };
}

export class TradingStateManager {
  private state: Writable<PaperTradingState>;
  private initialBalance: number;
  
  constructor(initialBalance: number = 10000) {
    this.initialBalance = initialBalance;
    this.state = writable<PaperTradingState>(this.getInitialState());
  }
  
  getInitialState(): PaperTradingState {
    return {
      isRunning: false,
      isPaused: false,
      strategy: null,
      balance: {
        usd: this.initialBalance,
        btcVault: 0,
        btcPositions: 0,
        vault: 0
      },
      trades: [],
      currentSignal: null,
      performance: {
        totalValue: this.initialBalance,
        pnl: 0,
        pnlPercent: 0,
        winRate: 0,
        totalTrades: 0
      },
      lastUpdate: Date.now(),
      chartData: undefined
    };
  }
  
  getState(): Writable<PaperTradingState> {
    return this.state;
  }
  
  updateState(updater: (state: PaperTradingState) => PaperTradingState): void {
    this.state.update(updater);
  }
  
  resetState(): void {
    this.state.set(this.getInitialState());
  }
  
  setRunning(isRunning: boolean): void {
    this.state.update(s => ({ ...s, isRunning }));
  }
  
  setPaused(isPaused: boolean): void {
    this.state.update(s => ({ ...s, isPaused }));
  }
  
  setStrategy(strategy: Strategy | null): void {
    this.state.update(s => ({ ...s, strategy }));
  }
  
  updateBalance(balance: Partial<PaperTradingState['balance']>): void {
    this.state.update(s => ({
      ...s,
      balance: { ...s.balance, ...balance }
    }));
  }
  
  addTrade(trade: Trade): void {
    this.state.update(s => ({
      ...s,
      trades: [...s.trades, trade]
    }));
  }
  
  setTrades(trades: Trade[]): void {
    this.state.update(s => ({ ...s, trades }));
  }
  
  setCurrentSignal(signal: Signal | null): void {
    this.state.update(s => ({ ...s, currentSignal: signal }));
  }
  
  updatePerformance(performance: Partial<PaperTradingState['performance']>): void {
    this.state.update(s => ({
      ...s,
      performance: { ...s.performance, ...performance }
    }));
  }
  
  updateChartData(chartData: Partial<PaperTradingState['chartData']>): void {
    this.state.update(s => ({
      ...s,
      chartData: s.chartData ? { ...s.chartData, ...chartData } : chartData as PaperTradingState['chartData']
    }));
  }
  
  setInitialBalance(balance: number): void {
    this.initialBalance = balance;
    this.state.update(s => ({
      ...s,
      balance: { ...s.balance, usd: balance },
      performance: { ...s.performance, totalValue: balance }
    }));
  }
}