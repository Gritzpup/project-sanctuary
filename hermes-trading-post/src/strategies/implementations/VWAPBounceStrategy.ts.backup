import { Strategy } from '../base/Strategy';
import type { CandleData, Position, Signal, StrategyConfig } from '../base/StrategyTypes';

export interface VWAPConfig extends StrategyConfig {
  vwapPeriod: number;          // VWAP calculation period in candles (default: 20)
  deviationBuy: number;        // Standard deviations below VWAP to buy (default: 2)
  deviationSell: number;       // Standard deviations above VWAP to sell (default: 2)
  volumeThreshold: number;     // Min volume % above average (default: 150)
  bounceConfirmation: boolean; // Wait for bounce confirmation (default: true)
  positionSize: number;        // % of balance per trade (default: 40)
  useAnchored: boolean;        // Use anchored VWAP from session start (default: true)
}

export class VWAPBounceStrategy extends Strategy {
  private vwapValues: { price: number; upper: number; lower: number }[] = [];
  private sessionStart: number = 0;

  constructor(config: Partial<VWAPConfig> = {}) {
    const fullConfig: VWAPConfig = {
      vaultAllocation: 85,
      btcGrowthAllocation: 15,
      vwapPeriod: 20,
      deviationBuy: 2,
      deviationSell: 2,
      volumeThreshold: 150,
      bounceConfirmation: true,
      positionSize: 40,
      useAnchored: true,
      ...config
    };

    super(
      'VWAP Bounce',
      'Trades bounces off VWAP bands with volume confirmation',
      fullConfig
    );
  }

  analyze(candles: CandleData[], currentPrice: number): Signal {
    const config = this.config as VWAPConfig;
    
    // Calculate VWAP and bands
    const vwapData = this.calculateVWAP(candles, config.vwapPeriod, config.useAnchored);
    if (!vwapData) {
      return {
        type: 'hold',
        strength: 0,
        price: currentPrice,
        reason: 'Insufficient data for VWAP calculation'
      };
    }

    const { vwap, upperBand, lowerBand, stdDev } = vwapData;
    
    // Store VWAP history
    this.vwapValues.push({ price: vwap, upper: upperBand, lower: lowerBand });
    if (this.vwapValues.length > 100) {
      this.vwapValues.shift();
    }

    // Check volume condition
    const currentVolume = candles[candles.length - 1].volume || 0;
    const avgVolume = this.calculateAverageVolume(candles, 20);
    const volumeRatio = (currentVolume / avgVolume) * 100;
    const highVolume = volumeRatio >= config.volumeThreshold;

    // Check for buy signal (bounce off lower band)
    if (currentPrice <= lowerBand && this.state.positions.length === 0) {
      // Check for bounce confirmation if required
      if (config.bounceConfirmation) {
        const bouncing = this.confirmBounce(candles, 'up');
        if (!bouncing) {
          return {
            type: 'hold',
            strength: 0,
            price: currentPrice,
            reason: 'Waiting for bounce confirmation off lower band'
          };
        }
      }

      const deviation = (vwap - currentPrice) / stdDev;
      
      return {
        type: 'buy',
        strength: highVolume ? 0.9 : 0.7,
        price: currentPrice,
        reason: `VWAP bounce buy - ${deviation.toFixed(2)} std devs below VWAP${highVolume ? ' with high volume' : ''}`,
        metadata: {
          vwap,
          lowerBand,
          deviation,
          volumeRatio,
          highVolume
        }
      };
    }

    // Check for sell signal (touch upper band or return to VWAP)
    if (this.state.positions.length > 0) {
      const position = this.state.positions[0];
      const profitPercent = ((currentPrice - position.entryPrice) / position.entryPrice) * 100;
      
      // Sell at upper band
      if (currentPrice >= upperBand) {
        const deviation = (currentPrice - vwap) / stdDev;
        
        return {
          type: 'sell',
          strength: 0.9,
          price: currentPrice,
          size: this.getTotalPositionSize(),
          reason: `VWAP upper band sell - ${deviation.toFixed(2)} std devs above VWAP`,
          metadata: {
            vwap,
            upperBand,
            deviation,
            profitPercent
          }
        };
      }
      
      // Sell at VWAP if profitable
      if (currentPrice >= vwap && profitPercent > 2) {
        return {
          type: 'sell',
          strength: 0.7,
          price: currentPrice,
          size: this.getTotalPositionSize(),
          reason: `VWAP mean reversion sell - ${profitPercent.toFixed(2)}% profit`,
          metadata: {
            vwap,
            profitPercent
          }
        };
      }
    }

    const position = currentPrice < vwap ? 'below' : 'above';
    const distance = Math.abs(((currentPrice - vwap) / vwap) * 100);
    
    return {
      type: 'hold',
      strength: 0,
      price: currentPrice,
      reason: `Price ${distance.toFixed(2)}% ${position} VWAP ($${vwap.toFixed(2)})`
    };
  }

