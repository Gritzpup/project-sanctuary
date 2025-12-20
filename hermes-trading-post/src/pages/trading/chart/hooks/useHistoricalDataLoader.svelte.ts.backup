import { onMount, onDestroy } from 'svelte';
import type { IChartApi, ISeriesApi, LogicalRangeChangeEventHandler } from 'lightweight-charts';
import { dataStore } from '../stores/dataStore.svelte';
import { chartStore } from '../stores/chartStore.svelte';
import { getCandleCount } from '../../../../lib/chart/TimeframeCompatibility';
import { ChartDebug } from '../utils/debug';

interface UseHistoricalDataLoaderConfig {
  chart: IChartApi | null;
  candleSeries: ISeriesApi<'Candlestick'> | null;
  loadThreshold?: number; // How close to the edge before loading more data (default: 0.15 = 15% for aggressive infinite scroll)
  loadAmount?: number; // Number of additional candles to load per scroll (default: 200 for chunked loading)
  debounceMs?: number; // Debounce time for scroll events (default: 300ms for responsive UI)
}

export function useHistoricalDataLoader(config: UseHistoricalDataLoaderConfig) {
  const {
    chart,
    candleSeries,
    loadThreshold = 0.15, // 🚀 PHASE 11: Increased from 0.1 to 0.15 (15%) for more aggressive loading
    loadAmount = 200,     // 🚀 PHASE 11: Increased from 60 to 200 for chunked loading during scroll
    debounceMs = 300      // 🚀 PHASE 11: Reduced from 500 to 300ms for faster responsiveness
  } = config;
  
  let isLoading = false;
  let debounceTimer: NodeJS.Timeout | null = null;
  let logicalRangeChangeHandler: LogicalRangeChangeEventHandler | null = null;

  function setupHistoricalDataLoading() {
    if (!chart || !candleSeries) {
      ChartDebug.warn('Chart or candleSeries not available for historical data loading');
      return;
    }

    logicalRangeChangeHandler = (logicalRange) => {
      // Debounce the range change events
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }

      debounceTimer = setTimeout(async () => {
        await handleLogicalRangeChange(logicalRange);
      }, debounceMs);
    };

    // Subscribe to logical range changes (user scrolling/zooming)
    chart.timeScale().subscribeVisibleLogicalRangeChange(logicalRangeChangeHandler);
    
    ChartDebug.log('Historical data loader initialized');
  }

  async function handleLogicalRangeChange(logicalRange: any) {
    if (!logicalRange || isLoading) {
      return;
    }

    const candles = dataStore.candles;
    if (candles.length === 0) {
      return;
    }

    // Check if this is a small dataset where all expected candles are already loaded
    // This prevents auto-loading for timeframes like 5m/1H (12 candles) where we already have all the data
    const config = chartStore?.config;

    if (config?.granularity && config?.timeframe) {
      const expectedCandleCount = getCandleCount(config.granularity, config.timeframe);
      const shouldSkip = candles.length < 30 && candles.length >= (expectedCandleCount - 3);

      // If we have a small dataset (< 30 candles) and we already have all expected candles (+3 for live candle + buffer),
      // don't trigger historical auto-loading
      if (shouldSkip) {
        ChartDebug.log('Skipping historical auto-load for small dataset', {
          totalCandles: candles.length,
          expectedCandleCount,
          granularity: config.granularity,
          timeframe: config.timeframe,
          reason: 'All expected candles already loaded'
        });
        return;
      }
    }

    // Check if user is scrolling close to the beginning of the data
    const { from } = logicalRange;
    const totalCandles = candles.length;

    // Calculate how close we are to the beginning (0 = very beginning, 1 = very end)
    const scrollPosition = Math.max(0, from) / totalCandles;

    ChartDebug.log('Scroll position check', {
      from,
      totalCandles,
      scrollPosition: (scrollPosition * 100).toFixed(1) + '%',
      threshold: (loadThreshold * 100).toFixed(0) + '%',
      shouldLoad: scrollPosition <= loadThreshold && from <= totalCandles * loadThreshold
    });

    // If user has scrolled to within the threshold of the beginning, load more historical data
    // This implements infinite scroll pattern for professional trading charts
    if (scrollPosition <= loadThreshold && from <= totalCandles * loadThreshold) {
      ChartDebug.log(`📜 Infinite scroll triggered: ${(scrollPosition * 100).toFixed(1)}% from start (threshold: ${(loadThreshold * 100).toFixed(0)}%)`);
      await loadMoreHistoricalData();
    }
  }

  async function loadMoreHistoricalData(): Promise<boolean> {
    if (isLoading) {
      ChartDebug.log('Already loading historical data, skipping...');
      return false;
    }

    isLoading = true;
    ChartDebug.log(`Loading ${loadAmount} additional historical candles...`);

    try {
      const addedCount = await dataStore.fetchAndPrependHistoricalData(loadAmount);

      if (addedCount > 0) {
        ChartDebug.log(`✅ Infinite scroll: Loaded ${addedCount} candles (total: ${dataStore.candles.length}`);

        // 🚀 PHASE 6 FIX: Cap total loaded candles to prevent crashes
        // Only keep last 1000 candles in memory to avoid rendering 129k+ which crashes
        // This allows zooming but prevents memory bloat
        if (chart && candleSeries) {
          const allCandles = dataStore.candles;
          const MAX_CANDLES_IN_CHART = 1000; // Reasonable limit for chart rendering

          let candlesToDisplay = allCandles;
          if (allCandles.length > MAX_CANDLES_IN_CHART) {
            // Keep the most recent 1000 candles
            candlesToDisplay = allCandles.slice(-MAX_CANDLES_IN_CHART);
            ChartDebug.log(`⚠️ Limiting chart display to ${MAX_CANDLES_IN_CHART} candles (have ${allCandles.length} total loaded)`);
          }

          const formattedCandles = candlesToDisplay.map(candle => ({
            time: candle.time as any,
            open: candle.open,
            high: candle.high,
            low: candle.low,
            close: candle.close,
          }));
          candleSeries.setData(formattedCandles);
        }

        return true;
      } else {
        ChartDebug.log('No additional historical data available');
        return false;
      }
    } catch (error) {
      ChartDebug.error('Failed to load historical data:', error);
      return false;
    } finally {
      isLoading = false;
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
    
    ChartDebug.log('Historical data loader cleaned up');
  }

  // Reactive setup/cleanup
  $: if (chart && candleSeries) {
    cleanup(); // Clean up any existing handlers
    setupHistoricalDataLoading();
  }

  onDestroy(() => {
    cleanup();
  });

  // Export functions for manual control
  return {
    loadMoreHistoricalData,
    isLoading: () => isLoading,
    cleanup
  };
}