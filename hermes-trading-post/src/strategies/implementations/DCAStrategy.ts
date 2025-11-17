import { Strategy } from '../base/Strategy';
import type { CandleData, Position, Signal, StrategyConfig } from '../base/StrategyTypes';

export interface DCAConfig extends StrategyConfig {
  intervalHours: number;        // Hours between purchases (default: 24)
  amountPerInterval: number;    // % of balance per interval (default: 5)
  buyOnDips: boolean;          // Buy extra on dips (default: true)
  dipThreshold: number;        // % dip to trigger extra buy (default: 5)
  dipMultiplier: number;       // Multiplier for dip buys (default: 2)
  takeProfitEnabled: boolean;  // Enable profit taking (default: true)
  profitTarget: number;        // % profit to take (default: 20)
  profitTakePercent: number;   // % of position to sell (default: 50)
}

export class DCAStrategy extends Strategy {
  private lastBuyTime: number = 0;
  private averageCost: number = 0;
  private totalInvested: number = 0;
  private recentHigh: number = 0;

  constructor(config: Partial<DCAConfig> = {}) {
    const fullConfig: DCAConfig = {
      vaultAllocation: 80,
      btcGrowthAllocation: 20,
      intervalHours: 24,
      amountPerInterval: 5,
      buyOnDips: true,
      dipThreshold: 5,
      dipMultiplier: 2,
      takeProfitEnabled: true,
      profitTarget: 20,
      profitTakePercent: 50,
      ...config
    };

    super(
      'Dollar Cost Averaging',
      'Systematic accumulation with optional dip buying and profit taking',
      fullConfig
    );
  }

  analyze(candles: CandleData[], currentPrice: number): Signal {
    const config = this.config as DCAConfig;
    const currentTime = candles[candles.length - 1].time;
    
    // Update recent high for dip detection
    this.updateRecentHigh(candles);

    // Check for profit taking opportunity
    if (config.takeProfitEnabled && this.state.positions.length > 0) {
      const profitPercent = ((currentPrice - this.averageCost) / this.averageCost) * 100;
      
      if (profitPercent >= config.profitTarget) {
        const sellSize = this.getTotalPositionSize() * (config.profitTakePercent / 100);
        
        return {
          type: 'sell',
          strength: 0.8,
          price: currentPrice,
          size: sellSize,
          reason: `Taking ${config.profitTakePercent}% profit at ${profitPercent.toFixed(2)}% gain`,
          metadata: {
            profitPercent,
            averageCost: this.averageCost
          }
        };
      }
    }

    // Check for dip buying opportunity
    if (config.buyOnDips && this.recentHigh > 0) {
      const dipPercent = ((this.recentHigh - currentPrice) / this.recentHigh) * 100;
      
      if (dipPercent >= config.dipThreshold) {
        return {
          type: 'buy',
          strength: 0.9,
          price: currentPrice,
          reason: `Dip buy - ${dipPercent.toFixed(2)}% drop from recent high`,
          metadata: {
            isDipBuy: true,
            dipPercent,
            recentHigh: this.recentHigh
          }
        };
      }
    }

    // Check for regular interval buy
    const hoursSinceLastBuy = (currentTime - this.lastBuyTime) / 3600;
    
    if (this.lastBuyTime === 0 || hoursSinceLastBuy >= config.intervalHours) {
      // Don't update lastBuyTime here - wait for onOrderFilled
      
      return {
        type: 'buy',
        strength: 0.7,
        price: currentPrice,
        reason: `Regular DCA purchase - ${config.intervalHours}h interval`,
        metadata: {
          isDipBuy: false,
          intervalHours: config.intervalHours,
          scheduledTime: currentTime
        }
      };
    }

    const hoursUntilNext = config.intervalHours - hoursSinceLastBuy;
    
    return {
      type: 'hold',
      strength: 0,
      price: currentPrice,
      reason: `Next DCA purchase in ${hoursUntilNext.toFixed(1)} hours`
    };
  }

  calculatePositionSize(balance: number, signal: Signal, currentPrice: number): number {
    const config = this.config as DCAConfig;
    
    if (signal.type === 'buy') {
      let allocation = (config.amountPerInterval / 100) * balance;
      
      // Apply dip multiplier if this is a dip buy
      if (signal.metadata?.isDipBuy) {
        allocation *= config.dipMultiplier;
      }
      
      const size = allocation / currentPrice;
      
      // Update average cost tracking
      this.updateAverageCost(currentPrice, size);
      
      return size;
    }
    
    return 0;
  }

  shouldTakeProfit(position: Position, currentPrice: number): boolean {
    // Handled in analyze method
    return false;
  }

  shouldStopLoss(position: Position, currentPrice: number): boolean {
    // No stop loss in DCA strategy
    return false;
  }

  getRequiredHistoricalData(): number {
    return 30; // Need some history for dip detection
  }

  // Override addPosition to track when buy orders are actually filled
  addPosition(position: Position): void {
    super.addPosition(position);
    
    // Update lastBuyTime when a regular DCA buy is executed
    if (position.metadata?.scheduledTime && !position.metadata?.isDipBuy) {
      this.lastBuyTime = position.metadata.scheduledTime;
    }
    
    // Update average cost
    this.updateAverageCost(position.entryPrice, position.size);
  }

  // Helper methods
  private updateRecentHigh(candles: CandleData[]): void {
    const lookback = Math.min(30, candles.length);
    const recentCandles = candles.slice(-lookback);
    this.recentHigh = Math.max(...recentCandles.map(c => c.high));
  }

  private updateAverageCost(price: number, size: number): void {
    const newInvestment = price * size;
    const totalSize = this.getTotalPositionSize() + size;
    
    this.totalInvested += newInvestment;
    this.averageCost = totalSize > 0 ? this.totalInvested / totalSize : price;
  }

  // Get statistics for the strategy
  getStatistics(): {
    averageCost: number;
    totalInvested: number;
    currentValue: number;
    unrealizedPnL: number;
    unrealizedPnLPercent: number;
    totalBuys: number;
    dipBuys: number;
  } {
    const totalSize = this.getTotalPositionSize();
    const currentPrice = this.state.lastSignal?.price || 0;
    const currentValue = totalSize * currentPrice;
    const unrealizedPnL = currentValue - this.totalInvested;
    const unrealizedPnLPercent = this.totalInvested > 0 ? (unrealizedPnL / this.totalInvested) * 100 : 0;
    
    const totalBuys = this.state.positions.length;
    const dipBuys = this.state.positions.filter(p => p.metadata?.isDipBuy).length;
    
    return {
      averageCost: this.averageCost,
      totalInvested: this.totalInvested,
      currentValue,
      unrealizedPnL,
      unrealizedPnLPercent,
      totalBuys,
      dipBuys
    };
  }

  reset(): void {
    this.lastBuyTime = 0;
    this.averageCost = 0;
    this.totalInvested = 0;
    this.recentHigh = 0;
    this.state.positions = [];
  }
}