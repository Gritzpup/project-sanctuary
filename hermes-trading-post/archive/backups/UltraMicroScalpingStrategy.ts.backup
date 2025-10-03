import { Strategy } from '../base/Strategy';
import type { CandleData, Position, Signal, StrategyConfig } from '../base/StrategyTypes';

/**
 * ULTRA MICRO SCALPING STRATEGY - Hyper-aggressive 1m timeframe
 * 
 * Philosophy: Capture tiny price movements with maximum frequency
 * 
 * Key Features:
 * - Ultra-responsive: 0.15% drops trigger entries
 * - Quick profits: 0.4% target = 0.1% net after fees  
 * - Very high frequency: 200+ trades per day on 1m
 * - Aggressive sizing: 30% initial position
 * - Lightning detection: 5-candle lookback (5 minutes)
 * - Max 2 levels to avoid over-leveraging
 * 
 * Math:
 * - $10,000 × 30% = $3,000 first position
 * - 0.4% move = $12 gross profit
 * - Minus 0.3% fees = $9 net profit per trade
 * - 200 trades/day = $1,800 daily profit (18% return)
 */
export interface UltraMicroScalpingConfig extends StrategyConfig {
  initialDropPercent: number;    // % drop from recent high to start buying
  levelDropPercent: number;      // % drop between levels
  ratioMultiplier: number;       // Multiplier for each level
  profitTarget: number;          // % above initial entry to sell all
  maxLevels: number;            // Maximum number of buy levels
  lookbackPeriod: number;       // Candles to look back for recent high
  basePositionPercent: number;   // Base percentage of balance for first level
  maxPositionPercent: number;    // Max percentage of balance to use across all levels
}

export class UltraMicroScalpingStrategy extends Strategy {
  private recentHigh: number = 0;
  private initialEntryPrice: number = 0;
  private currentLevel: number = 0;
  private levelPrices: number[] = [];
  private levelSizes: number[] = [];

  constructor(config: Partial<UltraMicroScalpingConfig> = {}) {
    const fullConfig: UltraMicroScalpingConfig = {
      vaultAllocation: 85.7,     // 6/7 of profit goes to vault
      btcGrowthAllocation: 14.3, // 1/7 of profit goes to BTC growth
      initialDropPercent: 0.15,  // 0.15% drop triggers first entry (hyper-sensitive for 1m)
      levelDropPercent: 0.2,     // 0.2% between levels
      ratioMultiplier: 1.8,      // Aggressive scaling: 30%, 54% (of initial)
      profitTarget: 0.4,         // 0.4% gross = 0.1% net profit (after 0.15% fees each way)
      maxLevels: 2,              // Max 2 levels to avoid over-leverage
      lookbackPeriod: 5,         // 5 candles = 5 minutes on 1m timeframe
      basePositionPercent: 30,   // 30% of balance for first level
      maxPositionPercent: 90,    // Max 90% of balance total
      ...config
    };

    super(
      'Ultra Micro-Scalping',
      `Lightning-fast entries on ${fullConfig.initialDropPercent}% dips, exits at ${fullConfig.profitTarget}% for ${(fullConfig.profitTarget - 0.3).toFixed(3)}% net profit`,
      fullConfig
    );
  }

