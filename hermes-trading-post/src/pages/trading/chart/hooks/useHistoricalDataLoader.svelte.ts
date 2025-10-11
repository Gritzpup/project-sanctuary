import { onMount, onDestroy } from 'svelte';
import type { IChartApi, ISeriesApi, LogicalRangeChangeEventHandler } from 'lightweight-charts';
import { dataStore } from '../stores/dataStore.svelte';
import { chartStore } from '../stores/chartStore.svelte';
import { getCandleCount } from '../../../../lib/chart/TimeframeCompatibility';
import { ChartDebug } from '../utils/debug';

interface UseHistoricalDataLoaderConfig {
  chart: IChartApi | null;
  candleSeries: ISeriesApi<'Candlestick'> | null;
  loadThreshold?: number; // How close to the edge before loading more data (default: 0.1 = 10%)
  loadAmount?: number; // Number of additional candles to load (default: 300)
  debounceMs?: number; // Debounce time for scroll events (default: 500ms)
}

export function useHistoricalDataLoader(config: UseHistoricalDataLoaderConfig) {
  const { 
    chart, 
    candleSeries, 
    loadThreshold = 0.1, 
    loadAmount = 300,
    debounceMs = 500 
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
    console.log('[HistoricalLoader] Checking if should skip auto-load:', {
      hasConfig: !!config,
      granularity: config?.granularity,
      timeframe: config?.timeframe,
      candleCount: candles.length
    });

    if (config?.granularity && config?.timeframe) {
      const expectedCandleCount = getCandleCount(config.granularity, config.timeframe);
      const shouldSkip = candles.length < 30 && candles.length >= (expectedCandleCount - 3);

      console.log('[HistoricalLoader] Skip check:', {
        expectedCandleCount,
        actualCandles: candles.length,
        threshold: expectedCandleCount - 3,
        shouldSkip,
        isSmall: candles.length < 30,
        hasEnough: candles.length >= (expectedCandleCount - 3)
      });

      // If we have a small dataset (< 30 candles) and we already have all expected candles (+3 for live candle + buffer),
      // don't trigger historical auto-loading
      if (shouldSkip) {
        console.log(`🚫 [HistoricalLoader] Skipping auto-load for small dataset: ${candles.length} candles (expected: ${expectedCandleCount})`);
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
      scrollPosition,
      threshold: loadThreshold,
      shouldLoad: scrollPosition <= loadThreshold && from <= totalCandles * loadThreshold
    });

    // If user has scrolled to within the threshold of the beginning, load more historical data
    if (scrollPosition <= loadThreshold && from <= totalCandles * loadThreshold) {
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
        ChartDebug.log(`Successfully loaded ${addedCount} historical candles`);
        
        // Force chart update if we have access to the chart and series
        if (chart && candleSeries) {
          console.log('🔄 Force updating chart with new historical data...');
          const allCandles = dataStore.candles;
          const formattedCandles = allCandles.map(candle => ({
            time: candle.time as any,
            open: candle.open,
            high: candle.high,
            low: candle.low,
            close: candle.close,
          }));
          candleSeries.setData(formattedCandles);
          console.log(`✅ Chart force-updated with ${formattedCandles.length} candles`);
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