  calculatePositionSize(balance: number, signal: Signal, currentPrice: number): number {
    const config = this.config as VWAPConfig;
    
    if (signal.type === 'buy') {
      const allocation = (config.positionSize / 100) * balance;
      
      // Increase size for high volume signals
      const multiplier = signal.metadata?.highVolume ? 1.2 : 1.0;
      
      return (allocation * multiplier) / currentPrice;
    }
    
    return 0;
  }

  shouldTakeProfit(position: Position, currentPrice: number): boolean {
    // Handled in analyze method
    return false;
  }

  shouldStopLoss(position: Position, currentPrice: number): boolean {
    // No fixed stop loss, uses VWAP bands
    return false;
  }

  getRequiredHistoricalData(): number {
    const config = this.config as VWAPConfig;
    return config.vwapPeriod * 2 + 10;
  }

  // Helper methods
  private calculateVWAP(
    candles: CandleData[], 
    period: number, 
    useAnchored: boolean
  ): { vwap: number; upperBand: number; lowerBand: number; stdDev: number } | null {
    
    if (candles.length < period) return null;

    let startIndex = candles.length - period;
    
    // For anchored VWAP, find session start
    if (useAnchored) {
      const currentTime = candles[candles.length - 1].time;
      const sessionStartTime = this.findSessionStart(currentTime);
      
      for (let i = candles.length - 1; i >= 0; i--) {
        if (candles[i].time <= sessionStartTime) {
          startIndex = i;
          break;
        }
      }
    }

    const relevantCandles = candles.slice(startIndex);
    
    // Calculate VWAP
    let totalPV = 0;
    let totalVolume = 0;
    const typicalPrices: number[] = [];
    
    for (const candle of relevantCandles) {
      const typicalPrice = (candle.high + candle.low + candle.close) / 3;
      const volume = candle.volume || 1;
      
      totalPV += typicalPrice * volume;
      totalVolume += volume;
      typicalPrices.push(typicalPrice);
    }
    
    const vwap = totalPV / totalVolume;
    
    // Calculate standard deviation
    const squaredDiffs = typicalPrices.map(price => Math.pow(price - vwap, 2));
    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / typicalPrices.length;
    const stdDev = Math.sqrt(variance);
    
    const config = this.config as VWAPConfig;
    const upperBand = vwap + (stdDev * config.deviationSell);
    const lowerBand = vwap - (stdDev * config.deviationBuy);
    
    return { vwap, upperBand, lowerBand, stdDev };
  }

  private calculateAverageVolume(candles: CandleData[], period: number): number {
    const volumes = candles.slice(-period).map(c => c.volume || 0);
    return volumes.reduce((a, b) => a + b, 0) / volumes.length;
  }

  private confirmBounce(candles: CandleData[], direction: 'up' | 'down'): boolean {
    if (candles.length < 3) return false;
    
    const last3 = candles.slice(-3);
    
    if (direction === 'up') {
      // Look for reversal pattern (e.g., hammer, bullish engulfing)
      const lastCandle = last3[2];
      const prevCandle = last3[1];
      
      // Simple bounce: current close > previous close and current low > previous low
      return lastCandle.close > prevCandle.close && lastCandle.low > prevCandle.low;
    } else {
      // Look for bearish reversal
      const lastCandle = last3[2];
      const prevCandle = last3[1];
      
      return lastCandle.close < prevCandle.close && lastCandle.high < prevCandle.high;
    }
  }

  private findSessionStart(currentTime: number): number {
    // Find start of current trading day (UTC midnight)
    const date = new Date(currentTime * 1000);
    date.setUTCHours(0, 0, 0, 0);
    return date.getTime() / 1000;
  }

  reset(): void {
    this.vwapValues = [];
    this.sessionStart = 0;
    this.state.positions = [];
  }
}