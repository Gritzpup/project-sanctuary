import { Strategy } from '../base/Strategy';
import type { CandleData, Position, Signal, StrategyConfig } from '../base/StrategyTypes';

interface ProperScalpingConfig extends StrategyConfig {
  // Position sizing
  positionSize: number;         // % of balance per trade
  maxOpenPositions: number;     // Maximum simultaneous positions
  
  // Technical indicators
  rsiPeriod: number;           // RSI period (2-3 for 1min, 7-9 for 5min)
  rsiOverbought: number;       // RSI overbought level (e.g., 80)
  rsiOversold: number;         // RSI oversold level (e.g., 20)
  
  // MACD settings (fast scalping: 3-10-16)
  macdFast: number;
  macdSlow: number;
  macdSignal: number;
  
  // Risk management
  stopLoss: number;            // % stop loss (e.g., 0.3-0.5%)
  profitTarget: number;        // % profit target (e.g., 0.5-1%)
  trailingStop: boolean;       // Enable trailing stop
  trailingStopPercent: number; // Trailing stop %
  
  // Entry filters
  minVolume: number;           // Minimum volume requirement
  trendAlignment: boolean;     // Require trend alignment
  emaFast: number;            // Fast EMA period
  emaSlow: number;            // Slow EMA period
}

/**
 * PROPER SCALPING STRATEGY
 * 
 * Based on professional scalping techniques:
 * - Multiple technical indicators for confirmation
 * - Tight stop losses for risk management
 * - Momentum-based entries with RSI and MACD
 * - Volume and trend filters
 * - Dynamic position management
 */
export class ProperScalpingStrategy extends Strategy<ProperScalpingConfig> {
  protected defaultConfig: ProperScalpingConfig = {
    positionSize: 5,              // 5% per trade
    maxOpenPositions: 3,          // Max 3 concurrent trades
    
    // RSI settings for 1H timeframe
    rsiPeriod: 7,                 // 7 period RSI
    rsiOverbought: 75,            // Sell signal above 75
    rsiOversold: 25,              // Buy signal below 25
    
    // MACD fast settings
    macdFast: 3,
    macdSlow: 10,
    macdSignal: 16,
    
    // Risk management
    stopLoss: 0.5,                // 0.5% stop loss
    profitTarget: 1.0,            // 1% profit target (2:1 R/R)
    trailingStop: true,
    trailingStopPercent: 0.3,
    
    // Entry filters
    minVolume: 1000000,           // $1M volume requirement
    trendAlignment: true,
    emaFast: 9,
    emaSlow: 21,
    
    // Vault allocations
    vaultAllocation: 85.7,
    btcGrowthAllocation: 14.3
  };

  private rsiValues: number[] = [];
  private macdLine: number[] = [];
  private signalLine: number[] = [];
  private emaFast: number[] = [];
  private emaSlow: number[] = [];
  
  constructor(config?: Partial<ProperScalpingConfig>) {
    const fullConfig = { ...new ProperScalpingStrategy().defaultConfig, ...config };
    super(
      'Proper Scalping',
      `Professional scalping with RSI ${fullConfig.rsiPeriod}, MACD (${fullConfig.macdFast}-${fullConfig.macdSlow}-${fullConfig.macdSignal}), ${fullConfig.stopLoss}% SL`,
      fullConfig
    );
  }

  evaluateMarket(data: any[]): { shouldTrade: boolean; signal: 'buy' | 'sell' | null; confidence: number } {
    if (data.length < Math.max(this.config.macdSlow, this.config.emaSlow, this.config.rsiPeriod)) {
      return { shouldTrade: false, signal: null, confidence: 0 };
    }

    // Calculate indicators
    this.calculateIndicators(data);
    
    const currentPrice = data[data.length - 1].close;
    const currentVolume = data[data.length - 1].volume * currentPrice;
    const currentRSI = this.rsiValues[this.rsiValues.length - 1];
    const currentMACD = this.macdLine[this.macdLine.length - 1];
    const currentSignal = this.signalLine[this.signalLine.length - 1];
    const prevMACD = this.macdLine[this.macdLine.length - 2];
    const prevSignal = this.signalLine[this.signalLine.length - 2];
    const currentEMAFast = this.emaFast[this.emaFast.length - 1];
    const currentEMASlow = this.emaSlow[this.emaSlow.length - 1];
    
    // Volume filter
    if (currentVolume < this.config.minVolume) {
      return { shouldTrade: false, signal: null, confidence: 0 };
    }

    // Check for buy signals
    const macdBullishCross = prevMACD <= prevSignal && currentMACD > currentSignal;
    const rsiOversold = currentRSI < this.config.rsiOversold;
    const trendBullish = !this.config.trendAlignment || currentEMAFast > currentEMASlow;
    
    if (macdBullishCross && rsiOversold && trendBullish) {
      const confidence = this.calculateConfidence('buy', currentRSI, currentMACD - currentSignal);
      return { shouldTrade: true, signal: 'buy', confidence };
    }
    
    // Check for sell signals (if we add short selling later)
    const macdBearishCross = prevMACD >= prevSignal && currentMACD < currentSignal;
    const rsiOverbought = currentRSI > this.config.rsiOverbought;
    const trendBearish = !this.config.trendAlignment || currentEMAFast < currentEMASlow;
    
    if (macdBearishCross && rsiOverbought && trendBearish) {
      const confidence = this.calculateConfidence('sell', currentRSI, currentSignal - currentMACD);
      return { shouldTrade: true, signal: 'sell', confidence };
    }

    return { shouldTrade: false, signal: null, confidence: 0 };
  }

