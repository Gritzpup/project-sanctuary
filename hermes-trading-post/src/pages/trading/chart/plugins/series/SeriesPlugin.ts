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
  seriesOptions?: DeepPartial<SeriesOptionsMap[SeriesType]>;
  paneIndex?: number;
}

export abstract class SeriesPlugin<T extends SeriesType = SeriesType> extends Plugin {
  protected series: ISeriesApi<T> | null = null;
  protected seriesType: T;
  protected seriesOptions: DeepPartial<SeriesOptionsMap[T]>;
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
      const chart = this.getChart();
      chart.removeSeries(this.series);
      this.series = null;
    }
  }

  protected updateSeriesOptions(): void {
    if (this.series) {
      this.series.applyOptions(this.seriesOptions);
    }
  }

  // Data management
  protected subscribeToData(): void {
    console.log(`🔔 [SeriesPlugin:${this.config.id}] subscribeToData called`);

    // Subscribe to data updates from dataStore
    const dataStore = this.getDataStore();
    console.log(`🔔 [SeriesPlugin:${this.config.id}] Got dataStore, has ${dataStore.candles?.length || 0} candles`);

    // Initial data load
    console.log(`🔔 [SeriesPlugin:${this.config.id}] Calling initial refreshData...`);
    this.refreshData();

    // ⚠️ DO NOT subscribe to data updates here!
    // This was causing the glitching candles bug - every price update triggered refreshData()
    // which called setData() and replaced the entire dataset, causing historical candles to redraw
    // Real-time updates are handled by useRealtimeSubscription.svelte.ts via chartSeries.update()
    console.log(`🔔 [SeriesPlugin:${this.config.id}] Skipping data update subscription to prevent glitching candles`);
  }

  protected unsubscribeFromData(): void {
    // Unsubscribe from data updates
    if (this.dataUnsubscribe) {
      this.dataUnsubscribe();
      this.dataUnsubscribe = null;
    }
  }

  protected refreshData(): void {
    console.log(`🔄 [SeriesPlugin:${this.config.id}] refreshData called`);
    
    if (!this.series) {
      console.log(`❌ [SeriesPlugin:${this.config.id}] No series available for refresh`);
      return;
    }
    
    console.log(`🔄 [SeriesPlugin:${this.config.id}] Getting data...`);
    const data = this.getData();
    
    if (data && data.length > 0) {
      console.log(`🔄 [SeriesPlugin:${this.config.id}] Setting ${data.length} data points on series`);
      
      // Sort and deduplicate data before setting on series
      const sortedData = data
        .sort((a, b) => (a.time as number) - (b.time as number))
        .filter((item, index, array) => {
          // Keep only the first occurrence of each timestamp
          return index === 0 || item.time !== array[index - 1].time;
        });
      
      console.log(`🔄 [SeriesPlugin:${this.config.id}] Setting ${sortedData.length} sorted/deduped data points (from ${data.length})`);
      this.series.setData(sortedData);
      console.log(`✅ [SeriesPlugin:${this.config.id}] Data updated successfully`);
    } else {
      console.log(`⚠️ [SeriesPlugin:${this.config.id}] No data to set (length: ${data?.length || 0})`);
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