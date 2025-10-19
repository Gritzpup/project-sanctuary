import { SeriesPlugin } from '../series/SeriesPlugin';
import type { CandlestickData, LineData, Time } from 'lightweight-charts';

export interface IndicatorSettings {
  color?: string;
  lineWidth?: number;
  lineStyle?: number;
  visible?: boolean;
}

export abstract class IndicatorPlugin extends SeriesPlugin<'Line'> {
  protected indicatorData: LineData[] = [];

  constructor(id: string, name: string, settings?: IndicatorSettings) {
    const defaultSettings: IndicatorSettings = {
      color: '#2196F3',
      lineWidth: 2,
      lineStyle: 0, // Solid
      visible: true
    };

    super({
      id,
      name,
      version: '1.0.0',
      seriesType: 'Line',
      seriesOptions: {
        color: defaultSettings.color,
        lineWidth: defaultSettings.lineWidth,
        lineStyle: defaultSettings.lineStyle,
        crosshairMarkerVisible: false,
        lastValueVisible: true,
        priceLineVisible: false,
      },
      settings: { ...defaultSettings, ...settings }
    });
  }

  protected async setupSeries(): Promise<void> {
    // Apply indicator-specific settings
    this.updateIndicatorStyle();
  }

  protected getData(): LineData[] {
    const dataStore = this.getDataStore();
    const candles = dataStore.candles;
    
    // Calculate indicator values
    this.indicatorData = this.calculate(candles);
    
    return this.indicatorData;
  }

  protected updateIndicatorStyle(): void {
    if (!this.series) return;
    
    const settings = this.settings as IndicatorSettings;
    this.series.applyOptions({
      color: settings.color,
      lineWidth: settings.lineWidth,
      lineStyle: settings.lineStyle,
    });
  }

  // Abstract method for indicator calculation
  protected abstract calculate(candles: CandlestickData[]): LineData[];

  // Helper methods for common calculations
  // ⚡ PHASE 4A: Optimized SMA using sliding window (O(n) instead of O(n*m))
  protected calculateSMA(values: number[], period: number): (number | null)[] {
    const result: (number | null)[] = [];

    if (values.length < period) {
      return values.map(() => null);
    }

    // Calculate initial window sum (first period candles)
    let sum = 0;
    for (let i = 0; i < period; i++) {
      sum += values[i];
    }

    // Add nulls for values before period
    for (let i = 0; i < period - 1; i++) {
      result.push(null);
    }

    // Add first SMA
    result.push(sum / period);

    // Slide window: remove leftmost, add rightmost (O(1) per iteration)
    for (let i = period; i < values.length; i++) {
      sum = sum - values[i - period] + values[i];
      result.push(sum / period);
    }

    return result;
  }

  // ⚡ PHASE 4A: Optimized EMA initialization with direct sum calculation (O(n) instead of O(n*m))
  protected calculateEMA(values: number[], period: number): (number | null)[] {
    const result: (number | null)[] = [];
    const multiplier = 2 / (period + 1);

    if (values.length < period) {
      return values.map(() => null);
    }

    // Calculate initial SMA efficiently (sum once)
    let sum = 0;
    for (let i = 0; i < period; i++) {
      sum += values[i];
    }

    // Add nulls for values before period
    for (let i = 0; i < period - 1; i++) {
      result.push(null);
    }

    // First EMA is SMA
    let ema = sum / period;
    result.push(ema);

    // Calculate subsequent EMA values efficiently
    for (let i = period; i < values.length; i++) {
      ema = (values[i] - ema) * multiplier + ema;
      result.push(ema);
    }

    return result;
  }

  // Public methods
  updateColor(color: string): void {
    this.updateSettings({ color });
    this.updateIndicatorStyle();
  }

  updateLineWidth(width: number): void {
    this.updateSettings({ lineWidth: width });
    this.updateIndicatorStyle();
  }

  updateLineStyle(style: number): void {
    this.updateSettings({ lineStyle: style });
    this.updateIndicatorStyle();
  }

  getLatestValue(): number | null {
    if (this.indicatorData.length === 0) return null;
    
    const lastPoint = this.indicatorData[this.indicatorData.length - 1];
    return lastPoint.value;
  }

  getValueAt(time: Time): number | null {
    const point = this.indicatorData.find(d => d.time === time);
    return point ? point.value : null;
  }
}