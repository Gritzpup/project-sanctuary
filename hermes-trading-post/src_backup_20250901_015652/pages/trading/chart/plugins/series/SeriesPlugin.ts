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
    // Subscribe to data updates from dataStore
    const dataStore = this.getDataStore();
    
    // Initial data load
    this.refreshData();
    
    // Subscribe to updates
    // This would be implemented based on your specific store subscription method
  }

  protected unsubscribeFromData(): void {
    // Unsubscribe from data updates
  }

  protected refreshData(): void {
    if (!this.series) return;
    
    const data = this.getData();
    if (data && data.length > 0) {
      this.series.setData(data);
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