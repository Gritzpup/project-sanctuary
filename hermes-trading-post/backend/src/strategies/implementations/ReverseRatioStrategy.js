import { BaseStrategy } from '../base/BaseStrategy.js';

export class ReverseRatioStrategy extends BaseStrategy {
  constructor(config) {
    super({
      initialDropPercent: 0.1,     // 0.1% drop triggers entry
      levelDropPercent: 0.1,       // 0.1% between levels
      profitTarget: 0.85,          // 0.85% profit target
      maxLevels: 12,               // Up to 12 levels
      basePositionPercent: 6,      // 6% of balance for first level
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

    // 🔍 DEBUG: Log drop analysis

    // Special handling for initial position - be VERY aggressive
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

    // 🔧 CAPITAL RESERVATION: Reserve 50% of funds for deep dips ($5000+ below recent buys)
    // Calculate average entry price from existing positions
    let avgEntryPrice = 0;
    if (this.positions.length > 0) {
      const totalValue = this.positions.reduce((sum, pos) => sum + (pos.entryPrice * pos.size), 0);
      const totalSize = this.positions.reduce((sum, pos) => sum + pos.size, 0);
      avgEntryPrice = totalValue / totalSize;
    } else {
      avgEntryPrice = this.recentHigh; // Use recent high if no positions yet
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