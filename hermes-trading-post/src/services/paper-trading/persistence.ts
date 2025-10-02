/**
 * @file persistence.ts
 * @description Paper trading state persistence and restoration
 */

import type { PaperTradingState } from './state';

export class PaperTradingPersistence {
  constructor(private instanceId: string) {}

  /**
   * Save current state to localStorage
   */
  async saveState(state: PaperTradingState): Promise<void> {
    try {
      const stateToSave = {
        ...state,
        strategy: null, // Don't serialize strategy instance
        timestamp: Date.now()
      };
      
      const key = `paperTradingState_${this.instanceId}`;
      localStorage.setItem(key, JSON.stringify(stateToSave));
    } catch (error) {
      console.error('Failed to save paper trading state:', error);
    }
  }

  /**
   * Restore state from localStorage
   */
  async restoreState(): Promise<Partial<PaperTradingState> | null> {
    try {
      const key = `paperTradingState_${this.instanceId}`;
      const saved = localStorage.getItem(key);
      
      if (!saved) return null;
      
      const parsed = JSON.parse(saved);
      
      // Validate the restored data
      if (!this.isValidSavedState(parsed)) {
        console.warn('Invalid saved state found, ignoring');
        return null;
      }
      
      return parsed;
    } catch (error) {
      console.error('Failed to restore paper trading state:', error);
      return null;
    }
  }

  /**
   * Clear saved state
   */
  async clearSavedState(): Promise<void> {
    try {
      const key = `paperTradingState_${this.instanceId}`;
      localStorage.removeItem(key);
    } catch (error) {
      console.error('Failed to clear saved state:', error);
    }
  }

  /**
   * Check if there is saved state available
   */
  hasSavedState(): boolean {
    const key = `paperTradingState_${this.instanceId}`;
    return localStorage.getItem(key) !== null;
  }

  /**
   * Get the timestamp of the last saved state
   */
  getLastSaveTimestamp(): number | null {
    try {
      const key = `paperTradingState_${this.instanceId}`;
      const saved = localStorage.getItem(key);
      
      if (!saved) return null;
      
      const parsed = JSON.parse(saved);
      return parsed.timestamp || null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Validate that saved state has required structure
   */
  private isValidSavedState(state: any): boolean {
    return (
      state &&
      typeof state.balance === 'object' &&
      typeof state.balance.usd === 'number' &&
      Array.isArray(state.trades) &&
      typeof state.performance === 'object' &&
      typeof state.performance.totalValue === 'number'
    );
  }

  /**
   * Migration utility for old state formats
   */
  async migrateOldState(): Promise<void> {
    // Handle any legacy state format migrations here
    // This can be expanded as the state structure evolves
  }
}