  calculatePositionSize(balance: number, signal: 'buy' | 'sell', confidence: number): number {
    // Check max open positions
    if (this.positions.length >= this.config.maxOpenPositions) {
      return 0;
    }
    
    // Scale position size by confidence (50-100% of configured size)
    const scaleFactor = 0.5 + (confidence / 100) * 0.5;
    return balance * (this.config.positionSize / 100) * scaleFactor;
  }

  shouldClosePosition(position: Position, currentPrice: number, data: any[]): boolean {
    const priceChange = ((currentPrice - position.entryPrice) / position.entryPrice) * 100;
    
    // Stop loss
    if (priceChange <= -this.config.stopLoss) {
      return true;
    }
    
    // Profit target
    if (priceChange >= this.config.profitTarget) {
      return true;
    }
    
    // Trailing stop
    if (this.config.trailingStop && position.highestPrice) {
      const fromPeak = ((currentPrice - position.highestPrice) / position.highestPrice) * 100;
      if (fromPeak <= -this.config.trailingStopPercent) {
        return true;
      }
    }
    
    // Update highest price for trailing stop
    if (!position.highestPrice || currentPrice > position.highestPrice) {
      position.highestPrice = currentPrice;
    }
    
    // RSI exit signals
    const currentRSI = this.rsiValues[this.rsiValues.length - 1];
    if (position.type === 'long' && currentRSI > this.config.rsiOverbought) {
      return true;
    }
    
    return false;
  }

  private calculateIndicators(data: any[]): void {
    // Calculate RSI
    this.rsiValues = this.calculateRSI(data, this.config.rsiPeriod);
    
    // Calculate MACD
    const macdResult = this.calculateMACD(data, this.config.macdFast, this.config.macdSlow, this.config.macdSignal);
    this.macdLine = macdResult.macdLine;
    this.signalLine = macdResult.signalLine;
    
    // Calculate EMAs
    this.emaFast = this.calculateEMA(data, this.config.emaFast);
    this.emaSlow = this.calculateEMA(data, this.config.emaSlow);
  }
  
  private calculateRSI(data: any[], period: number): number[] {
    const prices = data.map(d => d.close);
    const rsi: number[] = [];
    
    if (prices.length < period + 1) return rsi;
    
    // Calculate price changes
    const changes: number[] = [];
    for (let i = 1; i < prices.length; i++) {
      changes.push(prices[i] - prices[i - 1]);
    }
    
    // Calculate initial average gain/loss
    let avgGain = 0;
    let avgLoss = 0;
    for (let i = 0; i < period; i++) {
      if (changes[i] > 0) avgGain += changes[i];
      else avgLoss += Math.abs(changes[i]);
    }
    avgGain /= period;
    avgLoss /= period;
    
    // Calculate RSI values
    for (let i = period; i < changes.length; i++) {
      const change = changes[i];
      avgGain = (avgGain * (period - 1) + (change > 0 ? change : 0)) / period;
      avgLoss = (avgLoss * (period - 1) + (change < 0 ? Math.abs(change) : 0)) / period;
      
      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      rsi.push(100 - (100 / (1 + rs)));
    }
    
    return rsi;
  }
  
  private calculateMACD(data: any[], fast: number, slow: number, signal: number): { macdLine: number[], signalLine: number[] } {
    const prices = data.map(d => d.close);
    const emaFast = this.calculateEMA(data, fast);
    const emaSlow = this.calculateEMA(data, slow);
    
    const macdLine: number[] = [];
    for (let i = 0; i < Math.min(emaFast.length, emaSlow.length); i++) {
      macdLine.push(emaFast[i] - emaSlow[i]);
    }
    
    // Calculate signal line (EMA of MACD)
    const signalLine = this.calculateEMAFromValues(macdLine, signal);
    
    return { macdLine, signalLine };
  }
  
  private calculateEMA(data: any[], period: number): number[] {
    const prices = data.map(d => d.close);
    return this.calculateEMAFromValues(prices, period);
  }
  
  private calculateEMAFromValues(values: number[], period: number): number[] {
    const ema: number[] = [];
    if (values.length < period) return ema;
    
    // Calculate initial SMA
    let sum = 0;
    for (let i = 0; i < period; i++) {
      sum += values[i];
    }
    ema.push(sum / period);
    
    // Calculate EMA
    const multiplier = 2 / (period + 1);
    for (let i = period; i < values.length; i++) {
      const emaValue = (values[i] - ema[ema.length - 1]) * multiplier + ema[ema.length - 1];
      ema.push(emaValue);
    }
    
    return ema;
  }
  
  private calculateConfidence(signal: 'buy' | 'sell', rsi: number, macdDiff: number): number {
    let confidence = 50; // Base confidence
    
    if (signal === 'buy') {
      // Stronger oversold = higher confidence
      if (rsi < 20) confidence += 20;
      else if (rsi < 25) confidence += 10;
      
      // Stronger MACD cross = higher confidence
      if (Math.abs(macdDiff) > 0.1) confidence += 20;
      else if (Math.abs(macdDiff) > 0.05) confidence += 10;
    } else {
      // Stronger overbought = higher confidence
      if (rsi > 80) confidence += 20;
      else if (rsi > 75) confidence += 10;
      
      // Stronger MACD cross = higher confidence
      if (Math.abs(macdDiff) > 0.1) confidence += 20;
      else if (Math.abs(macdDiff) > 0.05) confidence += 10;
    }
    
    return Math.min(confidence, 100);
  }
}