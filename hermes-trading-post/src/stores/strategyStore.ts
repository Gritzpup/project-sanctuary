import { writable } from 'svelte/store';

interface StrategyConfig {
  selectedType: string;
  parameters: Record<string, any>;
  isCustom?: boolean;
  customCode?: string;
  customStrategies?: any[];
}

// Create a custom store that shares strategy configuration between components
function createStrategyStore() {
  // Initialize with default values
  const initialValue: StrategyConfig = {
    selectedType: 'reverse-ratio',
    parameters: {},
    isCustom: false
  };
  
  const { subscribe, set, update } = writable<StrategyConfig>(initialValue);

  return {
    subscribe,
    
    // Update the selected strategy type and parameters
    setStrategy: (type: string, parameters: Record<string, any>, isCustom: boolean = false, customCode?: string) => {
      update(state => ({
        ...state,
        selectedType: type,
        parameters: { ...parameters },
        isCustom,
        customCode
      }));
      console.log('Strategy Store: Updated strategy:', type, { parameters, isCustom });
    },
    
    // Update just the parameters
    updateParameters: (parameters: Record<string, any>) => {
      update(state => ({
        ...state,
        parameters: { ...parameters }
      }));
    },
    
    // Set custom strategies list
    setCustomStrategies: (strategies: any[]) => {
      update(state => ({
        ...state,
        customStrategies: strategies
      }));
    }
  };
}

export const strategyStore = createStrategyStore();