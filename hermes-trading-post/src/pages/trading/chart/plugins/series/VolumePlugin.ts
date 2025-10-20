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
  private lastProcessedIndex: number = -1;  // Track last processed candle for incremental updates
  private colorCache: Map<number, { isPriceUp: boolean; color: string }> = new Map();  // Cache volume colors
  private dataStoreUnsubscribe: (() => void) | null = null;  // Track dataStore subscription

  // 🚀 PHASE 14b: Color caching optimization
  private lastCacheClearTime: number = Date.now();
  private CACHE_TTL_MS: number = 30000; // Clear cache every 30 seconds for freshness

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

      // Subscribe to dataStore updates for real-time volume sync
      this.subscribeToDataStoreUpdates();
    } else {
      console.error('VolumePlugin: No series available in setupSeries');
    }
  }

  /**
   * Subscribe to dataStore updates to keep volume candles in sync with price candles
   * This ensures volume candles are updated in real-time as prices update
   */
  private subscribeToDataStoreUpdates(): void {
    try {
      const dataStore = this.getDataStore();
      if (!dataStore) return;

      // Subscribe to data updates
      this.dataStoreUnsubscribe = dataStore.onDataUpdate(() => {
        // When dataStore updates, refresh our volume data
        this.refreshData();
      });
    } catch (error) {
      // PERF: Disabled - console.warn('VolumePlugin: Could not subscribe to dataStore updates:', error);
    }
  }

  /**
   * Cleanup subscription when plugin is destroyed
   */
  override onDestroy(): void {
    if (this.dataStoreUnsubscribe) {
      this.dataStoreUnsubscribe();
      this.dataStoreUnsubscribe = null;
    }
    super.onDestroy();
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

      const settings = this.settings as VolumePluginSettings;
      const upColor = settings.upColor || '#26a69aCC';
      const downColor = settings.downColor || '#ef5350CC';

      // 🚀 PHASE 14b: Check if color cache needs clearing (TTL-based invalidation)
      this.shouldClearColorCache(candles.length);

      // 🚀 PHASE 8: Detect if this is a full initialization or incremental update
      const isFullRecalc = this.lastProcessedIndex === -1 || candles.length > this.lastCandleCount;

      if (isFullRecalc) {
        // Full recalculation: Initialize or reload entire dataset
        // PERF: Disabled - console.log(`VolumePlugin: Full recalculation (${candles.length} candles)`);
        this.volumeData = new Array(candles.length);

        for (let i = 0; i < candles.length; i++) {
          const candle = candles[i];
          const volume = candle.volume || 0;
          const isPriceUp = i > 0 ? candle.close >= candles[i - 1].close : true;

          // Cache the color calculation for this candle
          this.colorCache.set(i, { isPriceUp, color: isPriceUp ? upColor : downColor });

          const displayVolume = volume * 1000;
          const color = this.colorCache.get(i)?.color || upColor;

          this.volumeData[i] = {
            time: candle.time,
            value: displayVolume,
            color: color
          };
        }

        this.lastProcessedIndex = candles.length - 1;
      } else if (candles.length === this.lastCandleCount) {
        // Same number of candles - check if we need color update on last candle
        // This handles case where last candle's price direction changed (open → close)
        const lastIdx = candles.length - 1;
        if (lastIdx > 0 && this.volumeData[lastIdx]) {
          const candle = candles[lastIdx];
          const prevCandle = candles[lastIdx - 1];
          const isPriceUp = candle.close >= prevCandle.close;
          const cachedColor = this.colorCache.get(lastIdx);

          // Only update if color changed (price direction flipped)
          if (!cachedColor || cachedColor.isPriceUp !== isPriceUp) {
            const newColor = isPriceUp ? upColor : downColor;
            this.colorCache.set(lastIdx, { isPriceUp, color: newColor });

            // Update volume data with new color
            const volume = candle.volume || 0;
            const displayVolume = volume * 1000;
            this.volumeData[lastIdx] = {
              time: candle.time,
              value: displayVolume,
              color: newColor
            };
          }
        }
      }

      // Update memoization markers
      this.lastCandleCount = candles.length;
      this.lastCandleTime = newestTime;

      return this.volumeData;
    } catch (error) {
      // PERF: Disabled - console.error('VolumePlugin: Error getting dataStore:', error);
      return [];
    }
  }

  // 🚀 PHASE 14b: Helper method to get color for a candle with caching
  private getColorForCandle(
    index: number,
    candle: any,
    prevCandle: any,
    upColor: string,
    downColor: string
  ): string {
    // Check if cached
    const cached = this.colorCache.get(index);
    if (cached) {
      return cached.color;
    }

    // Calculate new color
    const isPriceUp = prevCandle ? candle.close >= prevCandle.close : true;
    const color = isPriceUp ? upColor : downColor;

    // Cache it
    this.colorCache.set(index, { isPriceUp, color });

    return color;
  }

  // 🚀 PHASE 14b: Check if cache needs clearing due to TTL
  private shouldClearColorCache(candleCount: number): boolean {
    const timeSinceLastClear = Date.now() - this.lastCacheClearTime;
    const cacheSize = this.colorCache.size;

    // Clear if:
    // 1. Cache is 2x larger than current data (stale entries)
    // 2. TTL expired (30 seconds)
    const shouldClear = cacheSize > candleCount * 2 || timeSinceLastClear > this.CACHE_TTL_MS;

    if (shouldClear) {
      this.colorCache.clear();
      this.lastCacheClearTime = Date.now();
    }

    return shouldClear;
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

  /**
   * 🚀 PHASE 8: Direct incremental volume update - bypasses NotificationBatcher delay
   * Used by real-time update handler to immediately render new volume bars
   */
  updateVolumeDirect(newCandles: any[]): void {
    try {
      if (!this.series || newCandles.length === 0) return;

      const settings = this.settings as VolumePluginSettings;
      const upColor = settings.upColor || '#26a69aCC';
      const downColor = settings.downColor || '#ef5350CC';

      // Update only new candles that haven't been processed
      const updateCount = newCandles.length - this.lastProcessedIndex - 1;
      if (updateCount <= 0) return;

      // PERF: Disabled - console.log(`VolumePlugin: Incremental update for ${updateCount} new candles`);

      for (let i = this.lastProcessedIndex + 1; i < newCandles.length; i++) {
        const candle = newCandles[i];
        if (!candle) continue;

        const volume = candle.volume || 0;
        const isPriceUp = i > 0 ? candle.close >= newCandles[i - 1].close : true;
        const displayVolume = volume * 1000;
        const color = isPriceUp ? upColor : downColor;

        // Cache the color for this candle
        this.colorCache.set(i, { isPriceUp, color });

        // Create histogram data point
        const histogramData: HistogramData = {
          time: candle.time,
          value: displayVolume,
          color: color
        };

        // Update series incrementally instead of full setData()
        try {
          this.series.update(histogramData);
        } catch (error) {
          // PERF: Disabled - console.error('VolumePlugin: Error updating histogram:', error);
          // Fallback: Store in array for batch update
          if (!this.volumeData[i]) {
            this.volumeData[i] = histogramData;
          }
        }
      }

      this.lastProcessedIndex = newCandles.length - 1;
    } catch (error) {
      // PERF: Disabled - console.error('VolumePlugin: Error in updateVolumeDirect:', error);
    }
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