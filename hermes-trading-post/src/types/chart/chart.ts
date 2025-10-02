/**
 * @file chart.ts
 * @description Chart and visualization type definitions
 */

import type { Time } from 'lightweight-charts';

// ============================
// Chart Display Types
// ============================

/**
 * Chart configuration options
 */
export interface ChartConfig {
  width: number;
  height: number;
  timeScale: {
    visible: boolean;
    timeVisible: boolean;
    secondsVisible: boolean;
  };
  grid: {
    vertLines: { visible: boolean };
    horzLines: { visible: boolean };
  };
  rightPriceScale: {
    visible: boolean;
    borderVisible: boolean;
  };
  layout: {
    backgroundColor: string;
    textColor: string;
  };
  crosshair: {
    mode: number;
    vertLine: {
      labelVisible: boolean;
    };
    horzLine: {
      labelVisible: boolean;
    };
  };
}

/**
 * Chart series styling options
 */
export interface SeriesConfig {
  upColor: string;
  downColor: string;
  borderVisible: boolean;
  wickUpColor: string;
  wickDownColor: string;
}

/**
 * Volume series configuration
 */
export interface VolumeSeriesConfig {
  upColor: string;
  downColor: string;
  priceFormat: {
    type: 'volume';
  };
  priceScaleId: string;
  scaleMargins: {
    top: number;
    bottom: number;
  };
}

/**
 * Chart marker for trades and signals
 */
export interface ChartMarker {
  time: Time;
  position: 'belowBar' | 'aboveBar' | 'inBar';
  color: string;
  shape: 'circle' | 'square' | 'arrowUp' | 'arrowDown';
  text?: string;
  size?: number;
}

/**
 * Price line configuration
 */
export interface PriceLine {
  price: number;
  color: string;
  lineWidth: number;
  lineStyle: number; // 0 = solid, 1 = dotted, 2 = dashed
  axisLabelVisible: boolean;
  title: string;
}

/**
 * Chart data point for indicators
 */
export interface IndicatorDataPoint {
  time: Time;
  value: number;
  color?: string;
}

/**
 * Moving average line data
 */
export interface MovingAverageData {
  period: number;
  color: string;
  lineWidth: number;
  data: IndicatorDataPoint[];
}

/**
 * Chart theme configuration
 */
export interface ChartTheme {
  background: string;
  textColor: string;
  lineColor: string;
  areaTopColor: string;
  areaBottomColor: string;
  upColor: string;
  downColor: string;
  borderUpColor: string;
  borderDownColor: string;
  wickUpColor: string;
  wickDownColor: string;
}

/**
 * Chart interaction events
 */
export interface ChartEvents {
  onCrosshairMove?: (param: any) => void;
  onClick?: (param: any) => void;
  onVisibleTimeRangeChange?: (newVisibleTimeRange: any) => void;
}

/**
 * Chart legend entry
 */
export interface LegendEntry {
  color: string;
  text: string;
  value?: string | number;
}

/**
 * Chart tooltip data
 */
export interface TooltipData {
  time: Time;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
  indicators?: { [key: string]: number };
}

/**
 * Chart zoom and pan settings
 */
export interface ChartViewport {
  timeRange: {
    from: Time;
    to: Time;
  };
  priceRange?: {
    minValue: number;
    maxValue: number;
  };
}

/**
 * Chart annotation
 */
export interface ChartAnnotation {
  id: string;
  time: Time;
  price: number;
  text: string;
  backgroundColor: string;
  textColor: string;
  borderColor: string;
}

/**
 * Chart overlay configuration
 */
export interface ChartOverlay {
  type: 'line' | 'area' | 'histogram';
  data: IndicatorDataPoint[];
  config: {
    color: string;
    lineWidth?: number;
    priceScaleId?: string;
  };
}