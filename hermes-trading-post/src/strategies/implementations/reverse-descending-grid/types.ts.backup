import type { StrategyConfig } from '../../base/StrategyTypes';

/**
 * Configuration interface for Reverse Descending Grid Strategy
 */
export interface ReverseRatioConfig extends StrategyConfig {
  initialDropPercent: number;    // % drop from recent high to start buying (default: 0.01)
  levelDropPercent: number;      // % drop between levels (default: 0.008)
  ratioMultiplier: number;       // Multiplier for each level (default: 2)
  profitTarget: number;          // % above initial entry to sell all (default: 0.85)
  maxLevels: number;            // Maximum number of buy levels (default: 5)
  lookbackPeriod: number;       // Candles to look back for recent high (default: 30)
  positionSizeMode: 'percentage' | 'fixed';  // How to calculate position sizes
  basePositionPercent: number;   // Base percentage of balance for first level (if percentage mode)
  basePositionAmount: number;    // Fixed dollar amount for first level (if fixed mode)
  maxPositionPercent: number;    // Max percentage of balance to use across all levels
}

/**
 * Internal state for tracking strategy execution
 */
export interface ReverseRatioState {
  recentHigh: number;
  initialEntryPrice: number;
  currentLevel: number;
  levelPrices: number[];
  levelSizes: number[];
}

/**
 * Market analysis result
 */
export interface MarketAnalysis {
  recentHigh: number;
  dropFromHigh: number;
  canTriggerInitialEntry: boolean;
  canTriggerLevelEntry: boolean;
  dropFromLastLevel?: number;
  lastLevelPrice?: number;
}