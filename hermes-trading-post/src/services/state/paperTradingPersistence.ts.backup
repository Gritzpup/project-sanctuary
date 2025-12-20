/**
 * @file paperTradingPersistence.ts
 * @description Saves and loads paper trading state
 */

interface PersistentTradingState {
  isRunning: boolean;
  isPaused?: boolean; // Added for pause state
  strategyType: string;
  strategyTypeKey?: string; // e.g. 'reverse-descending-grid', 'grid-trading', etc.
  strategyConfig: any;
  balance: {
    usd: number;
    btcVault: number;
    btcPositions: number;
    vault: number;
  };
  positions: any[];
  trades: any[];
  startTime: number;
  lastUpdateTime: number;
  // Chart-related data for market position persistence
  chartData?: {
    recentHigh: number;
    recentLow: number;
    initialTradingPrice: number;
    initialRecentHigh: number;
    initialTradingAngle: number;
    lastTradeTime: number;
  };
}

class PaperTradingPersistence {
  private readonly STORAGE_KEY_PREFIX = 'paperTradingState';
  
  private getStorageKey(instanceId: string = 'default'): string {
    return `${this.STORAGE_KEY_PREFIX}_${instanceId}`;
  }
  
  saveState(state: PersistentTradingState, instanceId: string = 'default'): void {
    try {
      const storageKey = this.getStorageKey(instanceId);
      console.log('PaperTradingPersistence: Saving state:', {
        instanceId,
        isRunning: state.isRunning,
        strategyType: state.strategyType,
        hasStrategy: !!state.strategyType,
        positionsCount: state.positions?.length || 0,
        tradesCount: state.trades?.length || 0
      });
      localStorage.setItem(storageKey, JSON.stringify(state));
    } catch (error) {
      console.error('Failed to save paper trading state:', error);
    }
  }
  
  loadState(instanceId: string = 'default'): PersistentTradingState | null {
    try {
      const storageKey = this.getStorageKey(instanceId);
      const saved = localStorage.getItem(storageKey);
      if (!saved) return null;
      
      const state = JSON.parse(saved);
      console.log('PaperTradingPersistence: Loaded state:', {
        instanceId,
        isRunning: state.isRunning,
        strategyType: state.strategyType,
        hasStrategy: !!state.strategyType,
        balance: state.balance,
        positionsCount: state.positions?.length || 0,
        tradesCount: state.trades?.length || 0
      });
      // Validate the loaded state has required fields
      if (state && typeof state.isRunning === 'boolean' && state.balance) {
        return state;
      }
      return null;
    } catch (error) {
      console.error('Failed to load paper trading state:', error);
      return null;
    }
  }
  
  clearState(instanceId: string = 'default'): void {
    try {
      const storageKey = this.getStorageKey(instanceId);
      localStorage.removeItem(storageKey);
    } catch (error) {
      console.error('Failed to clear paper trading state:', error);
    }
  }
  
  // Listen for changes across tabs
  onStorageChange(callback: (state: PersistentTradingState | null, instanceId: string) => void, instanceId: string = 'default'): () => void {
    const storageKey = this.getStorageKey(instanceId);
    const handler = (event: StorageEvent) => {
      if (event.key === storageKey) {
        const newState = event.newValue ? JSON.parse(event.newValue) : null;
        callback(newState, instanceId);
      }
    };
    
    window.addEventListener('storage', handler);
    
    // Return cleanup function
    return () => window.removeEventListener('storage', handler);
  }
}

export const paperTradingPersistence = new PaperTradingPersistence();
export type { PersistentTradingState };