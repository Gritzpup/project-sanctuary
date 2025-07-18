import { Strategy } from '../base/Strategy';
import type { CandleData, Position, Signal, StrategyConfig } from '../base/StrategyTypes';

export interface RSIConfig extends StrategyConfig {
  rsiPeriod: number;            // RSI calculation period (default: 14)
  oversoldLevel: number;        // RSI level to buy (default: 30)
  overboughtLevel: number;      // RSI level to sell (default: 70)
  positionSize: number;         // % of balance per trade (default: 50)
  confirmationCandles: number;  // Candles to confirm reversal (default: 2)
  useDivergence: boolean;       // Look for price/RSI divergence (default: true)
}

export class RSIMeanReversionStrategy extends Strategy {
  private rsiValues: number[] = [];
  private priceHistory: number[] = [];

  constructor(config: Partial<RSIConfig> = {}) {
    const fullConfig: RSIConfig = {
      vaultAllocation: 90,
      btcGrowthAllocation: 10,
      rsiPeriod: 14,
      oversoldLevel: 30,
      overboughtLevel: 70,
      positionSize: 50,
      confirmationCandles: 2,
      useDivergence: true,
      ...config
    };

    super(
      'RSI Mean Reversion',
      'Buys oversold conditions and sells overbought conditions using RSI indicator',
      fullConfig
    );
  }

  analyze(candles: CandleData[], currentPrice: number): Signal {
    const config = this.config as RSIConfig;
    
    // Calculate RSI
    const rsi = this.calculateRSI(candles, config.rsiPeriod);
    if (rsi === null) {
      return {
        type: 'hold',
        strength: 0,
        price: currentPrice,
        reason: 'Insufficient data for RSI calculation'
      };
    }

    // Store RSI history
    this.rsiValues.push(rsi);
    this.priceHistory.push(currentPrice);
    if (this.rsiValues.length > 100) {
      this.rsiValues.shift();
      this.priceHistory.shift();
    }

    // Check for divergence if enabled
    let divergenceSignal = null;
    if (config.useDivergence && this.rsiValues.length >= 20) {
      divergenceSignal = this.checkDivergence();
    }

    // Check oversold condition for buy
    if (rsi < config.oversoldLevel && this.state.positions.length === 0) {
      const strength = (config.oversoldLevel - rsi) / config.oversoldLevel;
      
      // Confirm reversal if required
      if (config.confirmationCandles > 0) {
        const confirmed = this.confirmReversal(candles, 'bullish', config.confirmationCandles);
        if (!confirmed) {
          return {
            type: 'hold',
            strength: 0,
            price: currentPrice,
            reason: 'Waiting for bullish reversal confirmation'
          };
        }
      }

      return {
        type: 'buy',
        strength: Math.min(strength * 2, 1),
        price: currentPrice,
        reason: `RSI oversold at ${rsi.toFixed(2)}${divergenceSignal === 'bullish' ? ' with bullish divergence' : ''}`,
        metadata: {
          rsi,
          divergence: divergenceSignal === 'bullish'
        }
      };
    }

    // Check overbought condition for sell
    if (rsi > config.overboughtLevel && this.state.positions.length > 0) {
      const strength = (rsi - config.overboughtLevel) / (100 - config.overboughtLevel);
      
      // Confirm reversal if required
      if (config.confirmationCandles > 0) {
        const confirmed = this.confirmReversal(candles, 'bearish', config.confirmationCandles);
        if (!confirmed) {
          return {
            type: 'hold',
            strength: 0,
            price: currentPrice,
            reason: 'Waiting for bearish reversal confirmation'
          };
        }
      }

      return {
        type: 'sell',
        strength: Math.min(strength * 2, 1),
        price: currentPrice,
        size: this.getTotalPositionSize(),
        reason: `RSI overbought at ${rsi.toFixed(2)}${divergenceSignal === 'bearish' ? ' with bearish divergence' : ''}`,
        metadata: {
          rsi,
          divergence: divergenceSignal === 'bearish'
        }
      };
    }

    return {
      type: 'hold',
      strength: 0,
      price: currentPrice,
      reason: `RSI at ${rsi.toFixed(2)} - neutral zone`
    };
  }

