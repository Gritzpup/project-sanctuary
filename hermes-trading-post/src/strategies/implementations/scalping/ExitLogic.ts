import type { Position } from '../../base/StrategyTypes';
import type { ScalpingConfig, ScalpingState, StrategyVariant } from './types';

/**
 * Handles exit logic for scalping strategies
 * Determines when to take profits and exit positions
 */
export class ExitLogic {
  private config: ScalpingConfig;
  private state: ScalpingState;
  private variant: StrategyVariant;

  constructor(config: ScalpingConfig, state: ScalpingState, variant: StrategyVariant = 'reverse-ratio') {
    this.config = config;
    this.state = state;
    this.variant = variant;
  }

  /**
   * Check if we should take profit on our positions
   */
  shouldTakeProfit(positions: Position[], currentPrice: number): boolean {
    if (positions.length === 0 || this.state.initialEntryPrice === 0) {
      return false;
    }

    const targetPrice = this.state.initialEntryPrice * (1 + (this.config.profitTarget / 100));
    const currentProfit = ((currentPrice - this.state.initialEntryPrice) / this.state.initialEntryPrice) * 100;
    
    // Log every check when we're close for ultra-scalping strategies
    if (currentProfit >= this.config.profitTarget * 0.8) {  // When we're 80% of the way there
      console.log(`[ExitLogic:${this.variant}] 🎯 CLOSE TO TARGET - Profit check:`, {
        currentPrice: currentPrice.toFixed(2),
        initialEntry: this.state.initialEntryPrice.toFixed(2),
        targetPrice: targetPrice.toFixed(2),
        currentProfit: currentProfit.toFixed(4) + '%',
        targetProfit: this.config.profitTarget + '%',
        needsToRise: ((targetPrice - currentPrice) / currentPrice * 100).toFixed(4) + '%',
        distanceToTarget: (targetPrice - currentPrice).toFixed(2),
        wouldSell: currentPrice >= targetPrice ? '✅ YES!' : '❌ Not yet'
      });
    }
    
    // Wait for full profit target (which already accounts for fees)
    if (currentPrice >= targetPrice) {
      // Different fee structures for different strategies
      const netFeesAfterRebate = this.variant === 'ultra-micro' ? 0.3 : 0.825;
      
      console.log(`[ExitLogic:${this.variant}] 🚀 PROFIT TARGET REACHED! SELLING NOW!`, {
        currentProfit: currentProfit.toFixed(4) + '%',
        targetProfit: this.config.profitTarget + '%',
        netProfitAfterFees: (currentProfit - netFeesAfterRebate).toFixed(4) + '%',
        currentPrice,
        targetPrice,
        initialEntry: this.state.initialEntryPrice
      });
      return true;
    }
    
    return false;
  }

  /**
   * Never use stop losses for deflationary assets
   */
  shouldStopLoss(position: Position, currentPrice: number): boolean {
    // Never sell at a loss for deflationary assets
    return false;
  }

  /**
   * Log position status for monitoring
   */
  logPositionStatus(positions: Position[], currentPrice: number, candles: any[]): void {
    if (positions.length === 0) return;

    // Log profit progress every 10 candles when we have positions
    if (candles.length % 10 === 0) {
      const targetPrice = this.state.initialEntryPrice * (1 + (this.config.profitTarget / 100));
      const currentProfit = ((currentPrice - this.state.initialEntryPrice) / this.state.initialEntryPrice) * 100;
      const totalPositionSize = positions.reduce((sum, p) => sum + p.size, 0);
      const totalPositionValue = totalPositionSize * currentPrice;
      const totalInvested = positions.reduce((sum, p) => sum + (p.size * p.entryPrice), 0);
      const unrealizedPnL = totalPositionValue - totalInvested;
      
      console.log(`[ExitLogic:${this.variant}] 📊 Position Status (every 10 candles):`, {
        configProfitTarget: this.config.profitTarget + '%',
        positions: positions.length,
        totalBTC: totalPositionSize.toFixed(6),
        totalInvested: totalInvested.toFixed(2),
        currentValue: totalPositionValue.toFixed(2),
        unrealizedPnL: unrealizedPnL.toFixed(2),
        initialEntry: this.state.initialEntryPrice.toFixed(2),
        currentPrice: currentPrice.toFixed(2),
        targetPrice: targetPrice.toFixed(2),
        currentProfit: currentProfit.toFixed(4) + '%',
        needsToReach: ((targetPrice - currentPrice) / currentPrice * 100).toFixed(4) + '%',
        progressToTarget: ((currentProfit / this.config.profitTarget) * 100).toFixed(1) + '%'
      });
    }
  }

  /**
   * Calculate average entry price across all positions
   */
  getAverageEntryPrice(positions: Position[]): number {
    if (positions.length === 0) return 0;
    
    let totalValue = 0;
    let totalSize = 0;
    
    for (const position of positions) {
      totalValue += position.entryPrice * position.size;
      totalSize += position.size;
    }
    
    return totalSize > 0 ? totalValue / totalSize : 0;
  }
}