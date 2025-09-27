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
    
    // Special handling for initial position - be VERY aggressive
    if (this.positions.length === 0) {
      console.log(`Initial position check: recentHigh=${this.recentHigh}, currentPrice=${currentPrice}, drop=${dropFromHigh.toFixed(3)}%, candles=${candles.length}`);
      
      // For the first position, open immediately or on ANY drop
      if (candles.length <= 5) {
        console.log(`INITIAL BUY SIGNAL: Opening first position immediately at ${currentPrice} (startup phase)`);
        return { 
          type: 'buy', 
          reason: `Opening initial position immediately (startup)`,
          metadata: { level: 1 }
        };
      } else if (dropFromHigh >= 0.01) {
        console.log(`INITIAL BUY SIGNAL: Opening first position at ${currentPrice}, drop: ${dropFromHigh.toFixed(2)}%`);
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
      
      // Debug logging for buy levels
      if (this.positions.length > 0 && !this._lastLoggedLevel) {
        this._lastLoggedLevel = 0;
      }
      if (this.positions.length !== this._lastLoggedLevel) {
        console.log(`Strategy state: ${this.positions.length} positions, Level ${currentLevel}, Required drop: ${requiredDrop.toFixed(2)}%, Current drop: ${dropFromHigh.toFixed(2)}%`);
        this._lastLoggedLevel = this.positions.length;
      }
      
      // Only log when very close to trigger (within 0.05%)
      if (Math.abs(dropFromHigh - requiredDrop) < 0.05) {
        console.log(`Buy trigger approaching: ${dropFromHigh.toFixed(3)}% / ${requiredDrop.toFixed(3)}%`);
      }
      
      if (dropFromHigh >= requiredDrop) {
        console.log(`BUY SIGNAL: Level ${currentLevel}, Drop ${dropFromHigh.toFixed(2)}% >= Required ${requiredDrop.toFixed(2)}%`);
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
    const baseAmount = totalBalance * (this.config.basePositionPercent / 100);
    const multiplier = Math.pow(1.5, level - 1); // Increase size with each level
    return (baseAmount * multiplier) / currentPrice;
  }
}