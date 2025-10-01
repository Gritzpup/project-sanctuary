import type { Signal, StrategyBalance } from '../../base/StrategyTypes';
import type { ReverseRatioConfig, ReverseRatioState } from './types';

/**
 * Handles position sizing calculations for the Reverse Ratio Strategy
 * Calculates appropriate position sizes based on level and configuration
 */
export class PositionSizer {
  private config: ReverseRatioConfig;
  private state: ReverseRatioState;

  constructor(config: ReverseRatioConfig, state: ReverseRatioState) {
    this.config = config;
    this.state = state;
  }

  /**
   * Calculate position size for a buy signal
   */
  calculatePositionSize(balance: number, signal: Signal, currentPrice: number, strategyBalance: StrategyBalance): number {
    if (signal.type !== 'buy' || !signal.metadata?.level) return 0;
    
    const level = signal.metadata.level;
    
    // Paper trading service now correctly passes total available balance (USD + vault)
    const totalAvailable = balance;
    
    console.log('[PositionSizer] Calculating position size:', {
      balancePassedIn: balance,
      actualUSD: strategyBalance.usd,
      actualVault: strategyBalance.vault,
      totalAvailable,
      level,
      sizeMode: this.config.positionSizeMode,
      basePercent: this.config.basePositionPercent,
      maxPercent: this.config.maxPositionPercent
    });
    
    if (this.config.positionSizeMode === 'percentage') {
      return this.calculatePercentageBasedSize(totalAvailable, level, currentPrice);
    } else {
      return this.calculateFixedBasedSize(level, currentPrice);
    }
  }

  /**
   * Calculate position size using percentage-based approach
   */
  private calculatePercentageBasedSize(totalAvailable: number, level: number, currentPrice: number): number {
    // Calculate position allocation based on reverse ratio
    const basePercent = this.config.basePositionPercent; // e.g., 6%
    let levelMultiplier: number;
    
    if (this.config.ratioMultiplier === 1) {
      // Linear progression: Level 1 = 1x, Level 2 = 2x, etc.
      levelMultiplier = level;
    } else {
      // Exponential progression: Level 1 = 1x, Level 2 = 2x, Level 3 = 4x, etc.
      levelMultiplier = Math.pow(this.config.ratioMultiplier, level - 1);
    }
    
    const levelPercent = basePercent * levelMultiplier;
    
    // Check we don't exceed maximum allocation
    const totalRatioSum = this.calculateRatioSum(this.config.maxLevels, this.config.ratioMultiplier);
    const totalPotentialPercent = basePercent * totalRatioSum;
    
    if (totalPotentialPercent > this.config.maxPositionPercent) {
      // Scale down all levels proportionally
      const scaleFactor = this.config.maxPositionPercent / totalPotentialPercent;
      const adjustedLevelPercent = levelPercent * scaleFactor;
      
      console.log('[PositionSizer] Scaling down position size to stay within max allocation:', {
        originalLevelPercent: levelPercent.toFixed(2) + '%',
        adjustedLevelPercent: adjustedLevelPercent.toFixed(2) + '%',
        scaleFactor: scaleFactor.toFixed(3),
        totalPotentialPercent: totalPotentialPercent.toFixed(2) + '%',
        maxAllowed: this.config.maxPositionPercent + '%'
      });
      
      const adjustedDollarAmount = totalAvailable * (adjustedLevelPercent / 100);
      return adjustedDollarAmount / currentPrice;
    } else {
      const dollarAmount = totalAvailable * (levelPercent / 100);
      
      console.log('[PositionSizer] Position size calculation:', {
        level,
        levelMultiplier,
        basePercent: basePercent + '%',
        levelPercent: levelPercent.toFixed(2) + '%',
        dollarAmount: dollarAmount.toFixed(2),
        btcAmount: (dollarAmount / currentPrice).toFixed(6),
        remainingPercent: (this.config.maxPositionPercent - this.getTotalUsedPercent()).toFixed(2) + '%'
      });
      
      return dollarAmount / currentPrice;
    }
  }

  /**
   * Calculate position size using fixed amount approach
   */
  private calculateFixedBasedSize(level: number, currentPrice: number): number {
    const baseAmount = this.config.basePositionAmount; // e.g., $50
    let levelMultiplier: number;
    
    if (this.config.ratioMultiplier === 1) {
      levelMultiplier = level;
    } else {
      levelMultiplier = Math.pow(this.config.ratioMultiplier, level - 1);
    }
    
    const dollarAmount = baseAmount * levelMultiplier;
    
    console.log('[PositionSizer] Fixed position size calculation:', {
      level,
      levelMultiplier,
      baseAmount,
      dollarAmount,
      btcAmount: (dollarAmount / currentPrice).toFixed(6)
    });
    
    return dollarAmount / currentPrice;
  }

  /**
   * Calculate the sum of ratio multipliers for all levels
   */
  private calculateRatioSum(levels: number, multiplier: number): number {
    let sum = 0;
    if (multiplier === 1) {
      // Linear progression: 1 + 2 + 3 + ... + n = n(n+1)/2
      sum = (levels * (levels + 1)) / 2;
    } else {
      // Exponential progression
      for (let i = 0; i < levels; i++) {
        sum += Math.pow(multiplier, i);
      }
    }
    return sum;
  }

  /**
   * Calculate the total percentage already used across all levels
   */
  private getTotalUsedPercent(): number {
    const basePercent = this.config.basePositionPercent;
    let usedPercent = 0;
    
    for (let i = 1; i <= this.state.currentLevel; i++) {
      if (this.config.ratioMultiplier === 1) {
        usedPercent += basePercent * i;
      } else {
        usedPercent += basePercent * Math.pow(this.config.ratioMultiplier, i - 1);
      }
    }
    
    return usedPercent;
  }
}