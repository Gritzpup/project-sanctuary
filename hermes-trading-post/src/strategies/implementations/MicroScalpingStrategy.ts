import { Strategy } from '../base/Strategy';
import type { CandleData, Position, Signal, StrategyConfig } from '../base/StrategyTypes';

/**
 * MICRO SCALPING STRATEGY - Optimized for 1H timeframe
 * 
 * Philosophy: Capture small, frequent price movements on 1H candles
 * 
 * Key Features:
 * - Ultra-responsive: 0.3% drops trigger entries
 * - Quick profits: 0.8% target = 0.5% net after fees
 * - High frequency: 40-60 trades per day on 1H
 * - Aggressive sizing: 25% initial position
 * - Fast detection: 12-candle lookback (12 hours)
 * - Max 3 levels to avoid over-leveraging
 * 
 * Math:
 * - $10,000 × 25% = $2,500 first position
 * - 0.8% move = $20 gross profit
 * - Minus 0.3% fees = $12.50 net profit per trade
 * - 40 trades/day = $500 daily profit (5% return)
 */
export interface MicroScalpingConfig extends StrategyConfig {
  initialDropPercent: number;    // % drop from recent high to start buying
  levelDropPercent: number;      // % drop between levels
  ratioMultiplier: number;       // Multiplier for each level
  profitTarget: number;          // % above initial entry to sell all
  maxLevels: number;            // Maximum number of buy levels
  lookbackPeriod: number;       // Candles to look back for recent high
  basePositionPercent: number;   // Base percentage of balance for first level
  maxPositionPercent: number;    // Max percentage of balance to use across all levels
}

export class MicroScalpingStrategy extends Strategy {
  private recentHigh: number = 0;
  private initialEntryPrice: number = 0;
  private currentLevel: number = 0;
  private levelPrices: number[] = [];
  private levelSizes: number[] = [];

  constructor(config: Partial<MicroScalpingConfig> = {}) {
    const fullConfig: MicroScalpingConfig = {
      vaultAllocation: 85.7,     // 6/7 of profit goes to vault
      btcGrowthAllocation: 14.3, // 1/7 of profit goes to BTC growth
      initialDropPercent: 0.3,   // 0.3% drop triggers first entry (more sensitive for 1H)
      levelDropPercent: 0.4,     // 0.4% between levels
      ratioMultiplier: 1.5,      // Moderate scaling: 25%, 37.5%, 37.5% (of initial)
      profitTarget: 0.8,         // 0.8% gross = 0.35% net profit (after 0.15% fees each way)
      maxLevels: 3,              // Max 3 levels to avoid over-leverage
      lookbackPeriod: 12,        // 12 candles = 12 hours on 1H timeframe
      basePositionPercent: 25,   // 25% of balance for first level
      maxPositionPercent: 85,    // Max 85% of balance total
      ...config
    };

    super(
      'Micro Scalping (1H)',
      `Ultra-fast entries on ${fullConfig.initialDropPercent}% dips, exits at ${fullConfig.profitTarget}% for ${(fullConfig.profitTarget - 0.3).toFixed(3)}% net profit`,
      fullConfig
    );
  }

