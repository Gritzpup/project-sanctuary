import { Strategy } from '../base/Strategy';
import type { CandleData, Position, Signal, StrategyConfig } from '../base/StrategyTypes';

interface ProperScalpingConfig extends StrategyConfig {
  // Position sizing
  positionSize: number;
  maxOpenPositions: number;
  // Technical indicators
  rsiPeriod: number;
  rsiOverbought: number;
  rsiOversold: number;
  // MACD settings
  macdFast: number;
  macdSlow: number;
  macdSignal: number;
  // Risk management
  stopLoss: number;
  profitTarget: number;
  trailingStop: boolean;
  trailingStopPercent: number;
  // Entry filters
  minVolume: number;
  trendAlignment: boolean;
  emaFast: number;
  emaSlow: number;
}

// Default configuration
const DEFAULT_SCALPING_CONFIG: ProperScalpingConfig = {
  positionSize: 5,
  maxOpenPositions: 3,
  rsiPeriod: 7,
  rsiOverbought: 75,
  rsiOversold: 25,
  macdFast: 3,
  macdSlow: 10,
  macdSignal: 16,
  stopLoss: 0.5,
  profitTarget: 1.0,
  trailingStop: true,
  trailingStopPercent: 0.3,
  minVolume: 1000000,
  trendAlignment: true,
  emaFast: 9,
  emaSlow: 21,
  vaultAllocation: 85.7,
  btcGrowthAllocation: 14.3
};

// Extended Position interface for trailing stop
interface ScalpingPosition extends Position {
  highestPrice?: number;
}

/**
 * PROPER SCALPING STRATEGY
 */
export class ProperScalpingStrategy extends Strategy {
  protected scalingConfig: ProperScalpingConfig;
  private rsiValues: number[] = [];
  private macdLine: number[] = [];
  private signalLine: number[] = [];
  private emaFastValues: number[] = [];
  private emaSlowValues: number[] = [];

  constructor(config?: Partial<ProperScalpingConfig>) {
    const fullConfig = { ...DEFAULT_SCALPING_CONFIG, ...config };
    super(
      'Proper Scalping',
      `Professional scalping with RSI ${fullConfig.rsiPeriod}, MACD, ${fullConfig.stopLoss}% SL`,
      fullConfig
    );
    this.scalingConfig = fullConfig;
  }

  // Required abstract method implementations
  analyze(candles: CandleData[], currentPrice: number): Signal {
    const evaluation = this.evaluateMarket(candles);

    if (!evaluation.shouldTrade || !evaluation.signal) {
      return {
        type: 'hold',
        strength: 0,
        price: currentPrice,
        reason: 'No trading signal'
      };
    }

    return {
      type: evaluation.signal,
      strength: evaluation.confidence / 100,
      price: currentPrice,
      reason: `${evaluation.signal.toUpperCase()} signal with ${evaluation.confidence}% confidence`
    };
  }

  calculatePositionSize(balance: number, signal: Signal, currentPrice: number): number {
    if (signal.type === 'hold') return 0;
    if (this.getPositions().length >= this.scalingConfig.maxOpenPositions) return 0;

    const scaleFactor = 0.5 + (signal.strength * 0.5);
    return balance * (this.scalingConfig.positionSize / 100) * scaleFactor;
  }

  shouldTakeProfit(position: Position, currentPrice: number): boolean {
    const priceChange = ((currentPrice - position.entryPrice) / position.entryPrice) * 100;
    return priceChange >= this.scalingConfig.profitTarget;
  }

  shouldStopLoss(position: Position, currentPrice: number): boolean {
    const priceChange = ((currentPrice - position.entryPrice) / position.entryPrice) * 100;
    return priceChange <= -this.scalingConfig.stopLoss;
  }

  getRequiredHistoricalData(): number {
    return Math.max(this.scalingConfig.macdSlow, this.scalingConfig.emaSlow, this.scalingConfig.rsiPeriod) + 10;
  }

  // Original methods adapted
  evaluateMarket(data: CandleData[]): { shouldTrade: boolean; signal: 'buy' | 'sell' | null; confidence: number } {
    if (data.length < this.getRequiredHistoricalData()) {
      return { shouldTrade: false, signal: null, confidence: 0 };
    }

    this.calculateIndicators(data);

    const currentPrice = data[data.length - 1].close;
    const currentVolume = (data[data.length - 1] as any).volume * currentPrice;
    const currentRSI = this.rsiValues[this.rsiValues.length - 1];
    const currentMACD = this.macdLine[this.macdLine.length - 1];
    const currentSignal = this.signalLine[this.signalLine.length - 1];
    const prevMACD = this.macdLine[this.macdLine.length - 2];
    const prevSignal = this.signalLine[this.signalLine.length - 2];
    const currentEMAFast = this.emaFastValues[this.emaFastValues.length - 1];
    const currentEMASlow = this.emaSlowValues[this.emaSlowValues.length - 1];

    if (currentVolume < this.scalingConfig.minVolume) {
      return { shouldTrade: false, signal: null, confidence: 0 };
    }

    const macdBullishCross = prevMACD <= prevSignal && currentMACD > currentSignal;
    const rsiOversold = currentRSI < this.scalingConfig.rsiOversold;
    const trendBullish = !this.scalingConfig.trendAlignment || currentEMAFast > currentEMASlow;

    if (macdBullishCross && rsiOversold && trendBullish) {
      const confidence = this.calculateConfidence('buy', currentRSI, currentMACD - currentSignal);
      return { shouldTrade: true, signal: 'buy', confidence };
    }

    const macdBearishCross = prevMACD >= prevSignal && currentMACD < currentSignal;
    const rsiOverbought = currentRSI > this.scalingConfig.rsiOverbought;
    const trendBearish = !this.scalingConfig.trendAlignment || currentEMAFast < currentEMASlow;

    if (macdBearishCross && rsiOverbought && trendBearish) {
      const confidence = this.calculateConfidence('sell', currentRSI, currentSignal - currentMACD);
      return { shouldTrade: true, signal: 'sell', confidence };
    }

    return { shouldTrade: false, signal: null, confidence: 0 };
  }

