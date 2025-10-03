import { Strategy } from '../base/Strategy';
import type { CandleData, Position, Signal, StrategyConfig } from '../base/StrategyTypes';

/**
 * ULTRA MICRO-SCALPING STRATEGY
 * 
 * Philosophy: Buy every micro dip, sell for tiny profits, never lose because Bitcoin always recovers
 * 
 * Key Features:
 * - Hair-trigger entries: 0.02% drops trigger buys
 * - Minimum viable profits: 0.9% target = 0.075% net after 0.825% fees
 * - YOLO position sizing: 90% on first entry
 * - No stop losses: We wait for recovery
 * - Ultra-fast detection: 3-candle lookback
 * - High frequency: 10-50+ trades per hour possible
 * 
 * Math:
 * - $1000 × 90% = $900 position
 * - 0.9% move = $8.10 gross profit
 * - Minus 0.825% fees = $0.675 net profit per trade
 * - 20 trades/day = $13.50 daily profit (1.35% return)
 */
export interface ReverseRatioConfig extends StrategyConfig {
  initialDropPercent: number;    // % drop from recent high to start buying (default: 0.01)
  levelDropPercent: number;      // % drop between levels (default: 0.008)
  ratioMultiplier: number;       // Multiplier for each level (default: 2)
  profitTarget: number;          // % above initial entry to sell all (default: 0.85)
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
      initialDropPercent: 0.1,   // Micro-scalping: 0.1% drop triggers entry
      levelDropPercent: 0.1,     // Micro-scalping: 0.1% between levels
      ratioMultiplier: 2,
      profitTarget: 0.85,        // Ultra micro-scalping: 0.85% profit target
      maxLevels: 12,             // Ultra micro-scalping: up to 12 levels
      lookbackPeriod: 30,
      positionSizeMode: 'percentage',
      basePositionPercent: 6,    // 6% of balance for first level
      basePositionAmount: 50,    // $50 for first level if using fixed mode
      maxPositionPercent: 90,    // Max 90% of balance across all levels
      ...config
    };

    super(
      'Ultra Micro-Scalping',
      `Hair-trigger entries on ${fullConfig.initialDropPercent}% dips, exits at ${fullConfig.profitTarget}% for ${(fullConfig.profitTarget - 0.825).toFixed(3)}% net profit`,
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
      const totalPositionValue = totalPositionSize * currentPrice;
      const totalInvested = this.state.positions.reduce((sum, p) => sum + (p.size * p.entryPrice), 0);
      const unrealizedPnL = totalPositionValue - totalInvested;
      
      console.log('[ReverseRatio] 📊 Position Status (every 10 candles):', {
        configProfitTarget: config.profitTarget + '%',  // Show actual config value!
        positions: this.state.positions.length,
        totalBTC: totalPositionSize.toFixed(6),
        totalInvested: totalInvested.toFixed(2),
        currentValue: totalPositionValue.toFixed(2),
        unrealizedPnL: unrealizedPnL.toFixed(2),
        initialEntry: this.initialEntryPrice.toFixed(2),
        currentPrice: currentPrice.toFixed(2),
        targetPrice: targetPrice.toFixed(2),
        currentProfit: currentProfit.toFixed(4) + '%',
        netAfterFees: (currentProfit - 0.825).toFixed(4) + '%',  // 0.35% + 0.75% - 0.275% rebate = 0.825% net
        needsToReach: ((targetPrice - currentPrice) / currentPrice * 100).toFixed(4) + '%',
        progressToTarget: ((currentProfit / config.profitTarget) * 100).toFixed(1) + '%'
      });
    }
    
    if (this.state.positions.length > 0 && totalPositionSize > 0) {
      const shouldSell = this.shouldTakeProfit(this.state.positions[0], currentPrice);
      
      // Log sell check result every 5 candles for debugging
      if (candles.length % 5 === 0) {
        console.log('[ReverseRatio] 💰 Sell check:', {
          shouldSell,
          hasPositions: this.state.positions.length > 0,
          totalBTC: totalPositionSize.toFixed(6),
          btcBalance: this.state.balance.btcPositions.toFixed(6),
          currentPrice: currentPrice.toFixed(2),
          initialEntry: this.initialEntryPrice.toFixed(2),
          profitTarget: config.profitTarget + '%'
        });
      }
      
      if (shouldSell) {
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
        
        console.log('[ReverseRatio] 🎉 GENERATING SELL SIGNAL!', {
          sellSize: sellSize.toFixed(6),
          currentPrice: currentPrice.toFixed(2),
          profitTarget: config.profitTarget + '%',
          reason: `Taking profit at ${config.profitTarget}% above initial entry`
        });
        
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
      
      // ALWAYS log for ultra-scalping to debug missing levels
      console.log('[ReverseRatio] 🎯 Level entry check:', {
        currentLevel: this.currentLevel,
        maxLevels: config.maxLevels,
        lastLevelPrice: lastLevelPrice.toFixed(2),
        currentPrice: currentPrice.toFixed(2),
        dropFromLastLevel: dropFromLastLevel.toFixed(4) + '%',
        requiredDrop: config.levelDropPercent + '%',
        needsMoreDrop: Math.max(0, config.levelDropPercent - dropFromLastLevel).toFixed(4) + '%',
        availableCapital: (this.state.balance.usd + this.state.balance.vault).toFixed(2),
        btcHeld: this.state.balance.btcPositions.toFixed(6),
        levelPrices: this.levelPrices.map(p => p.toFixed(2)),
        wouldTrigger: dropFromLastLevel >= config.levelDropPercent ? '✅ YES!' : '❌ Not yet'
      });
      
      if (dropFromLastLevel >= config.levelDropPercent) {
        this.currentLevel++;
        this.levelPrices.push(currentPrice);
        
        console.log('[ReverseRatio] LEVEL ENTRY TRIGGERED!', {
          level: this.currentLevel,
          dropFromLastLevel: dropFromLastLevel.toFixed(4) + '%',
          price: currentPrice,
          remainingCapital: (this.state.balance.usd + this.state.balance.vault).toFixed(2)
        });
        
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
    
    // Paper trading service now correctly passes total available balance (USD + vault)
    const totalAvailable = balance;
    
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
      // Fixed dollar amount mode - each level gets a specific dollar amount
      if (config.ratioMultiplier === 1) {
        // Linear progression: Each level adds the base amount
        // Example: $50, $100, $150, $200... (adds $50 each level)
        positionValue = config.basePositionAmount * level;
      } else {
        // Exponential progression: Each level multiplies by the ratio
        // Example with ratio 2: $50, $100, $200, $400... (doubles each level)
        // Formula: baseAmount * (multiplier^(level-1))
        const levelRatio = Math.pow(config.ratioMultiplier, level - 1);
        positionValue = config.basePositionAmount * levelRatio;
      }
    } else {
      // Percentage mode (default) - each level gets a percentage of initial balance
      const basePercent = config.basePositionPercent / 100;
      
      // CRITICAL: Use INITIAL balance for consistent sizing across all levels
      // This prevents position sizes from shrinking as capital is deployed
      // Ensures the strategy can complete all planned levels
      if (config.ratioMultiplier === 1) {
        // Grid mode: Each level gets equal percentage of initial capital
        // Example: 5% of $10k = $500 per level regardless of remaining balance
        positionValue = balance * basePercent;
        console.log('[ReverseRatio] GRID position sizing (equal):', {
          level,
          basePercent: (basePercent * 100).toFixed(1) + '%',
          positionValue: positionValue.toFixed(2),
          initialBalance: balance.toFixed(2)
        });
      } else {
        // Reverse ratio mode: Later levels get exponentially larger positions
        // This implements the core strategy: bigger bets at lower prices
        // Example with 5% base and 2x multiplier:
        // Level 1: 5% of balance
        // Level 2: 10% of balance (5% * 2^1)
        // Level 3: 20% of balance (5% * 2^2)
        const levelRatio = Math.pow(config.ratioMultiplier, level - 1);
        positionValue = balance * (basePercent * levelRatio);
        console.log('[ReverseRatio] PROGRESSIVE position sizing:', {
          level,
          basePercent: (basePercent * 100).toFixed(1) + '%',
          levelRatio: levelRatio.toFixed(2),
          positionValue: positionValue.toFixed(2),
          initialBalance: balance.toFixed(2)
        });
      }
    }
    
    // Risk management: Enforce maximum position limit to prevent overexposure
    // This ensures we don't put more than X% of initial capital into the market
    const totalPositionValue = this.getTotalPositionValue(currentPrice);
    const maxAllowed = balance * (config.maxPositionPercent / 100);
    if (totalPositionValue + positionValue > maxAllowed) {
      // Cap the position to stay within risk limits
      positionValue = Math.max(0, maxAllowed - totalPositionValue);
      console.log('[ReverseRatio] Position size limited by max percentage:', {
        originalValue: positionValue,
        limitedValue: positionValue,
        maxAllowed,
        totalPositionValue
      });
    }
    
    // Convert USD value to BTC size
    // This is the actual amount of Bitcoin we'll purchase
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
      
      // ULTRA MICRO SCALPING DEBUG: Log every check when we're close
      if (currentProfit >= config.profitTarget * 0.8) {  // When we're 80% of the way there
        console.log('[ReverseRatio] 🎯 CLOSE TO TARGET - Profit check:', {
          currentPrice: currentPrice.toFixed(2),
          initialEntry: this.initialEntryPrice.toFixed(2),
          targetPrice: targetPrice.toFixed(2),
          currentProfit: currentProfit.toFixed(4) + '%',
          targetProfit: config.profitTarget + '%',
          needsToRise: ((targetPrice - currentPrice) / currentPrice * 100).toFixed(4) + '%',
          distanceToTarget: (targetPrice - currentPrice).toFixed(2),
          wouldSell: currentPrice >= targetPrice ? '✅ YES!' : '❌ Not yet'
        });
      }
      
      // Wait for full profit target (which already accounts for fees)
      if (currentPrice >= targetPrice) {
        // Net fees after rebate: 0.35% maker + 0.75% taker - 25% rebate = 0.825% net
        const netFeesAfterRebate = 0.825;
        console.log('[ReverseRatio] 🚀 PROFIT TARGET REACHED! SELLING NOW!', {
          currentProfit: currentProfit.toFixed(4) + '%',
          targetProfit: config.profitTarget + '%',
          netProfitAfterFees: (currentProfit - netFeesAfterRebate).toFixed(4) + '%',
          feeBreakdown: '0.35% maker + 0.75% taker - 0.275% rebate = 0.825% net',
          currentPrice,
          targetPrice,
          initialEntry: this.initialEntryPrice,
          totalBTC: this.getTotalPositionSize().toFixed(6)
        });
        return true;
      }
      
      return false;
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
      // ULTRA SCALPING FIX: Don't wait for lookback period - trade immediately!
      if (this.recentHigh === 0 && candles.length > 0) {
        // Initialize to the first candle's high so we can start trading immediately
        this.recentHigh = candles[0].high;
        console.log(`[ReverseRatio] ULTRA MODE: Initialized to first candle high ${this.recentHigh.toFixed(2)} - ready to trade immediately!`);
      }
      
      // Now update based on all available candles (not just lookback period)
      const allHighs = candles.map(c => c.high);
      const absoluteHigh = Math.max(...allHighs, currentPrice);
      
      // For ultra-scalping, use a rolling window only after we have enough candles
      if (candles.length >= config.lookbackPeriod) {
        const lookback = config.lookbackPeriod;
        const startIndex = Math.max(0, candles.length - lookback);
        const recentCandles = candles.slice(startIndex);
        const lookbackHigh = Math.max(...recentCandles.map(c => c.high));
        
        // Use the lookback high for more responsive trading
        if (lookbackHigh > this.recentHigh || this.recentHigh === 0) {
          this.recentHigh = lookbackHigh;
          console.log(`[ReverseRatio] Updated to ${lookback}-candle high: ${this.recentHigh.toFixed(2)}`);
        }
      } else {
        // Not enough candles for lookback - use absolute high
        this.recentHigh = absoluteHigh;
        console.log(`[ReverseRatio] Using absolute high (only ${candles.length} candles): ${this.recentHigh.toFixed(2)}`);
      }
      
      // Always update if current price is a new high
      if (currentPrice > this.recentHigh) {
        this.recentHigh = currentPrice;
        console.log(`[ReverseRatio] New absolute high: ${this.recentHigh.toFixed(2)}`);
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