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
      upColor: '#26a69aCC',  // Increased opacity from 80 to CC (80%)
      downColor: '#ef5350CC',  // Increased opacity from 80 to CC (80%)
      opacity: 0.8,
      scaleMargins: {
        top: 0.7,  // Volume uses bottom 30% of chart (was 20%)
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
    console.log(`🔄 [VolumePlugin] setupSeries called`);
    try {
      const chart = this.getChart();
      console.log(`🔄 [VolumePlugin] Chart exists: ${chart ? 'yes' : 'no'}`);
    } catch (e) {
      console.log(`🔄 [VolumePlugin] Chart not available yet:`, e);
    }
    console.log(`🔄 [VolumePlugin] Series exists: ${this.series ? 'yes' : 'no'}`);
    console.log(`🔄 [VolumePlugin] Series type: ${this.seriesType}`);

    // Apply custom settings
    const settings = this.settings as VolumePluginSettings;

    if (this.series) {
      // CRITICAL: Set the series to be visible!
      const visibilityOptions = {
        visible: true,
        priceFormat: {
          type: 'custom',
          formatter: (price: number) => {
            // Format volume in millions/billions
            if (price >= 1000) {
              return (price / 1000).toFixed(1) + 'B';
            } else if (price >= 1) {
              return price.toFixed(1) + 'M';
            } else {
              return price.toFixed(3);
            }
          },
        },
      };

      console.log(`📊 [VolumePlugin] Applying visibility options:`, visibilityOptions);
      this.series.applyOptions(visibilityOptions);

      // Get current options to verify they were applied
      const currentOptions = this.series.options();
      console.log(`📊 [VolumePlugin] Current series options after apply:`, currentOptions);
      console.log(`📊 [VolumePlugin] Series visible property: ${currentOptions.visible}`);

      this.series.priceScale().applyOptions({
        scaleMargins: settings.scaleMargins || { top: 0.7, bottom: 0 },
        visible: false,  // Hide price labels for volume (we don't need them)
        alignLabels: false,
        autoScale: true,
        borderVisible: false,
        entireTextOnly: false,
      });

      console.log(`✅ [VolumePlugin] Series configured with visibility: ${this.series.options().visible}`);
    } else {
      console.error(`❌ [VolumePlugin] No series available in setupSeries!`);
    }
  }

  protected getData(): HistogramData[] {
    try {
      const dataStore = this.getDataStore();
      const candles = dataStore.candles;

      console.log(`🔄 [VolumePlugin] getData called with ${candles.length} candles`);
      console.log(`🔄 [VolumePlugin] Plugin enabled: ${this.enabled}, Series: ${this.series ? 'exists' : 'null'}`);

      if (candles.length === 0) {
        console.log(`⚠️ [VolumePlugin] No candles available yet`);
        return [];
      }
      
      if (candles.length > 0) {
        // Check volume data in detail
        const candlesWithVolume = candles.filter(c => c.volume && c.volume > 0);
        console.log(`🔄 [VolumePlugin] Volume analysis: ${candlesWithVolume.length}/${candles.length} candles have volume > 0`);
        console.log(`🔄 [VolumePlugin] Sample candle volume:`, candles[candles.length - 1].volume);
        console.log(`🔄 [VolumePlugin] First candle:`, candles[0]);
        console.log(`🔄 [VolumePlugin] Last candle:`, candles[candles.length - 1]);
        
        // Log volume range
        if (candlesWithVolume.length > 0) {
          const volumes = candlesWithVolume.map(c => c.volume || 0);
          const minVolume = Math.min(...volumes);
          const maxVolume = Math.max(...volumes);
          console.log(`🔄 [VolumePlugin] Volume range: ${minVolume} to ${maxVolume}`);
          
          // Set global debug for successful volume data
          try {
            document.title = `VOLUME OK - ${candlesWithVolume.length}/${candles.length} range:${minVolume.toFixed(2)}-${maxVolume.toFixed(2)}`;
            (window as any).volumeDebug = { 
              hasVolume: true, 
              candlesWithVolume: candlesWithVolume.length, 
              totalCandles: candles.length,
              minVolume,
              maxVolume
            };
          } catch (e) {}
        } else {
          console.log(`❌ [VolumePlugin] NO VOLUME DATA FOUND IN ANY CANDLES!`);
          // Also log to document title for debugging
          try {
            document.title = `NO VOLUME DATA - ${candlesWithVolume.length}/${candles.length}`;
            // Also try to write to a global debug object
            (window as any).volumeDebug = { hasVolume: false, candlesWithVolume: candlesWithVolume.length, totalCandles: candles.length };
          } catch (e) {}
        }
      }
    } catch (error) {
      console.error(`❌ [VolumePlugin] Error getting dataStore:`, error);
      return [];
    }
    
    const dataStore = this.getDataStore();
    const candles = dataStore.candles;
    
    this.volumeData = candles.map((candle, index) => {
      const settings = this.settings as VolumePluginSettings;
      let volume = candle.volume || 0;

      // 🔥 FIX: Use price-based coloring (green when price up, red when price down)
      let isPriceUp = true; // Default for first candle
      if (index > 0) {
        const prevClose = candles[index - 1].close || 0;
        isPriceUp = candle.close >= prevClose;
      }

      // Scale volume to make it visible (BTC volumes are typically 0.1-100 range)
      // Multiply by 1000 to make them more visible in the histogram
      let displayVolume = volume * 1000;

      // Debug the histogram data being created
      if (index < 3 || index >= candles.length - 3) {
        console.log(`🔄 [VolumePlugin] Creating histogram data point ${index}:`, {
          time: candle.time,
          volume: volume,
          displayVolume: displayVolume,
          close: candle.close,
          color: isPriceUp ? settings.upColor : settings.downColor
        });
      }

      return {
        time: candle.time,
        value: displayVolume,
        color: isPriceUp ? settings.upColor : settings.downColor
      };
    });
    
    
    return this.volumeData;
  }

  // Public methods
  forceShow(): void {
    console.log(`🔥 [VolumePlugin] Force show called`);

    // Make sure we're enabled
    if (!this.enabled) {
      this.enable();
    }

    // Make sure series exists and is visible
    if (this.series) {
      this.series.applyOptions({ visible: true });
      console.log(`🔥 [VolumePlugin] Series visibility set to true`);
    } else {
      console.error(`🔥 [VolumePlugin] No series available to show`);
    }

    // Refresh the data
    this.refreshData();
    console.log(`🔥 [VolumePlugin] Data refreshed`);
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