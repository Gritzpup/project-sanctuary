import type { StrategyConfig } from '../../base/StrategyTypes';

/**
 * Base configuration interface for all scalping strategies
 */
export interface ScalpingConfig extends StrategyConfig {
  initialDropPercent: number;    // % drop from recent high to start buying
  levelDropPercent: number;      // % drop between levels
  ratioMultiplier: number;       // Multiplier for each level
  profitTarget: number;          // % above initial entry to sell all
  maxLevels: number;            // Maximum number of buy levels
  lookbackPeriod: number;       // Candles to look back for recent high
  positionSizeMode?: 'percentage' | 'fixed';  // How to calculate position sizes
  basePositionPercent: number;   // Base percentage of balance for first level
  basePositionAmount?: number;   // Fixed dollar amount for first level (if fixed mode)
  maxPositionPercent: number;    // Max percentage of balance to use across all levels
}

/**
 * Internal state for tracking strategy execution
 */
export interface ScalpingState {
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

/**
 * Strategy variant types
 */
export type StrategyVariant = 'reverse-ratio' | 'ultra-micro' | 'micro' | 'proper';