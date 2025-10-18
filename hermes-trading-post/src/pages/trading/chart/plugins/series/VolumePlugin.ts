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
  private lastCandleCount: number = 0;
  private lastCandleTime: number = 0;

  constructor(settings?: VolumePluginSettings) {
    
    const defaultSettings: VolumePluginSettings = {
      upColor: '#26a69aCC',  // Increased opacity from 80 to CC (80%)
      downColor: '#ef5350CC',  // Increased opacity from 80 to CC (80%)
      opacity: 0.8,
      scaleMargins: {
        top: 0.85,  // Volume uses bottom 15% of chart for better visibility
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
        visible: true,  // CRITICAL: Ensure visible from the start
        color: defaultSettings.upColor,
        title: '',
        lastValueVisible: true,
        priceFormat: {
          type: 'custom',
          formatter: (price: number) => {
            // Format volume: billions > millions > thousands > base
            if (price >= 1000000) {
              return (price / 1000000).toFixed(1) + 'B';
            } else if (price >= 1000) {
              return (price / 1000).toFixed(1) + 'M';
            } else if (price >= 1) {
              return price.toFixed(1) + 'K';
            } else {
              return price.toFixed(3);
            }
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
      // CRITICAL: Set the series to be visible!
      const visibilityOptions = {
        visible: true,
        priceFormat: {
          type: 'custom',
          formatter: (price: number) => {
            // Format volume: billions > millions > thousands > base
            if (price >= 1000000) {
              return (price / 1000000).toFixed(1) + 'B';
            } else if (price >= 1000) {
              return (price / 1000).toFixed(1) + 'M';
            } else if (price >= 1) {
              return price.toFixed(1) + 'K';
            } else {
              return price.toFixed(3);
            }
          },
        },
      };

      this.series.applyOptions(visibilityOptions);

      this.series.priceScale().applyOptions({
        scaleMargins: settings.scaleMargins || { top: 0.85, bottom: 0 },
        visible: false,  // Hide price labels for volume (we don't need them)
        alignLabels: false,
        autoScale: true,  // CRITICAL: Auto-scale volume to always fit
        mode: 0,  // Normal scale mode
        borderVisible: false,
        entireTextOnly: false,
      });
    } else {
      console.error('VolumePlugin: No series available in setupSeries');
    }
  }

  protected getData(): HistogramData[] {
    try {
      const dataStore = this.getDataStore();
      const candles = dataStore.candles;

      if (candles.length === 0) {
        // PERF: Disabled - console.log('VolumePlugin: No candles available');
        return [];
      }

      // OPTIMIZATION: Memoization check - only recalculate if candles changed
      // Check if we have new candles by comparing count and latest time
      const newestTime = candles.length > 0 ? (candles[candles.length - 1]?.time as number || 0) : 0;
      if (candles.length === this.lastCandleCount && newestTime === this.lastCandleTime) {
        // Data hasn't changed - return cached result
        // PERF: Disabled - console.log(`VolumePlugin: Returning cached data (${this.volumeData.length} bars)`);
        return this.volumeData;
      }

      // PERF: Disabled - console.log(`VolumePlugin: Processing new data (${candles.length} candles, was ${this.lastCandleCount})`);

      // Update memoization markers
      this.lastCandleCount = candles.length;
      this.lastCandleTime = newestTime;

      if (candles.length > 0) {
        // Check volume data in detail
        const candlesWithVolume = candles.filter(c => c.volume && c.volume > 0);

        if (candlesWithVolume.length === 0) {
          // PERF: Disabled - console.error('VolumePlugin: No volume data found in candles');
        }
      }

      const settings = this.settings as VolumePluginSettings;

      // OPTIMIZATION: Pre-cache colors to avoid re-accessing object properties in hot loop
      const upColor = settings.upColor || '#26a69aCC';
      const downColor = settings.downColor || '#ef5350CC';

      // OPTIMIZATION: Build volume data with single pass instead of mapping
      this.volumeData = new Array(candles.length);
      for (let i = 0; i < candles.length; i++) {
        const candle = candles[i];
        const volume = candle.volume || 0;

        // Determine color: green when price up, red when price down
        const isPriceUp = i > 0 ? candle.close >= candles[i - 1].close : true;
        const displayVolume = volume * 1000; // Scale for visibility
        const color = isPriceUp ? upColor : downColor;

        this.volumeData[i] = {
          time: candle.time,
          value: displayVolume,
          color: color
        };
      }

      return this.volumeData;
    } catch (error) {
      // PERF: Disabled - console.error('VolumePlugin: Error getting dataStore:', error);
      return [];
    }
  }

  // Public methods
  forceShow(): void {
    // Make sure we're enabled
    if (!this.enabled) {
      this.enable();
    }

    // Make sure series exists and is visible
    if (this.series) {
      this.series.applyOptions({ visible: true });
    } else {
      console.error('VolumePlugin: No series available to show');
    }

    // Refresh the data
    this.refreshData();
  }

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