import { SeriesPlugin } from './SeriesPlugin';
import type { HistogramData, Time } from 'lightweight-charts';

export interface VolumePluginSettings {
  upColor?: string;
  downColor?: string;
  opacity?: number;
  scaleMargins?: {
    top: number;
    bottom: number;
  };
}

export class VolumePlugin extends SeriesPlugin<'Histogram'> {
  private volumeData: HistogramData[] = [];

  constructor(settings?: VolumePluginSettings) {
    
    const defaultSettings: VolumePluginSettings = {
      upColor: '#26a69a80',
      downColor: '#ef535080',
      opacity: 0.5,
      scaleMargins: {
        top: 0.8,
        bottom: 0
      }
    };

    super({
      id: 'volume',
      name: 'Volume',
      description: 'Displays trading volume as a histogram',
      version: '1.0.0',
      seriesType: 'Histogram',
      seriesOptions: {
        color: defaultSettings.upColor,
        title: 'Vol',
        lastValueVisible: true,
        priceFormat: {
          type: 'custom',
          formatter: (price: number) => {
            return price.toFixed(1) + 'B';
          },
        },
        priceScaleId: 'volume', // Use separate price scale for volume
        scaleMargins: defaultSettings.scaleMargins,
      },
      settings: { ...defaultSettings, ...settings }
    });
  }

  protected async setupSeries(): Promise<void> {
    // Apply custom settings
    const settings = this.settings as VolumePluginSettings;
    
    if (this.series) {
      this.series.priceScale().applyOptions({
        scaleMargins: settings.scaleMargins || { top: 0.8, bottom: 0 },
        visible: true,
        alignLabels: false,
        autoScale: true,
        borderVisible: false,
        entireTextOnly: false,
      });

      // Apply the custom price formatter directly to the series
      this.series.applyOptions({
        priceFormat: {
          type: 'custom',
          formatter: (price: number) => {
            return price.toFixed(1) + 'B';
          },
        },
      });
      
    }
  }

  protected getData(): HistogramData[] {
    const dataStore = this.getDataStore();
    const candles = dataStore.candles;
    
    
    this.volumeData = candles.map((candle, index) => {
      const settings = this.settings as VolumePluginSettings;
      let volume = candle.volume || 0;
      
      // 🔥 FIX: Use volume-based coloring instead of price-based
      // Compare current volume to previous volume to determine color
      let isVolumeUp = true; // Default for first candle
      if (index > 0) {
        const prevVolume = candles[index - 1].volume || 0;
        isVolumeUp = volume >= prevVolume;
      }
      
      // Convert volume to billions for display
      let displayVolume = volume;
      if (volume >= 1e9) {
        displayVolume = volume / 1e9;
      } else if (volume >= 1e6) {
        displayVolume = volume / 1e6;
      } else if (volume >= 1e3) {
        displayVolume = volume / 1e3;
      }
      
      return {
        time: candle.time,
        value: displayVolume,
        color: isVolumeUp ? settings.upColor : settings.downColor
      };
    });
    
    
    return this.volumeData;
  }

  // Public methods
  updateColors(upColor: string, downColor: string): void {
    this.updateSettings({ upColor, downColor });
  }

  updateOpacity(opacity: number): void {
    const settings = this.settings as VolumePluginSettings;
    const upColor = this.addAlphaToColor(settings.upColor || '#26a69a', opacity);
    const downColor = this.addAlphaToColor(settings.downColor || '#ef5350', opacity);
    
    this.updateSettings({ upColor, downColor, opacity });
  }

  // Helper methods
  private addAlphaToColor(color: string, opacity: number): string {
    // Remove existing alpha if present
    const baseColor = color.replace(/[0-9a-fA-F]{2}$/, '');
    
    // Convert opacity (0-1) to hex (00-FF)
    const alphaHex = Math.round(opacity * 255).toString(16).padStart(2, '0');
    
    return `${baseColor}${alphaHex}`;
  }

  // Override settings update to refresh data with new colors
  protected onSettingsUpdate(oldSettings: Record<string, any>, newSettings: Record<string, any>): void {
    super.onSettingsUpdate(oldSettings, newSettings);
    
    // Refresh data to apply new colors
    this.refreshData();
  }
}