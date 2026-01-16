import { Plugin, type PluginConfig } from '../base/Plugin';
import type { 
  ISeriesApi, 
  SeriesType, 
  SeriesDataItemTypeMap,
  DeepPartial,
  SeriesOptionsMap
} from 'lightweight-charts';

export interface SeriesPluginConfig extends PluginConfig {
  seriesType: SeriesType;
  seriesOptions?: Record<string, any>;
  paneIndex?: number;
}

export abstract class SeriesPlugin<T extends SeriesType = SeriesType> extends Plugin {
  protected series: ISeriesApi<T> | null = null;
  protected seriesType: T;
  protected seriesOptions: Record<string, any>;
  protected paneIndex: number;
  protected dataUnsubscribe: (() => void) | null = null;

  constructor(config: SeriesPluginConfig) {
    super(config);
    this.seriesType = config.seriesType as T;
    this.seriesOptions = config.seriesOptions || {};
    this.paneIndex = config.paneIndex || 0;
  }

  protected async onInitialize(): Promise<void> {
    this.createSeries();
    await this.setupSeries();
    this.subscribeToData();
  }

  protected async onDestroy(): Promise<void> {
    this.unsubscribeFromData();
    this.removeSeries();
  }

  protected onEnable(): void {
    if (this.series) {
      this.series.applyOptions({ visible: true });
      // Force refresh data when enabling
      this.refreshData();
    }
  }

  protected onDisable(): void {
    if (this.series) {
      this.series.applyOptions({ visible: false });
    }
  }

  protected onSettingsUpdate(oldSettings: Record<string, any>, newSettings: Record<string, any>): void {
    this.updateSeriesOptions();
    this.refreshData();
  }

  // Series management
  protected createSeries(): void {
    const chart = this.getChart();

    // Create series based on type
    switch (this.seriesType) {
      case 'Candlestick':
        this.series = chart.addCandlestickSeries(this.seriesOptions) as ISeriesApi<T>;
        break;
      case 'Line':
        this.series = chart.addLineSeries(this.seriesOptions) as ISeriesApi<T>;
        break;
      case 'Area':
        this.series = chart.addAreaSeries(this.seriesOptions) as ISeriesApi<T>;
        break;
      case 'Histogram':
        this.series = chart.addHistogramSeries(this.seriesOptions) as ISeriesApi<T>;
        if (this.series) {
          // Immediately set visible to true for histogram series
          this.series.applyOptions({ visible: true });
        }
        break;
      case 'Bar':
        this.series = chart.addBarSeries(this.seriesOptions) as ISeriesApi<T>;
        break;
      case 'Baseline':
        this.series = chart.addBaselineSeries(this.seriesOptions) as ISeriesApi<T>;
        break;
      default:
        throw new Error(`Unsupported series type: ${this.seriesType}`);
    }
  }

  protected removeSeries(): void {
    if (this.series) {
      try {
        const chart = this.getChart();
        if (chart) {
          chart.removeSeries(this.series);
        }
      } catch (error) {
        // Silently ignore errors when removing series
      } finally {
        this.series = null;
      }
    }
  }

  protected updateSeriesOptions(): void {
    if (this.series) {
      this.series.applyOptions(this.seriesOptions);
    }
  }

  // Data management
  protected subscribeToData(): void {
    // Subscribe to data updates from dataStore
    const dataStore = this.getDataStore();

    // Initial data load
    this.refreshData();

    // ⚠️ DO NOT subscribe to general data updates!
    // This was causing the glitching candles bug - every price update triggered refreshData()
    // which called setData() and replaced the entire dataset, causing historical candles to redraw
    // Real-time updates are handled by useRealtimeSubscription.svelte.ts via chartSeries.update()

    // ✅ BUT we DO need to subscribe to historical data loads
    // Historical data loads require a full refresh to display the new data
    this.dataUnsubscribe = dataStore.onHistoricalDataLoaded(() => {
      this.refreshData();
    });
  }

  protected unsubscribeFromData(): void {
    // Unsubscribe from data updates
    if (this.dataUnsubscribe) {
      this.dataUnsubscribe();
      this.dataUnsubscribe = null;
    }
  }

  protected refreshData(): void {
    if (!this.series) {
      return;
    }

    // ✅ OPTIMIZATION: Debounce data refresh to prevent excessive recalculations
    // This prevents volume data processing from blocking renders during rapid data updates
    // BUT: Always execute immediately to ensure data is applied (no debounce)
    // The lightweight-charts library handles rendering efficiently

    this.performRefreshData();
  }

  private performRefreshData(): void {
    if (!this.series) {
      return;
    }

    const data = this.getData();

    if (data && data.length > 0) {
      // Sort and deduplicate data before setting on series
      const sortedData = data
        .sort((a, b) => (a.time as number) - (b.time as number))
        .filter((item, index, array) => {
          // Keep only the first occurrence of each timestamp
          return index === 0 || item.time !== array[index - 1].time;
        });

      // ✅ OPTIMIZATION: Single setData() call instead of clear+set
      // This is more efficient and prevents flickering during updates
      this.series.setData(sortedData);
    } else {
      // ⚠️ CRITICAL: Only clear series if it's NOT the main candlestick series
      // Clearing the candlestick series when data is empty will remove all visible candles!
      // This happens if getData() returns empty before data is loaded
      // Don't call setData([]) - this would clear the chart!
      // this.series.setData([]);
    }
  }

  // Abstract methods
  protected abstract setupSeries(): Promise<void>;
  protected abstract getData(): SeriesDataItemTypeMap[T][];

  // Getters
  getSeries(): ISeriesApi<T> | null {
    return this.series;
  }

  getSeriesType(): T {
    return this.seriesType;
  }
}