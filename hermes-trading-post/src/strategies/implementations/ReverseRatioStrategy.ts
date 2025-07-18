import { Strategy } from '../base/Strategy';
import { CandleData, Position, Signal, StrategyConfig } from '../base/StrategyTypes';

export interface ReverseRatioConfig extends StrategyConfig {
  initialDropPercent: number;    // % drop from recent high to start buying (default: 5)
  levelDropPercent: number;      // % drop between levels (default: 5)
  ratioMultiplier: number;       // Multiplier for each level (default: 2)
  profitTarget: number;          // % above initial entry to sell all (default: 7)
  maxLevels: number;            // Maximum number of buy levels (default: 5)
  lookbackPeriod: number;       // Candles to look back for recent high (default: 30)
}

export class ReverseRatioStrategy extends Strategy {
  private recentHigh: number = 0;
  private initialEntryPrice: number = 0;
  private currentLevel: number = 0;
  private levelPrices: number[] = [];
  private levelSizes: number[] = [];

  constructor(config: Partial<ReverseRatioConfig> = {}) {
    const fullConfig: ReverseRatioConfig = {
      vaultAllocation: 99,
      btcGrowthAllocation: 1,
      initialDropPercent: 5,
      levelDropPercent: 5,
      ratioMultiplier: 2,
      profitTarget: 7,
      maxLevels: 5,
      lookbackPeriod: 30,
      ...config
    };

    super(
      'Reverse Ratio Buying',
      'Buys on the way down with increasing position sizes, sells at 7% above initial entry',
      fullConfig
    );
  }

  analyze(candles: CandleData[], currentPrice: number): Signal {
    const config = this.config as ReverseRatioConfig;
    
    // Update recent high
    this.updateRecentHigh(candles, config.lookbackPeriod);

    // Check if we should take profit
    if (this.state.positions.length > 0 && this.shouldTakeProfit(this.state.positions[0], currentPrice)) {
      return {
        type: 'sell',
        strength: 1.0,
        price: currentPrice,
        size: this.getTotalPositionSize(),
        reason: `Taking profit at ${config.profitTarget}% above initial entry`,
        metadata: {
          targetPrice: this.initialEntryPrice * (1 + config.profitTarget / 100),
          totalProfit: (currentPrice - this.getAverageEntryPrice()) * this.getTotalPositionSize()
        }
      };
    }

    // Check if we should buy
    const dropFromHigh = ((this.recentHigh - currentPrice) / this.recentHigh) * 100;
    
    // Initial entry check
    if (this.state.positions.length === 0 && dropFromHigh >= config.initialDropPercent) {
      this.initialEntryPrice = currentPrice;
      this.currentLevel = 1;
      this.levelPrices = [currentPrice];
      
      return {
        type: 'buy',
        strength: 0.7,
        price: currentPrice,
        reason: `Initial entry - ${dropFromHigh.toFixed(2)}% drop from recent high`,
        metadata: {
          level: 1,
          recentHigh: this.recentHigh,
          dropPercent: dropFromHigh
        }
      };
    }

    // Additional level entries
    if (this.state.positions.length > 0 && this.currentLevel < config.maxLevels) {
      const lastLevelPrice = this.levelPrices[this.levelPrices.length - 1];
      const dropFromLastLevel = ((lastLevelPrice - currentPrice) / lastLevelPrice) * 100;
      
      if (dropFromLastLevel >= config.levelDropPercent) {
        this.currentLevel++;
        this.levelPrices.push(currentPrice);
        
        return {
          type: 'buy',
          strength: 0.8,
          price: currentPrice,
          reason: `Level ${this.currentLevel} entry - ${dropFromLastLevel.toFixed(2)}% drop from last level`,
          metadata: {
            level: this.currentLevel,
            dropFromLastLevel: dropFromLastLevel,
            totalDropFromInitial: ((this.initialEntryPrice - currentPrice) / this.initialEntryPrice) * 100
          }
        };
      }
    }

    return {
      type: 'hold',
      strength: 0,
      price: currentPrice,
      reason: 'No entry or exit conditions met'
    };
  }

  calculatePositionSize(balance: number, signal: Signal, currentPrice: number): number {
    if (signal.type !== 'buy' || !signal.metadata?.level) return 0;
    
    const config = this.config as ReverseRatioConfig;
    const level = signal.metadata.level;
    
    // Calculate base size (for level 1)
    const totalLevels = config.maxLevels;
    const ratioSum = this.calculateRatioSum(totalLevels, config.ratioMultiplier);
    const baseSize = balance / (ratioSum * currentPrice);
    
    // Calculate size for current level
    const levelRatio = Math.pow(config.ratioMultiplier, level - 1);
    const size = baseSize * levelRatio;
    
    // Store the size for this level
    if (this.levelSizes.length < level) {
      this.levelSizes.push(size);
    }
    
    return size;
  }

  shouldTakeProfit(position: Position, currentPrice: number): boolean {
    const config = this.config as ReverseRatioConfig;
    
    // Sell when price reaches profit target above initial entry
    if (this.initialEntryPrice > 0) {
      const targetPrice = this.initialEntryPrice * (1 + config.profitTarget / 100);
      return currentPrice >= targetPrice;
    }
    
    return false;
  }

  shouldStopLoss(position: Position, currentPrice: number): boolean {
    // Never sell at a loss for deflationary assets
    return false;
  }

  getRequiredHistoricalData(): number {
    const config = this.config as ReverseRatioConfig;
    return config.lookbackPeriod + 10; // Extra buffer
  }

  // Helper methods
  private updateRecentHigh(candles: CandleData[], lookback: number): void {
    const recentCandles = candles.slice(-lookback);
    this.recentHigh = Math.max(...recentCandles.map(c => c.high));
  }

  private calculateRatioSum(levels: number, multiplier: number): number {
    let sum = 0;
    for (let i = 0; i < levels; i++) {
      sum += Math.pow(multiplier, i);
    }
    return sum;
  }

  private getAverageEntryPrice(): number {
    if (this.state.positions.length === 0) return 0;
    
    let totalValue = 0;
    let totalSize = 0;
    
    for (const position of this.state.positions) {
      totalValue += position.entryPrice * position.size;
      totalSize += position.size;
    }
    
    return totalSize > 0 ? totalValue / totalSize : 0;
  }

  // Reset strategy state
  reset(): void {
    this.recentHigh = 0;
    this.initialEntryPrice = 0;
    this.currentLevel = 0;
    this.levelPrices = [];
    this.levelSizes = [];
    this.state.positions = [];
  }
}