// @ts-nocheck - CandleData extended properties
import type { CandleData } from '../../../types/coinbase';

export class CandleAggregator {
  private currentCandles: Map<string, CandleData> = new Map();
  private granularitySeconds: Record<string, number> = {
    '1m': 60,
    '5m': 300,
    '15m': 900,
    '1h': 3600,
    '6h': 21600,
    '1d': 86400
  };

  public processCandle(rawCandle: CandleData, targetGranularity: string): CandleData | null {
    const granularityTime = this.granularitySeconds[targetGranularity];
    if (!granularityTime) {
      return null;
    }

    // Align timestamp to granularity boundary
    const alignedTime = Math.floor(rawCandle.time / granularityTime) * granularityTime;
    const candleKey = `${rawCandle.symbol}-${targetGranularity}-${alignedTime}`;

    let currentCandle = this.currentCandles.get(candleKey);

    if (!currentCandle) {
      // Create new candle
      currentCandle = {
        symbol: rawCandle.symbol,
        time: alignedTime,
        open: rawCandle.open,
        high: rawCandle.high,
        low: rawCandle.low,
        close: rawCandle.close,
        volume: rawCandle.volume
      };
    } else {
      // Update existing candle
      currentCandle.high = Math.max(currentCandle.high, rawCandle.high);
      currentCandle.low = Math.min(currentCandle.low, rawCandle.low);
      currentCandle.close = rawCandle.close;
      currentCandle.volume += rawCandle.volume;
    }

    this.currentCandles.set(candleKey, currentCandle);
    return { ...currentCandle };
  }

  public finalizePeriod(symbol: string, granularity: string, time: number): CandleData | null {
    const candleKey = `${symbol}-${granularity}-${time}`;
    const candle = this.currentCandles.get(candleKey);
    
    if (candle) {
      this.currentCandles.delete(candleKey);
      return { ...candle };
    }
    
    return null;
  }

  public cleanup(): void {
    this.currentCandles.clear();
  }
}