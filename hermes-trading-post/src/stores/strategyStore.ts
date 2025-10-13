/**
 * @file strategyStore.ts
 * @description Global strategy configuration and state management
 */
import { writable, derived } from 'svelte/store';

interface CustomStrategy {
  id: string;
  name: string;
  code: string;
  description?: string;
}

interface StrategyConfig {
  selectedType: string;
  parameters: Record<string, unknown>;
  isCustom?: boolean;
  customCode?: string;
  customStrategies?: CustomStrategy[];
  balance?: number;
  fees?: {
    maker: number;
    taker: number;
  };
  paperTradingActive?: boolean;
  lastSyncedAt?: number;
  syncedStrategy?: {
    type: string;
    parameters: Record<string, unknown>;
    customCode?: string;
  };
}

const STORAGE_KEY = 'hermes_active_strategy';

// Load strategy from localStorage
function loadStoredStrategy(): StrategyConfig {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // console.log('Strategy Store: Loaded stored strategy:', parsed.selectedType);
      return parsed;
    }
  } catch (error) {
    console.error('Strategy Store: Error loading stored strategy:', error);
  }
  
  // Return default values if no stored strategy or error
  return {
    selectedType: 'reverse-descending-grid',
    parameters: {},
    isCustom: false,
    balance: 10000,
    fees: {
      maker: 0.001,
      taker: 0.001
    }
  };
}

// Save strategy to localStorage
function saveStrategy(config: StrategyConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch (error) {
    console.error('Strategy Store: Error saving strategy:', error);
  }
}

// Create a custom store that shares strategy configuration between components
function createStrategyStore() {
  // Initialize with stored values or defaults
  const initialValue: StrategyConfig = loadStoredStrategy();
  
  const { subscribe, set, update } = writable<StrategyConfig>(initialValue);

  return {
    subscribe,
    
    // Update the selected strategy type and parameters
    setStrategy: (type: string, parameters: Record<string, unknown>, isCustom: boolean = false, customCode?: string) => {
      update(state => {
        const newState = {
          ...state,
          selectedType: type,
          parameters: { ...parameters },
          isCustom,
          customCode
        };
        saveStrategy(newState);
        return newState;
      });
      console.log('Strategy Store: Updated strategy:', type, { parameters, isCustom });
    },
    
    // Update just the parameters
    updateParameters: (parameters: Record<string, unknown>) => {
      update(state => {
        const newState = {
          ...state,
          parameters: { ...parameters }
        };
        saveStrategy(newState);
        return newState;
      });
    },
    
    // Set custom strategies list
    setCustomStrategies: (strategies: CustomStrategy[]) => {
      update(state => {
        const newState = {
          ...state,
          customStrategies: strategies
        };
        saveStrategy(newState);
        return newState;
      });
    },
    
    // Update balance and fees
    setBalanceAndFees: (balance: number, fees: { maker: number; taker: number }) => {
      update(state => {
        const newState = {
          ...state,
          balance,
          fees
        };
        saveStrategy(newState);
        return newState;
      });
      console.log('Strategy Store: Updated balance and fees:', { balance, fees });
    },
    
    // Set paper trading status
    setPaperTradingActive: (isActive: boolean) => {
      update(state => {
        const newState = {
          ...state,
          paperTradingActive: isActive
        };
        saveStrategy(newState);
        return newState;
      });
      console.log('Strategy Store: Paper trading active:', isActive);
    },
    
    // Reset store to defaults
    reset: () => {
      const defaultConfig = {
        selectedType: 'reverse-descending-grid',
        parameters: {},
        isCustom: false,
        balance: 10000,
        fees: {
          maker: 0.001,
          taker: 0.001
        },
        paperTradingActive: false
      };
      set(defaultConfig);
      saveStrategy(defaultConfig);
      console.log('Strategy Store: Reset to defaults');
    },
    
    // Sync current backtesting strategy to paper/live trading
    syncToPaperTrading: () => {
      update(state => {
        const newState = {
          ...state,
          lastSyncedAt: Date.now(),
          syncedStrategy: {
            type: state.selectedType,
            parameters: { ...state.parameters },
            customCode: state.customCode
          }
        };
        saveStrategy(newState);
        
        // Emit custom event for paper trading to listen to
        window.dispatchEvent(new CustomEvent('strategy-synced', {
          detail: {
            strategy: newState.syncedStrategy,
            timestamp: newState.lastSyncedAt
          }
        }));
        
        console.log('Strategy Store: Synced strategy to paper/live trading:', newState.syncedStrategy);
        return newState;
      });
    },
    
    // Get the currently synced strategy
    getSyncedStrategy: () => {
      let syncedStrategy = null;
      const unsubscribe = subscribe(state => {
        syncedStrategy = state.syncedStrategy;
      });
      unsubscribe();
      return syncedStrategy;
    },
    
    // Check if current strategy matches synced strategy
    isInSync: () => {
      let inSync = false;
      const unsubscribe = subscribe(state => {
        if (!state.syncedStrategy) {
          inSync = false;
        } else {
          inSync = state.selectedType === state.syncedStrategy.type &&
                   JSON.stringify(state.parameters) === JSON.stringify(state.syncedStrategy.parameters);
        }
      });
      unsubscribe();
      return inSync;
    }
  };
}

export const strategyStore = createStrategyStore();

// Derived store to track sync status
export const syncStatus = derived(strategyStore, $strategyStore => {
  if (!$strategyStore.syncedStrategy) {
    return { status: 'never-synced', message: 'Not synced' };
  }
  
  const isInSync = $strategyStore.selectedType === $strategyStore.syncedStrategy.type &&
                   JSON.stringify($strategyStore.parameters) === JSON.stringify($strategyStore.syncedStrategy.parameters);
  
  if (isInSync) {
    const timeAgo = Date.now() - ($strategyStore.lastSyncedAt || 0);
    const minutes = Math.floor(timeAgo / 60000);
    const timeStr = minutes < 1 ? 'just now' : `${minutes}m ago`;
    return { status: 'synced', message: `Synced ${timeStr}` };
  } else {
    return { status: 'out-of-sync', message: 'Out of sync' };
  }
});