import { getContext } from 'svelte';
import type { IChartApi, ISeriesApi } from 'lightweight-charts';
import type { PluginManager } from '../plugins';
import { chartStore } from '../stores/chartStore.svelte';
import { dataStore } from '../stores/dataStore.svelte';
import { statusStore } from '../stores/statusStore.svelte';

export interface ChartHookResult {
  chart: IChartApi | null;
  series: ISeriesApi<'Candlestick'> | null;
  pluginManager: PluginManager | null;
  stores: {
    chart: typeof chartStore;
    data: typeof dataStore;
    status: typeof statusStore;
  };
  actions: {
    fitContent: () => void;
    setVisibleRange: (from: number, to: number) => void;
    takeScreenshot: () => Promise<string | null>;
    exportData: () => any[];
  };
}

export function useChart(): ChartHookResult {
  // Try to get chart context
  const context = getContext<any>('chart');
  
  // Get current chart instance from store
  const chartInstance = chartStore.chartInstance;
  const chart = context?.getChart?.() || chartInstance?.api || null;
  const series = context?.getSeries?.() || chartInstance?.series || null;
  const pluginManager = context?.getPluginManager?.() || null;
  
  // Actions
  const actions = {
    fitContent: () => {
      if (chart) {
        chart.timeScale().fitContent();
      }
    },
    
    setVisibleRange: (from: number, to: number) => {
      if (chart) {
        chart.timeScale().setVisibleRange({ from, to });
      }
    },
    
    takeScreenshot: async (): Promise<string | null> => {
      if (!chart) return null;
      
      try {
        const canvas = chart.takeScreenshot();
        return canvas.toDataURL();
      } catch (error) {
        console.error('Failed to take screenshot:', error);
        return null;
      }
    },
    
    exportData: () => {
      return dataStore.candles.map(candle => ({
        time: candle.time,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        volume: candle.volume
      }));
    }
  };
  
  return {
    chart,
    series,
    pluginManager,
    stores: {
      chart: chartStore,
      data: dataStore,
      status: statusStore
    },
    actions
  };
}