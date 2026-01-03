import { Strategy } from '../base/Strategy';
import type { CandleData, Position, Signal } from '../base/StrategyTypes';
import type { ReverseRatioConfig, ReverseRatioState } from './reverse-descending-grid/types';
import { MarketAnalyzer } from './reverse-descending-grid/MarketAnalyzer';
import { EntryLogic } from './reverse-descending-grid/EntryLogic';
import { ExitLogic } from './reverse-descending-grid/ExitLogic';
import { PositionSizer } from './reverse-descending-grid/PositionSizer';
import { StateManager } from './reverse-descending-grid/StateManager';

/**
 * TEST STRATEGY - High Frequency Trading
 *
 * Based on analysis of 2 months of BTC data (Oct-Dec 2025):
 * - Average hourly drop: 0.372%
 * - 72.6% of drops exceed 0.1%
 * - Average hourly recovery: 0.357%
 *
 * Key Features:
 * - Lower entry threshold: 0.05% drops trigger buys (vs 0.1% for ReverseRatio)
 * - Tighter profit target: 0.3% (vs 0.85% for ReverseRatio)
 * - More levels: up to 15 levels for more frequent entries
 * - Expected trades: ~10 entries/day, ~5 exits/day (5x more frequent than ReverseRatio)
 *
 * Trade Frequency Analysis:
 * - ReverseRatio: ~8.4 entries/day, ~1.1 exits/day
 * - Test Strategy: ~10.2 entries/day, ~5.0 exits/day
 */
export class TestStrategy extends Strategy {
  protected testConfig: ReverseRatioConfig;
  private internalState: ReverseRatioState;

  // Modular components
  private marketAnalyzer: MarketAnalyzer;
  private entryLogic: EntryLogic;
  private exitLogic: ExitLogic;
  private positionSizer: PositionSizer;
  private stateManager: StateManager;

  constructor(config: Partial<ReverseRatioConfig> = {}) {
    const fullConfig: ReverseRatioConfig = {
      vaultAllocation: 85.7,     // 6/7 of profit goes to vault
      btcGrowthAllocation: 14.3, // 1/7 of profit goes to BTC growth
      initialDropPercent: 0.05,  // TEST: 0.05% drop triggers entry (more sensitive)
      levelDropPercent: 0.05,    // TEST: 0.05% between levels (tighter spacing)
      ratioMultiplier: 2,
      profitTarget: 0.3,         // TEST: 0.3% profit target (faster exits)
      maxLevels: 15,             // TEST: up to 15 levels for more entries
      lookbackPeriod: 20,        // Shorter lookback for faster reaction
      positionSizeMode: 'percentage',
      basePositionPercent: 4,    // Smaller initial position (4% vs 6%)
      basePositionAmount: 40,    // $40 for first level if using fixed mode
      maxPositionPercent: 80,    // Max 80% of balance across all levels
      ...config
    };

    super(
      'Test Strategy',
      `High-frequency trading: ${fullConfig.initialDropPercent}% entry, ${fullConfig.profitTarget}% profit target`,
      fullConfig
    );

    this.testConfig = fullConfig;

    // Initialize internal state
    this.internalState = {
      recentHigh: 0,
      initialEntryPrice: 0,
      currentLevel: 0,
      levelPrices: [],
      levelSizes: []
    };

    // Initialize modular components
    this.marketAnalyzer = new MarketAnalyzer(this.testConfig, this.internalState);
    this.entryLogic = new EntryLogic(this.testConfig, this.internalState);
    this.exitLogic = new ExitLogic(this.testConfig, this.internalState);
    this.positionSizer = new PositionSizer(this.testConfig, this.internalState);
    this.stateManager = new StateManager(this.internalState);
  }

  analyze(candles: CandleData[], currentPrice: number): Signal {
    // Log debug information periodically
    this.stateManager.logDebugInfo(candles, currentPrice, this.state, this.state.positions);

    // Check if we need to reset after a complete exit
    this.stateManager.checkForReset(this.state.positions, candles);

    // Fix sync issues - if we have positions tracked but no actual BTC, clear positions
    if (this.stateManager.checkSyncIssues(this.state.positions, this.state.balance.btcPositions)) {
      this.state.positions = [];
    }

    // Update recent high - track the highest price we've seen
    this.marketAnalyzer.updateRecentHigh(candles, currentPrice);

    // Check if we should take profit
    const totalPositionSize = this.stateManager.getTotalPositionSize(this.state.positions);

    // Log position status for monitoring
    this.exitLogic.logPositionStatus(this.state.positions, currentPrice, candles);

    if (this.state.positions.length > 0 && totalPositionSize > 0) {
      const shouldSell = this.exitLogic.shouldTakeProfit(this.state.positions, currentPrice);

      if (shouldSell) {
        // Double check we have BTC to sell
        if (this.state.balance.btcPositions <= 0) {
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
        return {
          type: 'sell' as const,
          strength: 1.0,
          price: currentPrice,
          size: sellSize,
          reason: `Taking profit at ${this.testConfig.profitTarget}% above initial entry`,
          metadata: {
            targetPrice: this.internalState.initialEntryPrice * (1 + this.testConfig.profitTarget / 100),
            totalProfit: (currentPrice - this.exitLogic.getAverageEntryPrice(this.state.positions)) * sellSize,
            isCompleteExit: true
          }
        };
      }
    }

    // Analyze market conditions
    const marketAnalysis = this.marketAnalyzer.analyzeMarket(currentPrice, this.state.positions.length > 0);

    // Log market status for debugging
    this.marketAnalyzer.logMarketStatus(candles, currentPrice, this.state.balance.vault + this.state.balance.usd);

    // Check for initial entry
    const initialEntrySignal = this.entryLogic.checkInitialEntry(marketAnalysis, currentPrice);
    if (initialEntrySignal) {
      return initialEntrySignal;
    }

    // Check for level entry
    const levelEntrySignal = this.entryLogic.checkLevelEntry(marketAnalysis, currentPrice);
    if (levelEntrySignal) {
      return levelEntrySignal;
    }

    return {
      type: 'hold',
      strength: 0,
      price: currentPrice,
      reason: 'No entry or exit conditions met'
    };
  }

  calculatePositionSize(balance: number, signal: Signal, currentPrice: number): number {
    return this.positionSizer.calculatePositionSize(balance, signal, currentPrice, this.state.balance);
  }

  shouldTakeProfit(position: Position, currentPrice: number): boolean {
    return this.exitLogic.shouldTakeProfit(this.state.positions, currentPrice);
  }

  shouldStopLoss(position: Position, currentPrice: number): boolean {
    return this.exitLogic.shouldStopLoss(position, currentPrice);
  }

  getRequiredHistoricalData(): number {
    return this.testConfig.lookbackPeriod + 10; // Extra buffer
  }

  reset(): void {
    this.stateManager.reset();
    this.state.positions = [];
  }
}
