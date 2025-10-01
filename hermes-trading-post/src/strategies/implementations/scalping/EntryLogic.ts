import type { Signal } from '../../base/StrategyTypes';
import type { ScalpingConfig, ScalpingState, MarketAnalysis, StrategyVariant } from './types';

/**
 * Handles entry logic for scalping strategies
 * Determines when and how to enter new positions
 */
export class EntryLogic {
  private config: ScalpingConfig;
  private state: ScalpingState;
  private variant: StrategyVariant;

  constructor(config: ScalpingConfig, state: ScalpingState, variant: StrategyVariant = 'reverse-ratio') {
    this.config = config;
    this.state = state;
    this.variant = variant;
  }

  /**
   * Check if we should enter an initial position
   */
  checkInitialEntry(marketAnalysis: MarketAnalysis, currentPrice: number): Signal | null {
    if (!marketAnalysis.canTriggerInitialEntry) {
      return null;
    }

    console.log(`[EntryLogic:${this.variant}] INITIAL ENTRY SIGNAL TRIGGERED`, {
      dropFromHigh: marketAnalysis.dropFromHigh.toFixed(2) + '%',
      requiredDrop: this.config.initialDropPercent + '%',
      currentPrice,
      recentHigh: marketAnalysis.recentHigh
    });
    
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

    // Log level entry check details for debugging
    console.log(`[EntryLogic:${this.variant}] 🎯 Level entry check:`, {
      currentLevel: this.state.currentLevel,
      maxLevels: this.config.maxLevels,
      lastLevelPrice: marketAnalysis.lastLevelPrice.toFixed(2),
      currentPrice: currentPrice.toFixed(2),
      dropFromLastLevel: marketAnalysis.dropFromLastLevel.toFixed(4) + '%',
      requiredDrop: this.config.levelDropPercent + '%',
      needsMoreDrop: Math.max(0, this.config.levelDropPercent - marketAnalysis.dropFromLastLevel).toFixed(4) + '%',
      levelPrices: this.state.levelPrices.map(p => p.toFixed(2)),
      wouldTrigger: marketAnalysis.dropFromLastLevel >= this.config.levelDropPercent ? '✅ YES!' : '❌ Not yet'
    });

    // Update state for level entry
    this.state.currentLevel++;
    this.state.levelPrices.push(currentPrice);
    
    console.log(`[EntryLogic:${this.variant}] LEVEL ENTRY TRIGGERED!`, {
      level: this.state.currentLevel,
      dropFromLastLevel: marketAnalysis.dropFromLastLevel.toFixed(4) + '%',
      price: currentPrice
    });
    
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