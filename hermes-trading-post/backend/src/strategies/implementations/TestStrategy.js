import { BaseStrategy } from '../base/BaseStrategy.js';

/**
 * TEST STRATEGY - High Frequency Trading
 *
 * Based on analysis of 2 months of BTC data (Oct-Dec 2025):
 * - Average hourly drop: 0.372%
 * - 72.6% of drops exceed 0.1%
 * - Average hourly recovery: 0.357%
 *
 * Key Features:
 * - Lower entry threshold: 0.05% drops trigger buys (vs 0.1% for ReverseRatio)
 * - Tighter profit target: 0.3% (vs 0.85% for ReverseRatio)
 * - More levels: up to 15 levels for more frequent entries
 * - Expected trades: ~10 entries/day, ~5 exits/day (5x more frequent than ReverseRatio)
 */
export class TestStrategy extends BaseStrategy {
  constructor(config) {
    super({
      initialDropPercent: 0.05,    // 0.05% drop triggers entry (more sensitive)
      levelDropPercent: 0.05,      // 0.05% between levels (tighter spacing)
      profitTarget: 0.3,           // 0.3% profit target (faster exits)
      maxLevels: 15,               // Up to 15 levels for more entries
      basePositionPercent: 4,      // 4% of balance for first level (smaller)
      ...config
    });
  }

  analyze(candles, currentPrice) {
    this.updateRecentHigh(candles, currentPrice);

    // Check for sell signal
    if (this.positions.length > 0) {
      const profitPercent = this.calculateProfitPercent(currentPrice);

      if (profitPercent >= this.config.profitTarget) {
        return { type: 'sell', reason: `Target profit ${this.config.profitTarget}% reached` };
      }
    }

    // Check for buy signal
    const dropFromHigh = ((this.recentHigh - currentPrice) / this.recentHigh) * 100;
    const currentLevel = this.positions.length + 1;

    // Special handling for initial position - be aggressive
    if (this.positions.length === 0) {
      // For the first position, open immediately or on ANY drop
      if (candles.length <= 5) {
        return {
          type: 'buy',
          reason: `Opening initial position immediately (startup)`,
          metadata: { level: 1 }
        };
      } else if (dropFromHigh >= 0.01) {
        return {
          type: 'buy',
          reason: `Opening initial position (drop: ${dropFromHigh.toFixed(2)}%)`,
          metadata: { level: 1 }
        };
      }
    }

    if (currentLevel <= this.config.maxLevels) {
      const requiredDrop = this.config.initialDropPercent +
                          (currentLevel - 1) * this.config.levelDropPercent;

      if (dropFromHigh >= requiredDrop) {
        return {
          type: 'buy',
          reason: `Drop level ${currentLevel} reached: ${dropFromHigh.toFixed(2)}%`,
          metadata: { level: currentLevel }
        };
      }
    }

    return { type: 'hold' };
  }

  calculatePositionSize(totalBalance, signal, currentPrice) {
    const level = signal.metadata?.level || 1;

    // Capital reservation: Reserve 50% of funds for deep dips
    let avgEntryPrice = 0;
    if (this.positions.length > 0) {
      const totalValue = this.positions.reduce((sum, pos) => sum + (pos.entryPrice * pos.size), 0);
      const totalSize = this.positions.reduce((sum, pos) => sum + pos.size, 0);
      avgEntryPrice = totalValue / totalSize;
    } else {
      avgEntryPrice = this.recentHigh;
    }

    // Check if we're in a deep dip (> $5000 below recent buys)
    const dipFromAvgEntry = avgEntryPrice - currentPrice;
    const isDeepDip = dipFromAvgEntry >= 5000;

    // Reserve 50% of capital unless we're in a deep dip
    const availableBalance = isDeepDip ? totalBalance : totalBalance * 0.5;

    const baseAmount = availableBalance * (this.config.basePositionPercent / 100);
    const multiplier = Math.pow(1.5, level - 1); // Increase size with each level
    return (baseAmount * multiplier) / currentPrice;
  }
}
