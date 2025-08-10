import type { IChartApi, ISeriesApi, SeriesType } from 'lightweight-charts';

export type PluginType = 'series' | 'primitive' | 'overlay' | 'indicator';

export interface ChartPlugin {
  id: string;
  name: string;
  type: PluginType;
  version: string;
  initialize(chart: IChartApi): void;
  update(data: any): void;
  destroy(): void;
  isEnabled: boolean;
}

export interface SeriesPlugin extends ChartPlugin {
  type: 'series';
  seriesType: SeriesType;
  series?: ISeriesApi<SeriesType>;
  createSeries(chart: IChartApi): ISeriesApi<SeriesType>;
}

export interface PrimitivePlugin extends ChartPlugin {
  type: 'primitive';
  render(ctx: CanvasRenderingContext2D, width: number, height: number): void;
}

export interface IndicatorPlugin extends ChartPlugin {
  type: 'indicator';
  calculate(data: any[]): any[];
  getSeriesData(): any[];
}

export interface PluginRegistry {
  register(plugin: ChartPlugin): void;
  unregister(pluginId: string): void;
  get(pluginId: string): ChartPlugin | undefined;
  getAll(): ChartPlugin[];
  getByType(type: PluginType): ChartPlugin[];
  enable(pluginId: string): void;
  disable(pluginId: string): void;
}