  shouldClosePosition(position: ScalpingPosition, currentPrice: number, _data: CandleData[]): boolean {
    if (this.shouldStopLoss(position, currentPrice)) return true;
    if (this.shouldTakeProfit(position, currentPrice)) return true;

    // Trailing stop
    if (this.scalingConfig.trailingStop && position.highestPrice) {
      const fromPeak = ((currentPrice - position.highestPrice) / position.highestPrice) * 100;
      if (fromPeak <= -this.scalingConfig.trailingStopPercent) return true;
    }

    // Update highest price
    if (!position.highestPrice || currentPrice > position.highestPrice) {
      position.highestPrice = currentPrice;
    }

    // RSI exit
    const currentRSI = this.rsiValues[this.rsiValues.length - 1];
    if (position.type === 'long' && currentRSI > this.scalingConfig.rsiOverbought) return true;

    return false;
  }

  private calculateIndicators(data: CandleData[]): void {
    this.rsiValues = this.calculateRSI(data, this.scalingConfig.rsiPeriod);
    const macdResult = this.calculateMACD(data, this.scalingConfig.macdFast, this.scalingConfig.macdSlow, this.scalingConfig.macdSignal);
    this.macdLine = macdResult.macdLine;
    this.signalLine = macdResult.signalLine;
    this.emaFastValues = this.calculateEMA(data, this.scalingConfig.emaFast);
    this.emaSlowValues = this.calculateEMA(data, this.scalingConfig.emaSlow);
  }

  private calculateRSI(data: CandleData[], period: number): number[] {
    const prices = data.map(d => d.close);
    const rsi: number[] = [];
    if (prices.length < period + 1) return rsi;

    const changes: number[] = [];
    for (let i = 1; i < prices.length; i++) {
      changes.push(prices[i] - prices[i - 1]);
    }

    let avgGain = 0, avgLoss = 0;
    for (let i = 0; i < period; i++) {
      if (changes[i] > 0) avgGain += changes[i];
      else avgLoss += Math.abs(changes[i]);
    }
    avgGain /= period;
    avgLoss /= period;

    for (let i = period; i < changes.length; i++) {
      const change = changes[i];
      avgGain = (avgGain * (period - 1) + (change > 0 ? change : 0)) / period;
      avgLoss = (avgLoss * (period - 1) + (change < 0 ? Math.abs(change) : 0)) / period;
      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      rsi.push(100 - (100 / (1 + rs)));
    }
    return rsi;
  }

  private calculateMACD(data: CandleData[], fast: number, slow: number, signal: number): { macdLine: number[], signalLine: number[] } {
    const emaFast = this.calculateEMA(data, fast);
    const emaSlow = this.calculateEMA(data, slow);

    const macdLine: number[] = [];
    for (let i = 0; i < Math.min(emaFast.length, emaSlow.length); i++) {
      macdLine.push(emaFast[i] - emaSlow[i]);
    }

    const signalLine = this.calculateEMAFromValues(macdLine, signal);
    return { macdLine, signalLine };
  }

  private calculateEMA(data: CandleData[], period: number): number[] {
    const prices = data.map(d => d.close);
    return this.calculateEMAFromValues(prices, period);
  }

  private calculateEMAFromValues(values: number[], period: number): number[] {
    const ema: number[] = [];
    if (values.length < period) return ema;

    let sum = 0;
    for (let i = 0; i < period; i++) sum += values[i];
    ema.push(sum / period);

    const multiplier = 2 / (period + 1);
    for (let i = period; i < values.length; i++) {
      const emaValue = (values[i] - ema[ema.length - 1]) * multiplier + ema[ema.length - 1];
      ema.push(emaValue);
    }
    return ema;
  }

  private calculateConfidence(signal: 'buy' | 'sell', rsi: number, macdDiff: number): number {
    let confidence = 50;

    if (signal === 'buy') {
      if (rsi < 20) confidence += 20;
      else if (rsi < 25) confidence += 10;
      if (Math.abs(macdDiff) > 0.1) confidence += 20;
      else if (Math.abs(macdDiff) > 0.05) confidence += 10;
    } else {
      if (rsi > 80) confidence += 20;
      else if (rsi > 75) confidence += 10;
      if (Math.abs(macdDiff) > 0.1) confidence += 20;
      else if (Math.abs(macdDiff) > 0.05) confidence += 10;
    }

    return Math.min(confidence, 100);
  }
}
