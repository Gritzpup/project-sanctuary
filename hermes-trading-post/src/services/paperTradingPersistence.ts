/**
 * @file paperTradingPersistence.ts
 * @description Saves and loads paper trading state
 */

interface PersistentTradingState {
  isRunning: boolean;
  isPaused?: boolean; // Added for pause state
  strategyType: string;
  strategyTypeKey?: string; // e.g. 'reverse-ratio', 'grid-trading', etc.
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
  private readonly STORAGE_KEY = 'paperTradingState';
  
  saveState(state: PersistentTradingState): void {
    try {
      console.log('PaperTradingPersistence: Saving state:', {
        isRunning: state.isRunning,
        strategyType: state.strategyType,
        hasStrategy: !!state.strategyType,
        positionsCount: state.positions?.length || 0,
        tradesCount: state.trades?.length || 0
      });
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      console.error('Failed to save paper trading state:', error);
    }
  }
  
  loadState(): PersistentTradingState | null {
    try {
      const saved = localStorage.getItem(this.STORAGE_KEY);
      if (!saved) return null;
      
      const state = JSON.parse(saved);
      console.log('PaperTradingPersistence: Loaded state:', {
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
  
  clearState(): void {
    try {
      localStorage.removeItem(this.STORAGE_KEY);
    } catch (error) {
      console.error('Failed to clear paper trading state:', error);
    }
  }
  
  // Listen for changes across tabs
  onStorageChange(callback: (state: PersistentTradingState | null) => void): () => void {
    const handler = (event: StorageEvent) => {
      if (event.key === this.STORAGE_KEY) {
        const newState = event.newValue ? JSON.parse(event.newValue) : null;
        callback(newState);
      }
    };
    
    window.addEventListener('storage', handler);
    
    // Return cleanup function
    return () => window.removeEventListener('storage', handler);
  }
}

export const paperTradingPersistence = new PaperTradingPersistence();
export type { PersistentTradingState };