  analyze(candles: CandleData[], currentPrice: number): Signal {
    const config = this.config as UltraMicroScalpingConfig;
    
    // Debug log every 20 candles for ultra micro scalping
    if (candles.length % 20 === 0) {
      console.log(`[UltraMicroScalping] Analyze - Candle #${candles.length}`, {
        currentPrice,
        date: new Date(candles[candles.length - 1].time * 1000).toISOString(),
        balance: this.state.balance,
        positions: this.state.positions.length,
        initialEntry: this.initialEntryPrice,
        currentLevel: this.currentLevel,
        recentHigh: this.recentHigh
      });
    }
    
    // Reset after complete exit
    if (this.state.positions.length === 0 && this.initialEntryPrice > 0) {
      console.log('[UltraMicroScalping] Resetting after complete exit', {
        date: new Date(candles[candles.length - 1].time * 1000).toISOString()
      });
      this.resetCycle();
    }
    
    // Fix sync issues
    if (this.state.positions.length > 0 && this.state.balance.btcPositions <= 0.0000001) {
      console.log('[UltraMicroScalping] SYNC FIX: Clearing phantom positions');
      this.state.positions = [];
      this.resetCycle();
    }
    
    // Update recent high
    this.updateRecentHigh(candles, currentPrice);

    // Check for profit taking
    const totalPositionSize = this.getTotalPositionSize();
    
    // Log profit progress every 10 candles when we have positions
    if (this.state.positions.length > 0 && candles.length % 10 === 0) {
      const targetPrice = this.initialEntryPrice * (1 + (config.profitTarget / 100));
      const currentProfit = ((currentPrice - this.initialEntryPrice) / this.initialEntryPrice) * 100;
      const totalPositionValue = totalPositionSize * currentPrice;
      const totalInvested = this.state.positions.reduce((sum, p) => sum + (p.size * p.entryPrice), 0);
      const unrealizedPnL = totalPositionValue - totalInvested;
      
      console.log('[UltraMicroScalping] ⚡ Position Status:', {
        profitTarget: config.profitTarget + '%',
        positions: this.state.positions.length,
        totalBTC: totalPositionSize.toFixed(6),
        totalInvested: totalInvested.toFixed(2),
        currentValue: totalPositionValue.toFixed(2),
        unrealizedPnL: unrealizedPnL.toFixed(2),
        currentProfit: currentProfit.toFixed(4) + '%',
        netAfterFees: (currentProfit - 0.3).toFixed(4) + '%',
        progressToTarget: ((currentProfit / config.profitTarget) * 100).toFixed(1) + '%'
      });
    }
    
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
        
        console.log('[UltraMicroScalping] ⚡🎉 ULTRA SELL SIGNAL!', {
          sellSize: sellSize.toFixed(6),
          currentPrice: currentPrice.toFixed(2),
          profitTarget: config.profitTarget + '%',
          reason: `Taking profit at ${config.profitTarget}% above initial entry`
        });
        
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
    
    // Log market status every 20 candles or on significant drops
    if (candles.length <= 10 || dropFromHigh >= 0.2 || candles.length % 20 === 0) {
      console.log('[UltraMicroScalping] ⚡ Market status:', {
        candleCount: candles.length,
        currentPrice,
        recentHigh: this.recentHigh,
        dropFromHigh: dropFromHigh.toFixed(4) + '%',
        hasPositions: this.state.positions.length > 0,
        initialDropThreshold: config.initialDropPercent + '%',
        needsDrop: Math.max(0, config.initialDropPercent - dropFromHigh).toFixed(4) + '% more'
      });
    }
    
    // Initial entry
    if (this.state.positions.length === 0 && dropFromHigh >= config.initialDropPercent) {
      console.log('[UltraMicroScalping] ⚡⚡ ULTRA ENTRY TRIGGERED!', {
        dropFromHigh: dropFromHigh.toFixed(4) + '%',
        requiredDrop: config.initialDropPercent + '%',
        currentPrice,
        recentHigh: this.recentHigh
      });
      
      this.initialEntryPrice = currentPrice;
      this.currentLevel = 1;
      this.levelPrices = [currentPrice];
      
      return {
        type: 'buy',
        strength: 0.9,
        price: currentPrice,
        reason: `Ultra entry - ${dropFromHigh.toFixed(3)}% drop from recent high`,
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
      
      console.log('[UltraMicroScalping] ⚡ Level check:', {
        currentLevel: this.currentLevel,
        maxLevels: config.maxLevels,
        dropFromLastLevel: dropFromLastLevel.toFixed(4) + '%',
        requiredDrop: config.levelDropPercent + '%',
        wouldTrigger: dropFromLastLevel >= config.levelDropPercent
      });
      
      if (dropFromLastLevel >= config.levelDropPercent) {
        this.currentLevel++;
        this.levelPrices.push(currentPrice);
        
        console.log('[UltraMicroScalping] ⚡⚡ ULTRA LEVEL ENTRY!', {
          level: this.currentLevel,
          dropFromLastLevel: dropFromLastLevel.toFixed(4) + '%',
          price: currentPrice
        });
        
        return {
          type: 'buy',
          strength: 0.9,
          price: currentPrice,
          reason: `Level ${this.currentLevel} ultra entry - ${dropFromLastLevel.toFixed(3)}% drop from last level`,
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
    
    const config = this.config as UltraMicroScalpingConfig;
    const level = signal.metadata.level;
    
    const totalAvailable = this.state.balance.usd + this.state.balance.vault;
    
    console.log('[UltraMicroScalping] ⚡ Position size calculation:', {
      balance,
      totalAvailable,
      level,
      currentPrice
    });
    
    // Percentage-based sizing
    const basePercent = config.basePositionPercent / 100;
    let positionValue: number;
    
    if (config.ratioMultiplier === 1) {
      // Equal sizing
      positionValue = balance * basePercent;
    } else {
      // Progressive sizing: 30%, 54% for levels 1, 2 with 1.8x multiplier
      const levelRatio = Math.pow(config.ratioMultiplier, level - 1);
      positionValue = balance * (basePercent * levelRatio);
    }
    
    // Apply max position limit
    const totalPositionValue = this.getTotalPositionValue(currentPrice);
    const maxAllowed = balance * (config.maxPositionPercent / 100);
    if (totalPositionValue + positionValue > maxAllowed) {
      positionValue = Math.max(0, maxAllowed - totalPositionValue);
      console.log('[UltraMicroScalping] ⚡ Position limited by max percentage:', {
        original: positionValue,
        limited: positionValue,
        maxAllowed
      });
    }
    
    const size = positionValue / currentPrice;
    
    console.log('[UltraMicroScalping] ⚡ Position calculated:', {
      level,
      positionValueUSD: positionValue.toFixed(2),
      btcSize: size.toFixed(6),
      percentOfBalance: ((positionValue / balance) * 100).toFixed(1) + '%'
    });
    
    if (this.levelSizes.length < level) {
      this.levelSizes.push(size);
    }
    
    return size;
  }

  shouldTakeProfit(position: Position, currentPrice: number): boolean {
    const config = this.config as UltraMicroScalpingConfig;
    
    if (this.initialEntryPrice > 0) {
      const targetPrice = this.initialEntryPrice * (1 + config.profitTarget / 100);
      const currentProfit = ((currentPrice - this.initialEntryPrice) / this.initialEntryPrice) * 100;
      
      // Log when close to target (within 80%)
      if (currentProfit >= config.profitTarget * 0.8) {
        console.log('[UltraMicroScalping] ⚡🎯 NEAR ULTRA TARGET:', {
          currentPrice: currentPrice.toFixed(2),
          targetPrice: targetPrice.toFixed(2),
          currentProfit: currentProfit.toFixed(4) + '%',
          targetProfit: config.profitTarget + '%',
          distanceLeft: ((targetPrice - currentPrice) / currentPrice * 100).toFixed(4) + '%'
        });
      }
      
      if (currentPrice >= targetPrice) {
        console.log('[UltraMicroScalping] ⚡🚀 ULTRA TARGET REACHED!', {
          currentProfit: currentProfit.toFixed(4) + '%',
          netProfit: (currentProfit - 0.3).toFixed(4) + '%',
          currentPrice,
          targetPrice
        });
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
    const config = this.config as UltraMicroScalpingConfig;
    return config.lookbackPeriod + 2; // Minimal buffer
  }
  
  // Suggest 1m timeframe for this strategy
  getRequiredGranularity(): string | null {
    return '1m'; // Optimized for 1 minute candles
  }
  
  getRequiredPeriod(): string | null {
    return '2H'; // 2 hours gives us 120 candles on 1m
  }

  // Helper methods
  private updateRecentHigh(candles: CandleData[], currentPrice: number): void {
    const config = this.config as UltraMicroScalpingConfig;
    
    if (this.state.positions.length === 0) {
      // Initialize immediately for ultra-fast trading
      if (this.recentHigh === 0 && candles.length > 0) {
        this.recentHigh = candles[0].high;
        console.log(`[UltraMicroScalping] ⚡ Initialized to first candle high ${this.recentHigh.toFixed(2)}`);
      }
      
      // Use lookback window once we have enough candles
      if (candles.length >= config.lookbackPeriod) {
        const lookback = config.lookbackPeriod;
        const startIndex = Math.max(0, candles.length - lookback);
        const recentCandles = candles.slice(startIndex);
        const lookbackHigh = Math.max(...recentCandles.map(c => c.high));
        
        if (lookbackHigh > this.recentHigh || this.recentHigh === 0) {
          this.recentHigh = lookbackHigh;
          console.log(`[UltraMicroScalping] ⚡ Updated to ${lookback}-candle high: ${this.recentHigh.toFixed(2)}`);
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
        console.log(`[UltraMicroScalping] ⚡ New ultra high: ${this.recentHigh.toFixed(2)}`);
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
    console.log('[UltraMicroScalping] ⚡ Ultra cycle reset - ready for next trade');
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

  onCandle(candle: CandleData): void {
    // This method is called for each new candle
    // The main analysis happens in the analyze() method
    console.log(`[UltraMicroScalping] ⚡ New candle: ${candle.close} at ${new Date(candle.time * 1000).toISOString()}`);
  }
}