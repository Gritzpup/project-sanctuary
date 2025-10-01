import { Strategy } from '../base/Strategy';
import type { CandleData, Position, Signal } from '../base/StrategyTypes';
import type { ReverseRatioConfig, ReverseRatioState } from './reverse-ratio/types';
import { MarketAnalyzer } from './reverse-ratio/MarketAnalyzer';
import { EntryLogic } from './reverse-ratio/EntryLogic';
import { ExitLogic } from './reverse-ratio/ExitLogic';
import { PositionSizer } from './reverse-ratio/PositionSizer';
import { StateManager } from './reverse-ratio/StateManager';

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
export class ReverseRatioStrategy extends Strategy {
  private config: ReverseRatioConfig;
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

    this.config = fullConfig;
    
    // Initialize internal state
    this.internalState = {
      recentHigh: 0,
      initialEntryPrice: 0,
      currentLevel: 0,
      levelPrices: [],
      levelSizes: []
    };

    // Initialize modular components
    this.marketAnalyzer = new MarketAnalyzer(this.config, this.internalState);
    this.entryLogic = new EntryLogic(this.config, this.internalState);
    this.exitLogic = new ExitLogic(this.config, this.internalState);
    this.positionSizer = new PositionSizer(this.config, this.internalState);
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
      
      // Log sell check result every 5 candles for debugging
      if (candles.length % 5 === 0) {
        console.log('[ReverseRatio] 💰 Sell check:', {
          shouldSell,
          hasPositions: this.state.positions.length > 0,
          totalBTC: totalPositionSize.toFixed(6),
          btcBalance: this.state.balance.btcPositions.toFixed(6),
          currentPrice: currentPrice.toFixed(2),
          initialEntry: this.internalState.initialEntryPrice.toFixed(2),
          profitTarget: this.config.profitTarget + '%'
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
          profitTarget: this.config.profitTarget + '%',
          reason: `Taking profit at ${this.config.profitTarget}% above initial entry`
        });
        
        // This is a complete exit - we're selling all positions
        return {
          type: 'sell' as const,
          strength: 1.0,
          price: currentPrice,
          size: sellSize,
          reason: `Taking profit at ${this.config.profitTarget}% above initial entry`,
          metadata: {
            targetPrice: this.internalState.initialEntryPrice * (1 + this.config.profitTarget / 100),
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
    return this.config.lookbackPeriod + 10; // Extra buffer
  }

  reset(): void {
    this.stateManager.reset();
    this.state.positions = [];
  }
}