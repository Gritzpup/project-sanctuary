import type { Position } from '../../base/StrategyTypes';
import type { ReverseRatioConfig, ReverseRatioState } from './types';

/**
 * Handles exit logic for the Reverse Descending Grid Strategy
 * Determines when to take profits and exit positions
 */
export class ExitLogic {
  private config: ReverseRatioConfig;
  private state: ReverseRatioState;

  constructor(config: ReverseRatioConfig, state: ReverseRatioState) {
    this.config = config;
    this.state = state;
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

    // Wait for full profit target (which already accounts for fees)
    if (currentPrice >= targetPrice) {
      // Net fees after rebate: 0.35% maker + 0.75% taker - 25% rebate = 0.825% net
      const netFeesAfterRebate = 0.825;
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

    // Profit progress monitoring removed
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