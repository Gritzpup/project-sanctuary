import type { Signal } from '../../base/StrategyTypes';
import type { ReverseRatioConfig, ReverseRatioState, MarketAnalysis } from './types';

/**
 * Handles entry logic for the Reverse Descending Grid Strategy
 * Determines when and how to enter new positions
 */
export class EntryLogic {
  private config: ReverseRatioConfig;
  private state: ReverseRatioState;

  constructor(config: ReverseRatioConfig, state: ReverseRatioState) {
    this.config = config;
    this.state = state;
  }

  /**
   * Check if we should enter an initial position
   */
  checkInitialEntry(marketAnalysis: MarketAnalysis, currentPrice: number): Signal | null {
    if (!marketAnalysis.canTriggerInitialEntry) {
      return null;
    }

    // Update state for initial entry
    this.state.initialEntryPrice = currentPrice;
    this.state.currentLevel = 1;
    this.state.levelPrices = [currentPrice];
    
    return {
      type: 'buy',
      strength: 0.7,
      price: currentPrice,
      reason: `Initial entry - ${marketAnalysis.dropFromHigh.toFixed(2)}% drop from recent high`,
      metadata: {
        level: 1,
        recentHigh: marketAnalysis.recentHigh,
        dropPercent: marketAnalysis.dropFromHigh
      }
    };
  }

  /**
   * Check if we should enter additional positions at lower levels
   */
  checkLevelEntry(marketAnalysis: MarketAnalysis, currentPrice: number): Signal | null {
    if (!marketAnalysis.canTriggerLevelEntry || !marketAnalysis.lastLevelPrice || !marketAnalysis.dropFromLastLevel) {
      return null;
    }

    // Update state for level entry
    this.state.currentLevel++;
    this.state.levelPrices.push(currentPrice);
    
    return {
      type: 'buy',
      strength: 0.8,
      price: currentPrice,
      reason: `Level ${this.state.currentLevel} entry - ${marketAnalysis.dropFromLastLevel.toFixed(2)}% drop from last level`,
      metadata: {
        level: this.state.currentLevel,
        dropFromLastLevel: marketAnalysis.dropFromLastLevel,
        totalDropFromInitial: ((this.state.initialEntryPrice - currentPrice) / this.state.initialEntryPrice) * 100
      }
    };
  }

  /**
   * Get the current level for position sizing
   */
  getCurrentLevel(): number {
    return this.state.currentLevel;
  }
}