  calculatePositionSize(balance: number, signal: Signal, currentPrice: number): number {
    const config = this.config as RSIConfig;
    
    if (signal.type === 'buy') {
      const allocation = (config.positionSize / 100) * balance;
      return allocation / currentPrice;
    }
    
    return 0;
  }

  shouldTakeProfit(position: Position, currentPrice: number): boolean {
    // RSI strategy uses overbought conditions for profit taking
    return false;
  }

  shouldStopLoss(position: Position, currentPrice: number): boolean {
    // No stop loss for mean reversion on deflationary assets
    return false;
  }

  getRequiredHistoricalData(): number {
    const config = this.config as RSIConfig;
    return config.rsiPeriod * 2 + 10; // Extra buffer for calculations
  }

  // Helper methods
  private calculateRSI(candles: CandleData[], period: number): number | null {
    if (candles.length < period + 1) return null;

    const gains: number[] = [];
    const losses: number[] = [];

    for (let i = candles.length - period; i < candles.length; i++) {
      const change = candles[i].close - candles[i - 1].close;
      if (change > 0) {
        gains.push(change);
        losses.push(0);
      } else {
        gains.push(0);
        losses.push(Math.abs(change));
      }
    }

    const avgGain = gains.reduce((a, b) => a + b, 0) / period;
    const avgLoss = losses.reduce((a, b) => a + b, 0) / period;

    if (avgLoss === 0) return 100;

    const rs = avgGain / avgLoss;
    const rsi = 100 - (100 / (1 + rs));

    return rsi;
  }

  private confirmReversal(candles: CandleData[], type: 'bullish' | 'bearish', confirmationPeriod: number): boolean {
    if (candles.length < confirmationPeriod) return false;

    const recentCandles = candles.slice(-confirmationPeriod);
    
    if (type === 'bullish') {
      // Look for higher lows or bullish candle patterns
      for (let i = 1; i < recentCandles.length; i++) {
        if (recentCandles[i].low <= recentCandles[i - 1].low) {
          return false;
        }
      }
      return true;
    } else {
      // Look for lower highs or bearish candle patterns
      for (let i = 1; i < recentCandles.length; i++) {
        if (recentCandles[i].high >= recentCandles[i - 1].high) {
          return false;
        }
      }
      return true;
    }
  }

  private checkDivergence(): 'bullish' | 'bearish' | null {
    if (this.rsiValues.length < 20 || this.priceHistory.length < 20) return null;

    const lookback = 10;
    const recentRSI = this.rsiValues.slice(-lookback);
    const recentPrices = this.priceHistory.slice(-lookback);

    // Find local extremes
    const rsiMin = Math.min(...recentRSI);
    const rsiMax = Math.max(...recentRSI);
    const priceMin = Math.min(...recentPrices);
    const priceMax = Math.max(...recentPrices);

    const rsiMinIndex = recentRSI.indexOf(rsiMin);
    const rsiMaxIndex = recentRSI.indexOf(rsiMax);
    const priceMinIndex = recentPrices.indexOf(priceMin);
    const priceMaxIndex = recentPrices.indexOf(priceMax);

    // Bullish divergence: price makes lower low, RSI makes higher low
    if (priceMinIndex > lookback / 2 && rsiMinIndex < lookback / 2 && recentRSI[recentRSI.length - 1] < 40) {
      return 'bullish';
    }

    // Bearish divergence: price makes higher high, RSI makes lower high
    if (priceMaxIndex > lookback / 2 && rsiMaxIndex < lookback / 2 && recentRSI[recentRSI.length - 1] > 60) {
      return 'bearish';
    }

    return null;
  }

  reset(): void {
    this.rsiValues = [];
    this.priceHistory = [];
    this.state.positions = [];
  }
}