  analyze(candles: CandleData[], currentPrice: number): Signal {
    const config = this.config as MicroScalpingConfig;

    // Reset after complete exit
    if (this.state.positions.length === 0 && this.initialEntryPrice > 0) {
      this.resetCycle();
    }

    // Fix sync issues
    if (this.state.positions.length > 0 && this.state.balance.btcPositions <= 0.0000001) {
      this.state.positions = [];
      this.resetCycle();
    }
    
    // Update recent high
    this.updateRecentHigh(candles, currentPrice);

    // Check for profit taking
    const totalPositionSize = this.getTotalPositionSize();

    if (this.state.positions.length > 0 && totalPositionSize > 0) {
      const shouldSell = this.shouldTakeProfit(this.state.positions[0], currentPrice);
      
      if (shouldSell) {
        if (this.state.balance.btcPositions <= 0) {
          return {
            type: 'hold',
            strength: 0,
            price: currentPrice,
            reason: 'No BTC balance to sell'
          };
        }
        
        const sellSize = Math.min(totalPositionSize, this.state.balance.btcPositions);

        return {
          type: 'sell' as const,
          strength: 1.0,
          price: currentPrice,
          size: sellSize,
          reason: `Taking profit at ${config.profitTarget}% above initial entry`,
          metadata: {
            targetPrice: this.initialEntryPrice * (1 + config.profitTarget / 100),
            totalProfit: (currentPrice - this.getAverageEntryPrice()) * sellSize,
            isCompleteExit: true
          }
        };
      }
    }

    // Check for buy entries
    const dropFromHigh = ((this.recentHigh - currentPrice) / this.recentHigh) * 100;

    // Initial entry
    if (this.state.positions.length === 0 && dropFromHigh >= config.initialDropPercent) {
      this.initialEntryPrice = currentPrice;
      this.currentLevel = 1;
      this.levelPrices = [currentPrice];
      
      return {
        type: 'buy',
        strength: 0.8,
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

    const config = this.config as MicroScalpingConfig;
    const level = signal.metadata.level;

    const totalAvailable = this.state.balance.usd + this.state.balance.vault;

    // Percentage-based sizing
    const basePercent = config.basePositionPercent / 100;
    let positionValue: number;
    
    if (config.ratioMultiplier === 1) {
      // Equal sizing
      positionValue = balance * basePercent;
    } else {
      // Progressive sizing: 25%, 37.5%, 22.5% for levels 1, 2, 3 with 1.5x multiplier
      const levelRatio = Math.pow(config.ratioMultiplier, level - 1);
      positionValue = balance * (basePercent * levelRatio);
    }
    
    // Apply max position limit
    const totalPositionValue = this.getTotalPositionValue(currentPrice);
    const maxAllowed = balance * (config.maxPositionPercent / 100);
    if (totalPositionValue + positionValue > maxAllowed) {
      positionValue = Math.max(0, maxAllowed - totalPositionValue);
    }

    const size = positionValue / currentPrice;

    if (this.levelSizes.length < level) {
      this.levelSizes.push(size);
    }

    return size;
  }

  shouldTakeProfit(position: Position, currentPrice: number): boolean {
    const config = this.config as MicroScalpingConfig;

    if (this.initialEntryPrice > 0) {
      const targetPrice = this.initialEntryPrice * (1 + config.profitTarget / 100);

      if (currentPrice >= targetPrice) {
        return true;
      }
    }

    return false;
  }

  shouldStopLoss(position: Position, currentPrice: number): boolean {
    // No stop losses - we wait for recovery
    return false;
  }

  getRequiredHistoricalData(): number {
    const config = this.config as MicroScalpingConfig;
    return config.lookbackPeriod + 5; // Small buffer
  }
  
  // Suggest 1H timeframe for this strategy
  getRequiredGranularity(): string | null {
    return '1h'; // Optimized for 1 hour candles
  }
  
  getRequiredPeriod(): string | null {
    return '5D'; // 5 days gives us 120 candles on 1H
  }

  // Helper methods
  private updateRecentHigh(candles: CandleData[], currentPrice: number): void {
    const config = this.config as MicroScalpingConfig;
    
    if (this.state.positions.length === 0) {
      // Initialize immediately for fast trading
      if (this.recentHigh === 0 && candles.length > 0) {
        this.recentHigh = candles[0].high;
      }

      // Use lookback window once we have enough candles
      if (candles.length >= config.lookbackPeriod) {
        const lookback = config.lookbackPeriod;
        const startIndex = Math.max(0, candles.length - lookback);
        const recentCandles = candles.slice(startIndex);
        const lookbackHigh = Math.max(...recentCandles.map(c => c.high));

        if (lookbackHigh > this.recentHigh || this.recentHigh === 0) {
          this.recentHigh = lookbackHigh;
        }
      } else {
        // Use all available candles
        const allHighs = candles.map(c => c.high);
        const absoluteHigh = Math.max(...allHighs, currentPrice);
        this.recentHigh = absoluteHigh;
      }

      // Update if current price is new high
      if (currentPrice > this.recentHigh) {
        this.recentHigh = currentPrice;
      }
    } else {
      // In position - only update on new highs
      if (currentPrice > this.recentHigh) {
        this.recentHigh = currentPrice;
      }
    }
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

  private resetCycle(): void {
    this.initialEntryPrice = 0;
    this.currentLevel = 0;
    this.levelPrices = [];
    this.levelSizes = [];
    this.recentHigh = 0;
  }
  
  reset(): void {
    this.recentHigh = 0;
    this.initialEntryPrice = 0;
    this.currentLevel = 0;
    this.levelPrices = [];
    this.levelSizes = [];
    this.state.positions = [];
  }
  
  getTotalPositionSize(): number {
    return this.state.positions.reduce((sum, pos) => sum + pos.size, 0);
  }
  
  private getTotalPositionValue(currentPrice: number): number {
    return this.state.positions.reduce((sum, pos) => sum + (pos.size * currentPrice), 0);
  }
}