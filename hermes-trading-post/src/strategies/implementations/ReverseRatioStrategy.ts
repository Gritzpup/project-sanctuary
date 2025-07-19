import { Strategy } from '../base/Strategy';
import type { CandleData, Position, Signal, StrategyConfig } from '../base/StrategyTypes';

export interface ReverseRatioConfig extends StrategyConfig {
  initialDropPercent: number;    // % drop from recent high to start buying (default: 5)
  levelDropPercent: number;      // % drop between levels (default: 5)
  ratioMultiplier: number;       // Multiplier for each level (default: 2)
  profitTarget: number;          // % above initial entry to sell all (default: 7)
  maxLevels: number;            // Maximum number of buy levels (default: 5)
  lookbackPeriod: number;       // Candles to look back for recent high (default: 30)
  positionSizeMode: 'percentage' | 'fixed';  // How to calculate position sizes
  basePositionPercent: number;   // Base percentage of balance for first level (if percentage mode)
  basePositionAmount: number;    // Fixed dollar amount for first level (if fixed mode)
  maxPositionPercent: number;    // Max percentage of balance to use across all levels
}

export class ReverseRatioStrategy extends Strategy {
  private recentHigh: number = 0;
  private initialEntryPrice: number = 0;
  private currentLevel: number = 0;
  private levelPrices: number[] = [];
  private levelSizes: number[] = [];

  constructor(config: Partial<ReverseRatioConfig> = {}) {
    const fullConfig: ReverseRatioConfig = {
      vaultAllocation: 85.7,     // 6/7 of profit goes to vault
      btcGrowthAllocation: 14.3, // 1/7 of profit goes to BTC growth
      initialDropPercent: 5,
      levelDropPercent: 5,
      ratioMultiplier: 2,
      profitTarget: 7,
      maxLevels: 5,
      lookbackPeriod: 30,
      positionSizeMode: 'percentage',
      basePositionPercent: 5,    // 5% of balance for first level
      basePositionAmount: 50,    // $50 for first level if using fixed mode
      maxPositionPercent: 50,    // Max 50% of balance across all levels
      ...config
    };

    super(
      'Reverse Ratio Buying',
      `Buys on the way down with increasing position sizes, sells at ${fullConfig.profitTarget}% above initial entry`,
      fullConfig
    );
  }

