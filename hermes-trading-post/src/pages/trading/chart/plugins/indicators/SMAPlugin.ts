import { IndicatorPlugin, type IndicatorSettings } from './IndicatorPlugin';
import type { CandlestickData, LineData } from 'lightweight-charts';

export interface SMASettings extends IndicatorSettings {
  period: number;
  source?: 'close' | 'open' | 'high' | 'low' | 'hl2' | 'hlc3' | 'ohlc4';
}

export class SMAPlugin extends IndicatorPlugin {
  constructor(settings?: Partial<SMASettings>) {
    const defaultSettings: SMASettings = {
      period: 20,
      source: 'close',
      color: '#2196F3',
      lineWidth: 2,
    };

    const mergedSettings = { ...defaultSettings, ...settings };
    
    super(
      `sma-${mergedSettings.period}`,
      `SMA ${mergedSettings.period}`,
      mergedSettings
    );
  }

  protected calculate(candles: CandlestickData[]): LineData[] {
    const settings = this.settings as SMASettings;
    
    // Extract source values
    const values = this.extractSourceValues(candles, settings.source || 'close');
    
    // Calculate SMA
    const smaValues = this.calculateSMA(values, settings.period);
    
    // Convert to LineData format
    return candles
      .map((candle, index) => ({
        time: candle.time,
        value: smaValues[index] || 0
      }))
      .filter(point => point.value !== null && point.value !== 0);
  }

  private extractSourceValues(candles: CandlestickData[], source: string): number[] {
    return candles.map(candle => {
      switch (source) {
        case 'open':
          return candle.open;
        case 'high':
          return candle.high;
        case 'low':
          return candle.low;
        case 'close':
          return candle.close;
        case 'hl2': // (High + Low) / 2
          return (candle.high + candle.low) / 2;
        case 'hlc3': // (High + Low + Close) / 3
          return (candle.high + candle.low + candle.close) / 3;
        case 'ohlc4': // (Open + High + Low + Close) / 4
          return (candle.open + candle.high + candle.low + candle.close) / 4;
        default:
          return candle.close;
      }
    });
  }

  // Public methods
  updatePeriod(period: number): void {
    this.updateSettings({ period });
    this.refreshData();
  }

  updateSource(source: SMASettings['source']): void {
    this.updateSettings({ source });
    this.refreshData();
  }

  getPeriod(): number {
    return (this.settings as SMASettings).period;
  }

  getSource(): string {
    return (this.settings as SMASettings).source || 'close';
  }
}