/**
 * PaperTradingService - Virtual trading engine for backtesting and paper trading
 *
 * Orchestrates the complete paper trading lifecycle: strategy execution, portfolio
 * management, trade tracking, and performance metrics. Manages state through Svelte
 * stores and coordinates between strategy layer, order execution, and vault/position
 * tracking. Supports both real-time paper trading and historical backtesting.
 */

import { Strategy } from '../../strategies/base/Strategy';
import type { CandleData, Trade, StrategyState, Signal } from '../../strategies/base/StrategyTypes';
import { writable, get } from 'svelte/store';
import type { Writable } from 'svelte/store';
import { vaultService } from '../state/vaultService';

import { 
  type PaperTradingState, 
  type PaperTradingConfig, 
  DEFAULT_CONFIG, 
  createInitialState 
} from './state';
import { PaperTradingPersistence } from './persistence';
import { PaperTradingExecution } from './execution';
import { PaperTradingCalculator } from './calculator';

class PaperTradingService {
  private state: Writable<PaperTradingState>;
  private candles: CandleData[] = [];
  private config: PaperTradingConfig;
  private botId: string | null = null;
  private restorationPromise: Promise<boolean> | null = null;
  private savedPositions: any[] | null = null;
  
  // Module instances
  private persistence: PaperTradingPersistence;
  private execution: PaperTradingExecution;
  private calculator: PaperTradingCalculator;
  
  constructor(
    private instanceId: string = 'default',
    config: Partial<PaperTradingConfig> = {}
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    // Initialize state
    this.state = writable<PaperTradingState>(createInitialState(this.config));
    
    // Initialize modules
    this.persistence = new PaperTradingPersistence(instanceId);
    this.execution = new PaperTradingExecution(this.config);
    this.calculator = new PaperTradingCalculator();
    
    this.setupAutoSave();
    this.restorationPromise = this.restoreFromSavedState();
  }

  private setupAutoSave(): void {
    let saveTimeout: NodeJS.Timeout | null = null;
    
    this.state.subscribe(state => {
      if (state.isRunning) {
        if (saveTimeout) clearTimeout(saveTimeout);
        saveTimeout = setTimeout(() => {
          this.saveState();
        }, this.config.autoSaveInterval);
      }
    });
  }

  getState(): Writable<PaperTradingState> {
    return this.state;
  }

  getCurrentState(): PaperTradingState {
    return get(this.state);
  }

  async saveState(): Promise<void> {
    const currentState = get(this.state);
    await this.persistence.saveState(currentState);
  }

  async restoreFromSavedState(): Promise<boolean> {
    try {
      const savedState = await this.persistence.restoreState();
      
      if (savedState) {
        this.state.update(current => ({
          ...current,
          ...savedState,
          strategy: current.strategy // Keep current strategy instance
        }));
        
        return true;
      }
      
      return false;
    } catch (error) {
      return false;
    }
  }

  async waitForRestoration(): Promise<boolean> {
    if (this.restorationPromise) {
      return await this.restorationPromise;
    }
    return false;
  }

  async start(strategy: Strategy, symbol: string = 'BTC-USD'): Promise<void> {
    await this.waitForRestoration();
    
    this.state.update(state => ({
      ...state,
      isRunning: true,
      isPaused: false,
      strategy,
      lastUpdate: Date.now()
    }));

  }

  stop(): void {
    this.state.update(state => ({
      ...state,
      isRunning: false,
      isPaused: false,
      strategy: null,
      currentSignal: null
    }));

  }

  pause(): void {
    this.state.update(state => ({
      ...state,
      isPaused: true
    }));
  }

  resume(): void {
    this.state.update(state => ({
      ...state,
      isPaused: false
    }));
  }

  async processCandles(candles: CandleData[]): Promise<void> {
    if (candles.length === 0) return;

    const currentState = get(this.state);
    if (!currentState.isRunning || currentState.isPaused || !currentState.strategy) {
      return;
    }

    this.candles = candles;
    const currentPrice = candles[candles.length - 1].close;

    try {
      // Update strategy with new candles
      this.execution.updateStrategy(currentState.strategy, candles);

      // Get signal from strategy
      const signal = currentState.strategy.getSignal();
      
      // Process signal if it exists
      if (signal && signal.type !== 'hold') {
        const result = this.execution.processSignal(currentState, signal, currentPrice);
        
        if (result.executed && result.trade) {
        }
      }

      // Update performance metrics
      this.calculator.calculatePerformance(currentState, currentPrice, this.config.initialBalance);

      // Update state
      this.state.update(state => ({
        ...state,
        currentSignal: signal,
        lastUpdate: Date.now()
      }));

    } catch (error) {
    }
  }

  setBotId(botId: string): void {
    this.botId = botId;
  }

  async reset(): Promise<void> {
    this.state.set(createInitialState(this.config));
    await this.persistence.clearSavedState();
    this.candles = [];
  }

  getStrategyState(): StrategyState | null {
    const currentState = get(this.state);
    return this.execution.getStrategyState(currentState.strategy);
  }

  getTradeHistory(): Trade[] {
    return get(this.state).trades;
  }

  getPerformanceMetrics() {
    const state = get(this.state);
    const currentPrice = this.candles.length > 0 ? this.candles[this.candles.length - 1].close : 0;
    
    return {
      ...state.performance,
      allocation: this.calculator.calculateAllocation(state, currentPrice),
      totalFees: this.calculator.calculateTotalFees(state.trades),
      averageTradeSize: this.calculator.calculateAverageTradeSize(state.trades),
      maxDrawdown: this.calculator.calculateMaxDrawdown(state.trades, this.config.initialBalance),
      sharpeRatio: this.calculator.calculateSharpeRatio(state.trades)
    };
  }

  async transferToVault(amount: number): Promise<void> {
    const currentState = get(this.state);
    
    if (currentState.balance.usd >= amount) {
      try {
        await vaultService.deposit(amount, this.instanceId);
        
        this.state.update(state => ({
          ...state,
          balance: {
            ...state.balance,
            usd: state.balance.usd - amount,
            vault: state.balance.vault + amount
          }
        }));
        
      } catch (error) {
      }
    }
  }

  getInitialState(): PaperTradingState {
    return createInitialState(this.config);
  }

  destroy(): void {
    // Clean up resources
    this.stop();
    this.candles = [];
    this.restorationPromise = null;
    this.savedPositions = null;
  }
}

// Export factory function for creating instances
export function createPaperTradingService(
  instanceId: string = 'default',
  config: Partial<PaperTradingConfig> = {}
): PaperTradingService {
  return new PaperTradingService(instanceId, config);
}

// Export default instance
export const paperTradingService = new PaperTradingService();

// Export types and utilities
export { PaperTradingService };
export type { PaperTradingState, PaperTradingConfig };