  analyze(candles: CandleData[], currentPrice: number): Signal {
    const config = this.config as ReverseRatioConfig;
    
    // Debug log every 100 candles
    if (candles.length % 100 === 0) {
      console.log(`[ReverseRatio] Analyze called - Candle #${candles.length}`, {
        currentPrice,
        date: new Date(candles[candles.length - 1].time * 1000).toISOString(),
        balance: this.state.balance,
        positions: this.state.positions.length,
        initialEntry: this.initialEntryPrice,
        currentLevel: this.currentLevel
      });
    }
    
    // Check if we need to reset after a complete exit
    if (this.state.positions.length === 0 && this.initialEntryPrice > 0) {
      console.log('[ReverseRatio] Resetting strategy state after complete exit', {
        date: new Date(candles[candles.length - 1].time * 1000).toISOString(),
        lastInitialEntry: this.initialEntryPrice,
        lastRecentHigh: this.recentHigh
      });
      this.resetCycle();
    }
    
    // Fix sync issues - if we have positions tracked but no actual BTC, clear positions
    if (this.state.positions.length > 0 && this.state.balance.btcPositions <= 0.0000001) {
      console.log('[ReverseRatio] SYNC FIX: Clearing phantom positions - btcPositions is 0 but strategy tracks positions');
      this.state.positions = [];
      this.resetCycle();
    }
    
    // Update recent high - track the highest price we've seen
    this.updateRecentHigh(candles, currentPrice);

    // Check if we should take profit
    const totalPositionSize = this.getTotalPositionSize();
    
    // Log profit progress every 10 candles when we have positions
    if (this.state.positions.length > 0 && candles.length % 10 === 0) {
      const targetPrice = this.initialEntryPrice * (1 + (config.profitTarget / 100));
      const currentProfit = ((currentPrice - this.initialEntryPrice) / this.initialEntryPrice) * 100;
      
      // Calculate minimum acceptable profit for micro scalping
      let minAcceptable = config.profitTarget;
      if (config.profitTarget <= 0.1) {
        minAcceptable = Math.max(0.02, config.profitTarget * 0.5);
      } else if (config.profitTarget <= 0.5) {
        minAcceptable = config.profitTarget * 0.7;
      }
      
      console.log('[ReverseRatio] Profit check:', {
        initialEntry: this.initialEntryPrice.toFixed(2),
        currentPrice: currentPrice.toFixed(2),
        targetPrice: targetPrice.toFixed(2),
        currentProfit: currentProfit.toFixed(4) + '%',
        targetProfit: config.profitTarget + '%',
        minAcceptable: minAcceptable.toFixed(4) + '%',
        willSellAt: currentProfit >= minAcceptable ? 'YES' : 'NO',
        needsMore: (minAcceptable - currentProfit).toFixed(4) + '%'
      });
    }
    
    if (this.state.positions.length > 0 && totalPositionSize > 0 && this.shouldTakeProfit(this.state.positions[0], currentPrice)) {
      // Double check we have BTC to sell
      if (this.state.balance.btcPositions <= 0) {
        console.warn('Strategy has positions but btcPositions is 0 - skipping sell signal');
        return {
          type: 'hold',
          strength: 0,
          price: currentPrice,
          reason: 'No BTC balance to sell'
        };
      }
      
      // Use the minimum of our tracked positions and actual BTC balance
      const sellSize = Math.min(totalPositionSize, this.state.balance.btcPositions);
      
      // This is a complete exit - we're selling all positions
      const signal = {
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
      
      return signal;
    }

    // Check if we should buy
    const dropFromHigh = ((this.recentHigh - currentPrice) / this.recentHigh) * 100;
    
    // Debug logging for significant drops or periodic updates
    if (candles.length <= 50 || dropFromHigh >= 3 || candles.length % 250 === 0) {
      console.log('[ReverseRatio] Market status:', {
        candleCount: candles.length,
        date: new Date(candles[candles.length - 1].time * 1000).toISOString(),
        currentPrice,
        recentHigh: this.recentHigh,
        dropFromHigh: dropFromHigh.toFixed(2) + '%',
        hasPositions: this.state.positions.length > 0,
        initialDropThreshold: config.initialDropPercent + '%',
        availableBalance: (this.state.balance.vault + this.state.balance.usd).toFixed(2),
        needsDrop: (config.initialDropPercent - dropFromHigh).toFixed(2) + '% more',
        currentLevel: this.currentLevel,
        initialEntry: this.initialEntryPrice
      });
    }
    
    // Initial entry check
    if (this.state.positions.length === 0 && dropFromHigh >= config.initialDropPercent) {
      console.log('[ReverseRatio] INITIAL ENTRY SIGNAL TRIGGERED', {
        dropFromHigh: dropFromHigh.toFixed(2) + '%',
        requiredDrop: config.initialDropPercent + '%',
        currentPrice,
        recentHigh: this.recentHigh,
        usdcBalance: this.state.balance.vault
      });
      
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
    
    // Use total available balance (USD + vault)
    const totalAvailable = this.state.balance.usd + this.state.balance.vault;
    
    console.log('[ReverseRatio] Calculating position size:', {
      balancePassedIn: balance,
      actualUSD: this.state.balance.usd,
      actualVault: this.state.balance.vault,
      totalAvailable,
      level,
      currentPrice,
      signalType: signal.type
    });
    
    // Calculate position value in USD based on mode
    let positionValue: number;
    
    if (config.positionSizeMode === 'fixed') {
      // Fixed dollar amount mode
      if (config.ratioMultiplier === 1) {
        // Linear: $50, $100, $150, $200...
        positionValue = config.basePositionAmount * level;
      } else {
        // Exponential based on ratio multiplier
        const levelRatio = Math.pow(config.ratioMultiplier, level - 1);
        positionValue = config.basePositionAmount * levelRatio;
      }
    } else {
      // Percentage mode (default)
      const basePercent = config.basePositionPercent / 100;
      
      if (config.ratioMultiplier === 1) {
        // Linear: 5%, 10%, 15%, 20%...
        positionValue = balance * (basePercent * level);
      } else {
        // Exponential based on ratio multiplier
        const levelRatio = Math.pow(config.ratioMultiplier, level - 1);
        positionValue = balance * (basePercent * levelRatio);
      }
    }
    
    // Apply max position limit
    const totalPositionValue = this.getTotalPositionValue(currentPrice);
    const maxAllowed = balance * (config.maxPositionPercent / 100);
    if (totalPositionValue + positionValue > maxAllowed) {
      positionValue = Math.max(0, maxAllowed - totalPositionValue);
      console.log('[ReverseRatio] Position size limited by max percentage:', {
        originalValue: positionValue,
        limitedValue: positionValue,
        maxAllowed,
        totalPositionValue
      });
    }
    
    // Convert USD value to BTC size
    const size = positionValue / currentPrice;
    
    console.log('[ReverseRatio] Position size calculated:', {
      level,
      positionValueUSD: positionValue,
      btcSize: size,
      btcPrice: currentPrice,
      ratioMultiplier: config.ratioMultiplier
    });
    
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
      const currentProfit = ((currentPrice - this.initialEntryPrice) / this.initialEntryPrice) * 100;
      
      // ULTRA MICRO SCALPING: For extremely small targets, take ANY meaningful profit
      if (config.profitTarget <= 0.1 && currentProfit > 0) {
        // For 0.02-0.1% targets, take profit at 50% of target or 0.02% minimum
        const ultraMinProfit = Math.max(0.02, config.profitTarget * 0.5);
        
        if (currentProfit >= ultraMinProfit) {
          console.log('[ReverseRatio] ULTRA MICRO PROFIT TAKEN!', {
            currentProfit: currentProfit.toFixed(4) + '%',
            targetProfit: config.profitTarget + '%',
            ultraMinProfit: ultraMinProfit.toFixed(4) + '%',
            currentPrice,
            initialEntry: this.initialEntryPrice
          });
          return true;
        }
      }
      // MICRO SCALPING: If profit target is small (0.1-0.5%), take profit at 70% of target
      else if (config.profitTarget <= 0.5 && currentProfit > 0) {
        const minAcceptableProfit = config.profitTarget * 0.7; // Accept 70% of target
        
        if (currentProfit >= minAcceptableProfit) {
          console.log('[ReverseRatio] MICRO SCALP PROFIT TAKEN!', {
            currentProfit: currentProfit.toFixed(4) + '%',
            targetProfit: config.profitTarget + '%',
            minAcceptable: minAcceptableProfit.toFixed(4) + '%',
            currentPrice,
            initialEntry: this.initialEntryPrice
          });
          return true;
        }
      }
      
      // Standard profit taking - wait for full target
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
  private updateRecentHigh(candles: CandleData[], currentPrice: number): void {
    const config = this.config as ReverseRatioConfig;
    
    // If we have no positions, track the rolling high from recent candles
    if (this.state.positions.length === 0) {
      const lookback = config.lookbackPeriod;
      const startIndex = Math.max(0, candles.length - lookback);
      const recentCandles = candles.slice(startIndex);
      const lookbackHigh = Math.max(...recentCandles.map(c => c.high));
      
      // If recent high was reset (0), use lookback high
      if (this.recentHigh === 0) {
        this.recentHigh = lookbackHigh;
        console.log(`[ReverseRatio] Initialized recent high to ${this.recentHigh.toFixed(2)} from ${lookback} candle lookback`);
      } else if (currentPrice > this.recentHigh) {
        // Update to current price if it's a new high
        this.recentHigh = currentPrice;
        console.log(`[ReverseRatio] Updated recent high to current price: ${this.recentHigh.toFixed(2)}`);
      }
    } else {
      // When in a position, only update if we see a new high
      if (currentPrice > this.recentHigh) {
        this.recentHigh = currentPrice;
        console.log(`[ReverseRatio] New high while in position: ${this.recentHigh.toFixed(2)}`);
      }
    }
  }

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
  // Reset only the cycle-specific state (called after complete exit)
  private resetCycle(): void {
    this.initialEntryPrice = 0;
    this.currentLevel = 0;
    this.levelPrices = [];
    this.levelSizes = [];
    // Reset recent high to allow finding new opportunities after a complete cycle
    this.recentHigh = 0;
    console.log('[ReverseRatio] Cycle reset - will find new recent high for next trade');
    // Don't reset positions - they should already be empty
  }
  
  // Full reset (called at strategy initialization)
  reset(): void {
    this.recentHigh = 0;
    this.initialEntryPrice = 0;
    this.currentLevel = 0;
    this.levelPrices = [];
    this.levelSizes = [];
    this.state.positions = [];
  }
  
  private getTotalPositionSize(): number {
    return this.state.positions.reduce((sum, pos) => sum + pos.size, 0);
  }
  
  private getTotalPositionValue(currentPrice: number): number {
    return this.state.positions.reduce((sum, pos) => sum + (pos.size * currentPrice), 0);
  }
}