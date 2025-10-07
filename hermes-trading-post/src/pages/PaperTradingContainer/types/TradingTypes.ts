/**
 * Core trading types and interfaces for Paper Trading
 */

export interface TradingState {
  selectedStrategyType: string;
  isRunning: boolean;
  isPaused: boolean;
  balance: number;
  btcBalance?: number;
  vaultBalance?: number;
  btcVaultBalance?: number;
  trades: any[];
  positions: any[];
  currentPrice?: number;
  totalReturn?: number;
  totalFees?: number;
  totalRebates?: number;
  totalRebalance?: number;
}

export interface BackendState {
  currentPrice: number;
  priceChange24h: number;
  priceChangePercent24h: number;
  nextBuyDistance: number | null;
  nextSellDistance: number | null;
  nextBuyPrice: number | null;
  nextSellPrice: number | null;
}

export interface BotTab {
  id: string;
  name: string;
  strategy: string;
  isActive: boolean;
  performance: {
    totalReturn: number;
    tradesCount: number;
  };
}

export interface StrategyDefinition {
  value: string;
  label: string;
  description: string;
  isCustom: boolean;
}