/**
 * @file ChartConfig.ts
 * @description Chart configuration for DepthChart
 */

import { ColorType } from 'lightweight-charts';

export const CHART_CONFIG = {
  layout: {
    background: { type: ColorType.Solid, color: '#0a0a0a' },
    textColor: '#888',
    fontSize: 11
  },
  grid: {
    vertLines: { visible: false },
    horzLines: { visible: false }
  },
  rightPriceScale: { visible: false },
  leftPriceScale: { visible: false },
  timeScale: {
    visible: false,
    borderVisible: false,
    leftOffset: 10,  // Center the valley by offsetting for hidden price scales
    rightOffset: 10,
    fixLeftEdge: true,
    fixRightEdge: true,
    lockVisibleTimeRangeOnResize: true
  },
  crosshair: { mode: 0 },
  handleScroll: false,
  handleScale: false
};

export const BID_SERIES_CONFIG = {
  lineColor: 'rgb(38, 166, 154)',
  topColor: 'rgba(38, 166, 154, 0.4)',
  bottomColor: 'rgba(38, 166, 154, 0.02)',
  lineWidth: 2,
  priceScaleId: 'left',
  crosshairMarkerVisible: false,
  priceLineVisible: false,  // Hide horizontal price line
  lastValueVisible: false   // Hide last value marker
};

export const ASK_SERIES_CONFIG = {
  lineColor: 'rgb(239, 83, 80)',
  topColor: 'rgba(239, 83, 80, 0.4)',
  bottomColor: 'rgba(239, 83, 80, 0.02)',
  lineWidth: 2,
  priceScaleId: 'left',
  crosshairMarkerVisible: false,
  priceLineVisible: false,  // Hide horizontal price line
  lastValueVisible: false   // Hide last value marker
};

export const CHART_UPDATE_THROTTLE = 200; // Max 5 updates per second