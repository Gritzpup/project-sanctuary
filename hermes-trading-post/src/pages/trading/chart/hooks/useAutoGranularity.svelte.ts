// @ts-nocheck - Granularity undefined fallback compatibility
import { onDestroy } from 'svelte';
import type { IChartApi, ISeriesApi, LogicalRangeChangeEventHandler } from 'lightweight-charts';
import { chartStore } from '../stores/chartStore.svelte';
import { dataStore } from '../stores/dataStore.svelte';
import { GRANULARITY_TO_SECONDS } from '../utils/constants';
import { ChartDebug } from '../utils/debug';

interface UseAutoGranularityConfig {
  chart: IChartApi | null;
  candleSeries: ISeriesApi<'Candlestick'> | null;
  enabled?: boolean;
  debounceMs?: number;
}

// Define optimal granularities based on number of visible candles
// Switch granularity when user zooms to see more than ~150 candles
const GRANULARITY_BY_CANDLE_COUNT = [
  { maxCandles: 150,     granularity: '1m',  timeframe: '1H'  },  // < 150 candles: use 1m
  { maxCandles: 150,     granularity: '5m',  timeframe: '6H'  },  // < 150 candles: use 5m
  { maxCandles: 150,     granularity: '15m', timeframe: '1D'  },  // < 150 candles: use 15m
  { maxCandles: 150,     granularity: '1h',  timeframe: '1W'  },  // < 150 candles: use 1h
  { maxCandles: 150,     granularity: '6h',  timeframe: '1M'  },  // < 150 candles: use 6h
  { maxCandles: Infinity, granularity: '1d',  timeframe: '1Y'  }   // > 150 candles: use 1d
];

export function useAutoGranularity(config: UseAutoGranularityConfig) {
  const {
    chart,
    candleSeries,
    enabled = true,
    debounceMs = 300
  } = config;

  let debounceTimer: NodeJS.Timeout | null = null;
  let logicalRangeChangeHandler: LogicalRangeChangeEventHandler | null = null;
  let lastSwitchedGranularity = '';

  function setupAutoGranularity() {
    if (!chart || !candleSeries || !enabled) {
      ChartDebug.warn('Auto-granularity not enabled or chart not available');
      return;
    }

    logicalRangeChangeHandler = (logicalRange) => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }

      debounceTimer = setTimeout(() => {
        handleZoomChange(logicalRange);
      }, debounceMs);
    };

    chart.timeScale().subscribeVisibleLogicalRangeChange(logicalRangeChangeHandler);
    ChartDebug.log('Auto-granularity switching enabled');
  }

  function handleZoomChange(logicalRange: any) {
    if (!logicalRange) return;

    const candles = dataStore.candles;
    if (candles.length === 0) return;

    // Calculate number of visible candles
    const { from, to } = logicalRange;
    const fromIndex = Math.max(0, Math.floor(from));
    const toIndex = Math.min(candles.length - 1, Math.ceil(to));

    if (fromIndex >= toIndex || fromIndex < 0 || toIndex >= candles.length) {
      return;
    }

    const visibleCandleCount = toIndex - fromIndex;
    const currentGranularity = chartStore.config.granularity;


    // Determine if we need to switch granularity
    // Switch UP (to larger granularity) if showing > 150 candles
    // Switch DOWN (to smaller granularity) if showing < 5 candles (very zoomed in)
    // NOTE: Don't switch for small datasets (5m/1H = 12 candles is correct!)
    let newGranularity = currentGranularity;
    let newTimeframe = chartStore.config.timeframe;

    const granularityOrder = ['1m', '5m', '15m', '1h', '6h', '1d'];
    const currentIndex = granularityOrder.indexOf(currentGranularity);

    if (visibleCandleCount > 150 && currentIndex < granularityOrder.length - 1) {
      // Too many candles visible, switch to larger granularity
      newGranularity = granularityOrder[currentIndex + 1];
      // Update timeframe to match
      const timeframeMap: Record<string, string> = { '1m': '1H', '5m': '6H', '15m': '1D', '1h': '1W', '6h': '1M', '1d': '1Y' };
      newTimeframe = timeframeMap[newGranularity] || '1H';
    } else if (visibleCandleCount < 5 && currentIndex > 0) {
      // Very few candles visible (user zoomed in very far), switch to smaller granularity
      // Changed from 50 to 5 to avoid interfering with small datasets like 5m/1H (12 candles)
      newGranularity = granularityOrder[currentIndex - 1];
      const timeframeMap: Record<string, string> = { '1m': '1H', '5m': '6H', '15m': '1D', '1h': '1W', '6h': '1M', '1d': '1Y' };
      newTimeframe = timeframeMap[newGranularity] || '1H';
    }

    // Only switch if granularity actually changed
    if (newGranularity !== currentGranularity && newGranularity !== lastSwitchedGranularity) {

      lastSwitchedGranularity = newGranularity;

      // Update both granularity and timeframe
      chartStore.setGranularity(newGranularity);
      chartStore.setTimeframe(newTimeframe);

      // Trigger data reload with new granularity
      const pair = chartStore.config.pair;
      const candlesToLoad = 300; // Load consistent amount for smooth switching

      ChartDebug.log(`Loading ${candlesToLoad} candles for new granularity ${newGranularity}`);

      // Calculate time range for loading
      const now = Math.floor(Date.now() / 1000);
      const granularitySeconds: Record<string, number> = {
        '1m': 60, '5m': 300, '15m': 900, '30m': 1800, '1h': 3600, '6h': 21600, '1d': 86400
      };
      const seconds = granularitySeconds[newGranularity] || 60;
      const startTime = now - (candlesToLoad * seconds);

      // Load data with new granularity
      dataStore.loadData(pair, newGranularity || '1m', startTime, now, candlesToLoad).then(() => {
        // Reset last switched to allow switching back if user zooms again
        setTimeout(() => {
          lastSwitchedGranularity = '';
        }, 1000);
      }).catch(() => {
        lastSwitchedGranularity = '';
      });
    }
  }

  function cleanup() {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }

    if (chart && logicalRangeChangeHandler) {
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(logicalRangeChangeHandler);
      logicalRangeChangeHandler = null;
    }

    ChartDebug.log('Auto-granularity cleaned up');
  }

  // Reactive setup/cleanup
  $: if (enabled && chart && candleSeries) {
    cleanup();
    setupAutoGranularity();
  } else if (!enabled) {
    cleanup();
  }

  // Don't use onDestroy here since this is called from handleChartReady, not during component init
  // The cleanup function is returned and should be called manually when needed

  return {
    cleanup,
    isEnabled: () => enabled
  };
}
