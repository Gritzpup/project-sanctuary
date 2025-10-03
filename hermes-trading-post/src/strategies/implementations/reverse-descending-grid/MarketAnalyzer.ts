import type { CandleData } from '../../base/StrategyTypes';
import type { ReverseRatioConfig, ReverseRatioState, MarketAnalysis } from './types';

/**
 * Handles market analysis for the Reverse Descending Grid Strategy
 * Responsible for tracking recent highs and analyzing market conditions
 */
export class MarketAnalyzer {
  private config: ReverseRatioConfig;
  private state: ReverseRatioState;

  constructor(config: ReverseRatioConfig, state: ReverseRatioState) {
    this.config = config;
    this.state = state;
  }

  /**
   * Update the recent high based on market data
   */
  updateRecentHigh(candles: CandleData[], currentPrice: number): void {
    // If we have no positions, track the rolling high from recent candles
    if (this.state.currentLevel === 0) {
      // ULTRA SCALPING FIX: Don't wait for lookback period - trade immediately!
      if (this.state.recentHigh === 0 && candles.length > 0) {
        // Initialize to the first candle's high so we can start trading immediately
        this.state.recentHigh = candles[0].high;
        console.log(`[MarketAnalyzer] ULTRA MODE: Initialized to first candle high ${this.state.recentHigh.toFixed(2)} - ready to trade immediately!`);
      }
      
      // Now update based on all available candles (not just lookback period)
      const allHighs = candles.map(c => c.high);
      const absoluteHigh = Math.max(...allHighs, currentPrice);
      
      // For ultra-scalping, use a rolling window only after we have enough candles
      if (candles.length >= this.config.lookbackPeriod) {
        const lookback = this.config.lookbackPeriod;
        const startIndex = Math.max(0, candles.length - lookback);
        const recentCandles = candles.slice(startIndex);
        const lookbackHigh = Math.max(...recentCandles.map(c => c.high));
        
        // Use the lookback high for more responsive trading
        if (lookbackHigh > this.state.recentHigh || this.state.recentHigh === 0) {
          this.state.recentHigh = lookbackHigh;
          console.log(`[MarketAnalyzer] Updated to ${lookback}-candle high: ${this.state.recentHigh.toFixed(2)}`);
        }
      } else {
        // Not enough candles for lookback - use absolute high
        this.state.recentHigh = absoluteHigh;
        console.log(`[MarketAnalyzer] Using absolute high (only ${candles.length} candles): ${this.state.recentHigh.toFixed(2)}`);
      }
      
      // Always update if current price is a new high
      if (currentPrice > this.state.recentHigh) {
        this.state.recentHigh = currentPrice;
        console.log(`[MarketAnalyzer] New absolute high: ${this.state.recentHigh.toFixed(2)}`);
      }
    } else {
      // When in a position, only update if we see a new high
      if (currentPrice > this.state.recentHigh) {
        this.state.recentHigh = currentPrice;
        console.log(`[MarketAnalyzer] New high while in position: ${this.state.recentHigh.toFixed(2)}`);
      }
    }
  }

  /**
   * Analyze current market conditions
   */
  analyzeMarket(currentPrice: number, hasPositions: boolean): MarketAnalysis {
    const dropFromHigh = ((this.state.recentHigh - currentPrice) / this.state.recentHigh) * 100;
    
    // Check initial entry conditions
    const canTriggerInitialEntry = !hasPositions && dropFromHigh >= this.config.initialDropPercent;
    
    // Check level entry conditions
    let canTriggerLevelEntry = false;
    let dropFromLastLevel: number | undefined;
    let lastLevelPrice: number | undefined;
    
    if (hasPositions && this.state.currentLevel < this.config.maxLevels && this.state.levelPrices.length > 0) {
      lastLevelPrice = this.state.levelPrices[this.state.levelPrices.length - 1];
      dropFromLastLevel = ((lastLevelPrice - currentPrice) / lastLevelPrice) * 100;
      canTriggerLevelEntry = dropFromLastLevel >= this.config.levelDropPercent;
    }

    return {
      recentHigh: this.state.recentHigh,
      dropFromHigh,
      canTriggerInitialEntry,
      canTriggerLevelEntry,
      dropFromLastLevel,
      lastLevelPrice
    };
  }

  /**
   * Log market status for debugging
   */
  logMarketStatus(candles: CandleData[], currentPrice: number, availableBalance: number): void {
    const dropFromHigh = ((this.state.recentHigh - currentPrice) / this.state.recentHigh) * 100;
    
    // Debug logging for significant drops or periodic updates
    if (candles.length <= 50 || dropFromHigh >= 3 || candles.length % 250 === 0) {
      console.log('[MarketAnalyzer] Market status:', {
        candleCount: candles.length,
        date: new Date(candles[candles.length - 1].time * 1000).toISOString(),
        currentPrice,
        recentHigh: this.state.recentHigh,
        dropFromHigh: dropFromHigh.toFixed(2) + '%',
        hasPositions: this.state.currentLevel > 0,
        initialDropThreshold: this.config.initialDropPercent + '%',
        availableBalance: availableBalance.toFixed(2),
        needsDrop: (this.config.initialDropPercent - dropFromHigh).toFixed(2) + '% more',
        currentLevel: this.state.currentLevel,
        initialEntry: this.state.initialEntryPrice
      });
    }
  }
}