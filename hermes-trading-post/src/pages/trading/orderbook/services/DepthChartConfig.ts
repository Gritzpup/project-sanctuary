/**
 * @file DepthChartConfig.ts
 * @description Chart configuration and initialization
 * Phase 5G: Extract from monolithic DepthChart.svelte
 */

import { ColorType } from 'lightweight-charts';

/**
 * Get default chart options for depth visualization
 */
export function getChartOptions(containerWidth: number, containerHeight: number) {
  return {
    layout: {
      background: { type: ColorType.Solid, color: '#0a0a0a' },
      textColor: '#d1d4dc'
    },
    grid: {
      vertLines: { visible: false },
      horzLines: { visible: false }
    },
    width: containerWidth,
    height: containerHeight - 5, // Reduce height by 5px to lift bottom
    timeScale: {
      visible: false, // Hide built-in time scale
      borderVisible: false,
      leftOffset: 10,
      rightOffset: 10,
      fixLeftEdge: true,
      fixRightEdge: true,
      lockVisibleTimeRangeOnResize: true
    },
    leftPriceScale: {
      visible: false // Disable built-in price scale
    },
    localization: {
      priceFormatter: (price: number) => {
        if (price >= 1000000) {
          return `$${(price / 1000000).toFixed(1)}M`;
        } else if (price >= 1000) {
          return `$${Math.floor(price / 1000)}k`;
        }
        return `$${price.toFixed(0)}`;
      }
    },
    rightPriceScale: {
      visible: false
    },
    crosshair: {
      mode: 1, // Magnet mode
      vertLine: {
        labelVisible: false,
        color: 'rgba(255, 255, 255, 0.3)',
        width: 1,
        style: 2 // Dashed
      },
      horzLine: {
        labelVisible: false,
        color: 'rgba(255, 255, 255, 0.3)',
        width: 1,
        style: 2 // Dashed
      }
    },
    watermark: {
      visible: false // Hide TradingView watermark
    }
  };
}

/**
 * Get bid series options
 */
export function getBidSeriesOptions() {
  return {
    topColor: 'rgba(38, 166, 154, 0.4)',
    bottomColor: 'rgba(38, 166, 154, 0.0)',
    lineColor: 'rgba(38, 166, 154, 1)',
    lineWidth: 2,
    priceLineVisible: false,
    lastValueVisible: false,
    priceScaleId: 'left',
    crosshairMarkerVisible: false,
    lineStyle: 0, // Solid
    lineType: 2 // Curved
  };
}

/**
 * Get ask series options
 */
export function getAskSeriesOptions() {
  return {
    topColor: 'rgba(239, 83, 80, 0.4)',
    bottomColor: 'rgba(239, 83, 80, 0.0)',
    lineColor: 'rgba(239, 83, 80, 1)',
    lineWidth: 2,
    priceLineVisible: false,
    lastValueVisible: false,
    priceScaleId: 'right',
    crosshairMarkerVisible: false,
    lineStyle: 0, // Solid
    lineType: 2 // Curved
  };
}

/**
 * L2 Status states
 */
export type L2StatusState = 'disconnected' | 'waiting' | 'active' | 'error';

export interface L2Status {
  state: L2StatusState;
  label: string;
  message: string;
  lastUpdate: number;
  updatesPerSecond: number;
}

/**
 * Get initial L2 status
 */
export function getInitialL2Status(): L2Status {
  return {
    state: 'disconnected',
    label: 'Connecting',
    message: 'Connecting to L2 data stream...',
    lastUpdate: 0,
    updatesPerSecond: 0
  };
}

/**
 * Update L2 status based on metrics
 */
export function updateL2Status(
  isReady: boolean,
  timeSinceLastUpdate: number,
  updatesPerSecond: number,
  avgLatency: number
): L2Status {
  if (!isReady) {
    return {
      state: 'waiting',
      label: 'Waiting',
      message: 'Waiting for orderbook data...',
      lastUpdate: Date.now(),
      updatesPerSecond: 0
    };
  }

  if (timeSinceLastUpdate > 2000) {
    // No updates for 2 seconds
    return {
      state: 'error',
      label: 'No Data',
      message: `No updates for ${(timeSinceLastUpdate / 1000).toFixed(1)}s`,
      lastUpdate: Date.now(),
      updatesPerSecond: 0
    };
  }

  if (updatesPerSecond >= 8) {
    // Real-time WebSocket
    return {
      state: 'active',
      label: `L2 WebSocket (${updatesPerSecond}/s)`,
      message: `Real-time L2 data: ${updatesPerSecond} updates/sec, ${avgLatency.toFixed(0)}ms latency`,
      lastUpdate: Date.now(),
      updatesPerSecond
    };
  }

  if (updatesPerSecond > 0) {
    // Slow connection
    return {
      state: 'waiting',
      label: `Slow (${updatesPerSecond}/s)`,
      message: `Slow updates: ${updatesPerSecond} updates/sec`,
      lastUpdate: Date.now(),
      updatesPerSecond
    };
  }

  return {
    state: 'disconnected',
    label: 'Disconnected',
    message: 'No data stream',
    lastUpdate: Date.now(),
    updatesPerSecond: 0
  };
}
