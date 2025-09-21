/**
 * TradingPersistence - Handles saving and restoring trading state
 * Extracted from paperTradingService.ts
 */

import type { PaperTradingState } from './TradingStateManager';
import { paperTradingPersistence } from '../state/paperTradingPersistence';
import type { PersistentTradingState } from '../state/paperTradingPersistence';

export class TradingPersistence {
  private instanceId: string;
  private botId: string | null = null;
  
  constructor(instanceId: string = 'default') {
    this.instanceId = instanceId;
  }
  
  /**
   * Save current state to persistence
   */
  async saveState(state: PaperTradingState): Promise<void> {
    if (!state.isRunning || !state.strategy) {
      return;
    }
    
    const strategyKey = this.getStrategyKey(state.strategy.getName());
    
    const persistentState: PersistentTradingState = {
      strategyName: state.strategy.getName(),
      balance: state.balance,
      trades: state.trades,
      performance: state.performance,
      lastUpdate: state.lastUpdate,
      chartData: state.chartData,
      strategyState: state.strategy.getState ? state.strategy.getState() : undefined
    };
    
    paperTradingPersistence.saveState(strategyKey, persistentState);
  }
  
  /**
   * Restore state from persistence
   */
  async restoreState(strategyName?: string): Promise<PersistentTradingState | null> {
    if (strategyName) {
      const strategyKey = this.getStrategyKey(strategyName);
      return paperTradingPersistence.getState(strategyKey);
    }
    
    // Try to get the most recent state
    const recentState = paperTradingPersistence.getMostRecentState();
    return recentState;
  }
  
  /**
   * Clear saved state
   */
  clearState(strategyName?: string): void {
    if (strategyName) {
      const strategyKey = this.getStrategyKey(strategyName);
      paperTradingPersistence.clearState(strategyKey);
    } else {
      paperTradingPersistence.clearAll();
    }
  }
  
  /**
   * Get all saved states
   */
  getAllStates(): { [key: string]: PersistentTradingState } {
    return paperTradingPersistence.getAllStates();
  }
  
  /**
   * Get strategy-specific storage key
   */
  private getStrategyKey(strategyName: string): string {
    const cleanName = strategyName
      .replace(/Strategy$/, '')
      .replace(/([A-Z])/g, '-$1')
      .toLowerCase()
      .replace(/^-/, '');
    
    if (this.botId) {
      return `${this.instanceId}_${this.botId}_${cleanName}`;
    }
    
    return `${this.instanceId}_${cleanName}`;
  }
  
  /**
   * Set bot ID for persistence key generation
   */
  setBotId(botId: string | null): void {
    this.botId = botId;
  }
  
  /**
   * Check if there's saved state available
   */
  hasSavedState(strategyName?: string): boolean {
    if (strategyName) {
      const strategyKey = this.getStrategyKey(strategyName);
      const state = paperTradingPersistence.getState(strategyKey);
      return state !== null;
    }
    
    const states = paperTradingPersistence.getAllStates();
    return Object.keys(states).length > 0;
  }
  
  /**
   * Get statistics about saved states
   */
  getSavedStateStats(): {
    totalStates: number;
    strategies: string[];
    lastUpdated: number | null;
  } {
    const states = paperTradingPersistence.getAllStates();
    const strategies = Object.keys(states);
    
    let lastUpdated: number | null = null;
    strategies.forEach(key => {
      const state = states[key];
      if (state.lastUpdate && (!lastUpdated || state.lastUpdate > lastUpdated)) {
        lastUpdated = state.lastUpdate;
      }
    });
    
    return {
      totalStates: strategies.length,
      strategies,
      lastUpdated
    };
  }
}