import type { IChartApi, ISeriesApi, CandlestickData, Time } from 'lightweight-charts';

export interface ChartConfig {
  theme: 'dark' | 'light';
  timeframe: string;
  granularity: string;
  indicators: string[];
  showVolume: boolean;
  showGrid: boolean;
  showCrosshair: boolean;
}

export interface ChartInstance {
  api: IChartApi;
  series: ISeriesApi<'Candlestick'>;
  volumeSeries?: ISeriesApi<'Histogram'>;
  config: ChartConfig;
}

export interface ChartStatus {
  status: 'initializing' | 'loading' | 'ready' | 'error' | 'price-update' | 'new-candle';
  message?: string;
  timestamp: number;
}

export interface ChartRange {
  from: Time;
  to: Time;
  visibleFrom?: Time;
  visibleTo?: Time;
}

export interface ChartData {
  candles: CandlestickData[];
  visibleCount: number;
  totalCount: number;
  lastUpdate: number;
}

export interface ChartError {
  code: string;
  message: string;
  details?: any;
  timestamp: number;
}

export type ChartEventType = 
  | 'period-change'
  | 'granularity-change'
  | 'data-update'
  | 'range-change'
  | 'error'
  | 'status-change';

export interface ChartEvent {
  type: ChartEventType;
  data?: any;
  timestamp: number;
}