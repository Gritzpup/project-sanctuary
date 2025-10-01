import type { Position } from '../../base/StrategyTypes';
import type { ScalpingState, StrategyVariant } from './types';

/**
 * Manages internal state for scalping strategies
 * Handles state resets and synchronization
 */
export class StateManager {
  private state: ScalpingState;
  private variant: StrategyVariant;

  constructor(state: ScalpingState, variant: StrategyVariant = 'reverse-ratio') {
    this.state = state;
    this.variant = variant;
  }

  /**
   * Reset only the cycle-specific state (called after complete exit)
   */
  resetCycle(): void {
    this.state.initialEntryPrice = 0;
    this.state.currentLevel = 0;
    this.state.levelPrices = [];
    this.state.levelSizes = [];
    // Reset recent high to allow finding new opportunities after a complete cycle
    this.state.recentHigh = 0;
    console.log(`[StateManager:${this.variant}] Cycle reset - will find new recent high for next trade`);
  }
  
  /**
   * Full reset (called at strategy initialization)
   */
  reset(): void {
    this.state.recentHigh = 0;
    this.state.initialEntryPrice = 0;
    this.state.currentLevel = 0;
    this.state.levelPrices = [];
    this.state.levelSizes = [];
    console.log(`[StateManager:${this.variant}] Full state reset`);
  }

  /**
   * Check if we need to reset after a complete exit
   */
  checkForReset(positions: Position[], candles: any[]): boolean {
    if (positions.length === 0 && this.state.initialEntryPrice > 0) {
      console.log(`[StateManager:${this.variant}] Resetting strategy state after complete exit`, {
        date: new Date(candles[candles.length - 1].time * 1000).toISOString(),
        lastInitialEntry: this.state.initialEntryPrice,
        lastRecentHigh: this.state.recentHigh
      });
      this.resetCycle();
      return true;
    }
    return false;
  }

  /**
   * Fix sync issues - if we have positions tracked but no actual BTC, clear positions
   */
  checkSyncIssues(positions: Position[], btcBalance: number): boolean {
    if (positions.length > 0 && btcBalance <= 0.0000001) {
      console.log(`[StateManager:${this.variant}] SYNC FIX: Clearing phantom positions - btcPositions is 0 but strategy tracks positions`);
      this.resetCycle();
      return true;
    }
    return false;
  }

  /**
   * Get current state snapshot
   */
  getState(): Readonly<ScalpingState> {
    return { ...this.state };
  }

  /**
   * Check if we have any active positions
   */
  hasPositions(): boolean {
    return this.state.currentLevel > 0 && this.state.initialEntryPrice > 0;
  }

  /**
   * Get total position size across all levels
   */
  getTotalPositionSize(positions: Position[]): number {
    return positions.reduce((sum, pos) => sum + pos.size, 0);
  }

  /**
   * Get total position value at current price
   */
  getTotalPositionValue(positions: Position[], currentPrice: number): number {
    return positions.reduce((sum, pos) => sum + (pos.size * currentPrice), 0);
  }

  /**
   * Log debug information about current state
   */
  logDebugInfo(candles: any[], currentPrice: number, balance: any, positions: Position[]): void {
    // Debug log every 100 candles
    if (candles.length % 100 === 0) {
      console.log(`[StateManager:${this.variant}] State debug - Candle #${candles.length}`, {
        currentPrice,
        date: new Date(candles[candles.length - 1].time * 1000).toISOString(),
        balance: balance.balance,
        positions: positions.length,
        initialEntry: this.state.initialEntryPrice,
        currentLevel: this.state.currentLevel,
        recentHigh: this.state.recentHigh,
        levelPrices: this.state.levelPrices.map(p => p.toFixed(2))
      });
    }
  }
}