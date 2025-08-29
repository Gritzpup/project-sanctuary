// Trading components for PaperTradingV2
export { default as StrategySelector } from './StrategySelector.svelte';
export { default as StrategyParameters } from './StrategyParameters.svelte';
export { default as BotManager } from './BotManager.svelte';
export { default as BalanceDisplay } from './BalanceDisplay.svelte';

// Types and interfaces for strategy trading
export interface StrategyChangeEvent {
  strategyType: string;
  previousType: string;
}

export interface ParametersChangeEvent {
  strategyType: string;
  parameters: Record<string, any>;
  validation: {
    isValid: boolean;
    errors: string[];
  };
}

export interface ResetParametersEvent {
  strategyType: string;
}

export interface BotSelectEvent {
  botId: string;
  activeBotInstance: any;
}

export interface TradingStateEvent {
  botId: string;
}

export interface BalanceUpdateEvent {
  balance: number;
}

export interface BotStateUpdateEvent {
  balance: number;
  btcBalance: number;
  vaultBalance: number;
  btcVaultBalance: number;
  isRunning: boolean;
  isPaused: boolean;
  totalReturn: number;
  positions?: any[];
  trades?: any[];
  strategyParameters?: Record<string, any>;
}

// Strategy configuration interface for external use
export interface StrategyComponentConfig {
  selectedStrategyType: string;
  strategyParameters: Record<string, any>;
  strategies: Array<{
    value: string;
    label: string;
    description: string;
    isCustom: boolean;
  }>;
  disabled?: boolean;
  showAdvanced?: boolean;
  syncIndicator?: boolean;
}