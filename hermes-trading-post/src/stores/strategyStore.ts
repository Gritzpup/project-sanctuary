import { writable } from 'svelte/store';

interface StrategyConfig {
  selectedType: string;
  parameters: Record<string, any>;
  isCustom?: boolean;
  customCode?: string;
  customStrategies?: any[];
  balance?: number;
  fees?: {
    maker: number;
    taker: number;
  };
  paperTradingActive?: boolean;
}

const STORAGE_KEY = 'hermes_active_strategy';

// Load strategy from localStorage
function loadStoredStrategy(): StrategyConfig {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      console.log('Strategy Store: Loaded stored strategy:', parsed.selectedType);
      return parsed;
    }
  } catch (error) {
    console.error('Strategy Store: Error loading stored strategy:', error);
  }
  
  // Return default values if no stored strategy or error
  return {
    selectedType: 'reverse-ratio',
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
    setStrategy: (type: string, parameters: Record<string, any>, isCustom: boolean = false, customCode?: string) => {
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
    updateParameters: (parameters: Record<string, any>) => {
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
    setCustomStrategies: (strategies: any[]) => {
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
        selectedType: 'reverse-ratio',
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
    }
  };
}

export const strategyStore = createStrategyStore();