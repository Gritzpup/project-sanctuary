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
  protected calculateSMA(values: number[], period: number): (number | null)[] {
    const result: (number | null)[] = [];
    
    for (let i = 0; i < values.length; i++) {
      if (i < period - 1) {
        result.push(null);
      } else {
        const sum = values.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
        result.push(sum / period);
      }
    }
    
    return result;
  }

  protected calculateEMA(values: number[], period: number): (number | null)[] {
    const result: (number | null)[] = [];
    const multiplier = 2 / (period + 1);
    
    // Calculate initial SMA
    let ema: number | null = null;
    
    for (let i = 0; i < values.length; i++) {
      if (i < period - 1) {
        result.push(null);
      } else if (i === period - 1) {
        // First EMA is SMA
        const sum = values.slice(0, period).reduce((a, b) => a + b, 0);
        ema = sum / period;
        result.push(ema);
      } else {
        // EMA = (Close - Previous EMA) × Multiplier + Previous EMA
        ema = (values[i] - ema!) * multiplier + ema!;
        result.push(ema);
      }
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