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

// Define optimal granularities based on visible time range (in seconds)
const GRANULARITY_THRESHOLDS = [
  { maxRange: 3600,       granularity: '1m',  timeframe: '1H'  },  // 0-1 hour: use 1m
  { maxRange: 21600,      granularity: '5m',  timeframe: '6H'  },  // 1-6 hours: use 5m
  { maxRange: 86400,      granularity: '15m', timeframe: '1D'  },  // 6-24 hours: use 15m
  { maxRange: 604800,     granularity: '1h',  timeframe: '1W'  },  // 1-7 days: use 1h
  { maxRange: 2592000,    granularity: '6h',  timeframe: '1M'  },  // 7-30 days: use 6h
  { maxRange: Infinity,   granularity: '1d',  timeframe: '1Y'  }   // 30+ days: use 1d
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

    // Calculate visible time range in seconds
    const { from, to } = logicalRange;
    const fromIndex = Math.max(0, Math.floor(from));
    const toIndex = Math.min(candles.length - 1, Math.ceil(to));

    if (fromIndex >= toIndex || fromIndex < 0 || toIndex >= candles.length) {
      return;
    }

    const firstVisibleCandle = candles[fromIndex];
    const lastVisibleCandle = candles[toIndex];

    const visibleTimeRange = lastVisibleCandle.time - firstVisibleCandle.time; // in seconds
    const currentGranularity = chartStore.config.granularity;

    ChartDebug.log('Zoom change detected', {
      visibleTimeRange: `${(visibleTimeRange / 3600).toFixed(2)} hours`,
      visibleCandles: toIndex - fromIndex,
      currentGranularity
    });

    // Determine optimal granularity based on visible time range
    const optimal = GRANULARITY_THRESHOLDS.find(t => visibleTimeRange <= t.maxRange);

    if (!optimal) return;

    const { granularity: optimalGranularity, timeframe: optimalTimeframe } = optimal;

    // Only switch if granularity actually changed and we haven't just switched to it
    if (optimalGranularity !== currentGranularity && optimalGranularity !== lastSwitchedGranularity) {
      console.log(`🔄 [AutoGranularity] Switching from ${currentGranularity} to ${optimalGranularity} (visible range: ${(visibleTimeRange / 3600).toFixed(2)}h)`);

      lastSwitchedGranularity = optimalGranularity;

      // Update both granularity and timeframe
      chartStore.setGranularity(optimalGranularity);
      chartStore.setTimeframe(optimalTimeframe);

      // Trigger data reload with new granularity
      const pair = chartStore.config.pair;
      const granularitySeconds = GRANULARITY_TO_SECONDS[optimalGranularity];
      const candlesToLoad = Math.min(1000, Math.ceil(visibleTimeRange / granularitySeconds) * 2);

      ChartDebug.log(`Loading ${candlesToLoad} candles for new granularity ${optimalGranularity}`);

      // Load data with new granularity
      dataStore.loadData({
        pair,
        granularity: optimalGranularity,
        maxCandles: candlesToLoad
      }).then(() => {
        console.log(`✅ [AutoGranularity] Switched to ${optimalGranularity} successfully`);
      }).catch(err => {
        console.error(`❌ [AutoGranularity] Failed to load data for ${optimalGranularity}:`, err);
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

  onDestroy(() => {
    cleanup();
  });

  return {
    cleanup,
    isEnabled: () => enabled
  };
}
