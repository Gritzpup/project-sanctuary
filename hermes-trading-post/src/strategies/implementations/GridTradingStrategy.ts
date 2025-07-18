import { Strategy } from '../base/Strategy';
import { CandleData, Position, Signal, StrategyConfig } from '../base/StrategyTypes';

export interface GridConfig extends StrategyConfig {
  gridLevels: number;           // Number of grid levels (default: 10)
  gridSpacing: number;          // % spacing between levels (default: 2)
  positionSizePerGrid: number;  // % of balance per grid (default: 10)
  upperBound?: number;          // Upper price bound (optional)
  lowerBound?: number;          // Lower price bound (optional)
  autoAdjustBounds: boolean;    // Auto-adjust bounds based on volatility (default: true)
}

export class GridTradingStrategy extends Strategy {
  private gridLevels: Map<number, { price: number; hasPosition: boolean }> = new Map();
  private lastProcessedPrice: number = 0;

  constructor(config: Partial<GridConfig> = {}) {
    const fullConfig: GridConfig = {
      vaultAllocation: 95,
      btcGrowthAllocation: 5,
      gridLevels: 10,
      gridSpacing: 2,
      positionSizePerGrid: 10,
      autoAdjustBounds: true,
      ...config
    };

    super(
      'Grid Trading',
      'Places buy and sell orders at regular price intervals to profit from volatility',
      fullConfig
    );
  }

  analyze(candles: CandleData[], currentPrice: number): Signal {
    const config = this.config as GridConfig;
    
    // Initialize or update grid if needed
    if (this.gridLevels.size === 0 || config.autoAdjustBounds) {
      this.initializeGrid(candles, currentPrice);
    }

    // Find nearest grid levels
    const nearestLevels = this.findNearestGridLevels(currentPrice);
    
    if (!nearestLevels) {
      return {
        type: 'hold',
        strength: 0,
        price: currentPrice,
        reason: 'Price outside grid bounds'
      };
    }

    const { above, below } = nearestLevels;
    
    // Check if we crossed a grid level
    if (this.lastProcessedPrice > 0) {
      // Price moved down, crossed a buy level
      if (this.lastProcessedPrice > below.price && currentPrice <= below.price && !below.hasPosition) {
        this.lastProcessedPrice = currentPrice;
        return {
          type: 'buy',
          strength: 0.8,
          price: currentPrice,
          reason: `Grid buy at level ${below.price.toFixed(2)}`,
          metadata: {
            gridLevel: below.price,
            gridIndex: Array.from(this.gridLevels.keys()).indexOf(below.price)
          }
        };
      }
      
      // Price moved up, crossed a sell level
      if (this.lastProcessedPrice < above.price && currentPrice >= above.price && above.hasPosition) {
        this.lastProcessedPrice = currentPrice;
        return {
          type: 'sell',
          strength: 0.8,
          price: currentPrice,
          reason: `Grid sell at level ${above.price.toFixed(2)}`,
          metadata: {
            gridLevel: above.price,
            gridIndex: Array.from(this.gridLevels.keys()).indexOf(above.price)
          }
        };
      }
    }

    this.lastProcessedPrice = currentPrice;
    
    return {
      type: 'hold',
      strength: 0,
      price: currentPrice,
      reason: 'No grid levels crossed'
    };
  }

  calculatePositionSize(balance: number, signal: Signal, currentPrice: number): number {
    const config = this.config as GridConfig;
    
    if (signal.type === 'buy') {
      // Calculate size based on percentage of balance
      const allocation = (config.positionSizePerGrid / 100) * balance;
      return allocation / currentPrice;
    }
    
    if (signal.type === 'sell' && signal.metadata?.gridLevel) {
      // Find the position size for this grid level
      const gridLevel = signal.metadata.gridLevel;
      const position = this.state.positions.find(p => 
        Math.abs(p.entryPrice - gridLevel) < gridLevel * 0.001 // 0.1% tolerance
      );
      return position ? position.size : 0;
    }
    
    return 0;
  }

  shouldTakeProfit(position: Position, currentPrice: number): boolean {
    // Grid trading handles profit taking through grid sells
    return false;
  }

  shouldStopLoss(position: Position, currentPrice: number): boolean {
    // No stop loss in grid trading
    return false;
  }

  getRequiredHistoricalData(): number {
    return 100; // Need data for volatility calculation
  }

  // Helper methods
  private initializeGrid(candles: CandleData[], currentPrice: number): void {
    const config = this.config as GridConfig;
    this.gridLevels.clear();
    
    let upperBound = config.upperBound;
    let lowerBound = config.lowerBound;
    
    // Auto-adjust bounds based on recent volatility
    if (config.autoAdjustBounds || !upperBound || !lowerBound) {
      const volatility = this.calculateVolatility(candles);
      const range = currentPrice * volatility * 2; // 2 standard deviations
      upperBound = upperBound || currentPrice + range / 2;
      lowerBound = lowerBound || currentPrice - range / 2;
    }
    
    // Create grid levels
    const priceRange = upperBound - lowerBound;
    const levelSpacing = priceRange / (config.gridLevels - 1);
    
    for (let i = 0; i < config.gridLevels; i++) {
      const price = lowerBound + (i * levelSpacing);
      this.gridLevels.set(price, {
        price,
        hasPosition: price < currentPrice // Buy levels below current price
      });
    }
  }

  private findNearestGridLevels(currentPrice: number): { above: any; below: any } | null {
    const levels = Array.from(this.gridLevels.entries())
      .map(([price, data]) => ({ price, ...data }))
      .sort((a, b) => a.price - b.price);
    
    let above = null;
    let below = null;
    
    for (let i = 0; i < levels.length; i++) {
      if (levels[i].price <= currentPrice) {
        below = levels[i];
      }
      if (levels[i].price > currentPrice && !above) {
        above = levels[i];
        break;
      }
    }
    
    return above && below ? { above, below } : null;
  }

  private calculateVolatility(candles: CandleData[]): number {
    if (candles.length < 20) return 0.02; // Default 2% volatility
    
    const returns = [];
    for (let i = 1; i < candles.length; i++) {
      const returnPct = (candles[i].close - candles[i-1].close) / candles[i-1].close;
      returns.push(returnPct);
    }
    
    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    return Math.sqrt(variance);
  }

  // Update grid level status after trade
  updateGridAfterTrade(price: number, isBuy: boolean): void {
    for (const [levelPrice, data] of this.gridLevels.entries()) {
      if (Math.abs(levelPrice - price) < price * 0.001) { // 0.1% tolerance
        data.hasPosition = isBuy;
        break;
      }
    }
  }

  reset(): void {
    this.gridLevels.clear();
    this.lastProcessedPrice = 0;
    this.state.positions = [];
  }
}