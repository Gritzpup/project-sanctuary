import { Strategy } from '../base/Strategy';
import type { CandleData, Position, Signal } from '../base/StrategyTypes';
import type { ScalpingConfig, ScalpingState } from './scalping/types';
import { MarketAnalyzer } from './scalping/MarketAnalyzer';
import { EntryLogic } from './scalping/EntryLogic';
import { ExitLogic } from './scalping/ExitLogic';
import { PositionSizer } from './scalping/PositionSizer';
import { StateManager } from './scalping/StateManager';

/**
 * ULTRA MICRO SCALPING STRATEGY - Hyper-aggressive 1m timeframe
 * 
 * Philosophy: Capture tiny price movements with maximum frequency
 * 
 * Key Features:
 * - Ultra-responsive: 0.15% drops trigger entries
 * - Quick profits: 0.4% target = 0.1% net after fees  
 * - Very high frequency: 200+ trades per day on 1m
 * - Aggressive sizing: 30% initial position
 * - Lightning detection: 5-candle lookback (5 minutes)
 * - Max 2 levels to avoid over-leveraging
 * 
 * Math:
 * - $10,000 × 30% = $3,000 first position
 * - 0.4% move = $12 gross profit
 * - Minus 0.3% fees = $9 net profit per trade
 * - 200 trades/day = $1,800 daily profit (18% return)
 */
export class UltraMicroScalpingStrategy extends Strategy {
  private config: ScalpingConfig;
  private internalState: ScalpingState;
  
  // Modular components
  private marketAnalyzer: MarketAnalyzer;
  private entryLogic: EntryLogic;
  private exitLogic: ExitLogic;
  private positionSizer: PositionSizer;
  private stateManager: StateManager;

  constructor(config: Partial<ScalpingConfig> = {}) {
    const fullConfig: ScalpingConfig = {
      vaultAllocation: 85.7,     // 6/7 of profit goes to vault
      btcGrowthAllocation: 14.3, // 1/7 of profit goes to BTC growth
      initialDropPercent: 0.15,  // 0.15% drop triggers first entry (hyper-sensitive for 1m)
      levelDropPercent: 0.2,     // 0.2% between levels
      ratioMultiplier: 1.8,      // Aggressive scaling: 30%, 54% (of initial)
      profitTarget: 0.4,         // 0.4% gross = 0.1% net profit (after 0.15% fees each way)
      maxLevels: 2,              // Max 2 levels to avoid over-leverage
      lookbackPeriod: 5,         // 5 candles = 5 minutes on 1m timeframe
      positionSizeMode: 'percentage',
      basePositionPercent: 30,   // 30% initial position (hyper-aggressive)
      maxPositionPercent: 50,    // Max 50% total exposure
      ...config
    };

    super(
      'Ultra Micro Scalping',
      `Hyper-aggressive ${fullConfig.initialDropPercent}% entries, ${fullConfig.profitTarget}% exits on 1m timeframe`,
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

    // Initialize modular components with 'ultra-micro' variant
    this.marketAnalyzer = new MarketAnalyzer(this.config, this.internalState, 'ultra-micro');
    this.entryLogic = new EntryLogic(this.config, this.internalState, 'ultra-micro');
    this.exitLogic = new ExitLogic(this.config, this.internalState, 'ultra-micro');
    this.positionSizer = new PositionSizer(this.config, this.internalState, 'ultra-micro');
    this.stateManager = new StateManager(this.internalState, 'ultra-micro');
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
          console.warn('[UltraMicroScalping] Strategy has positions but btcPositions is 0 - skipping sell signal');
          return {
            type: 'hold',
            strength: 0,
            price: currentPrice,
            reason: 'No BTC balance to sell'
          };
        }
        
        // Use the minimum of our tracked positions and actual BTC balance
        const sellSize = Math.min(totalPositionSize, this.state.balance.btcPositions);
        
        console.log('[UltraMicroScalping] 🎉 GENERATING SELL SIGNAL!', {
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