/**
 * Data Loading Hook for Chart Components
 * 
 * Handles data fetching, gap detection/filling, and performance monitoring
 * for chart data loading operations.
 */

import { chartStore } from '../stores/chartStore.svelte';
import { dataStore } from '../stores/dataStore.svelte';
import { statusStore } from '../stores/statusStore.svelte';
import { ChartDebug } from '../utils/debug';
import { perfTest } from '../utils/performanceTest';
import { getGranularitySeconds, alignTimeToGranularity } from '../utils/granularityHelpers';
import { getCandleCount } from '../../../../lib/chart/TimeframeCompatibility';
import type { IChartApi, ISeriesApi, CandlestickData } from 'lightweight-charts';

export interface DataLoaderConfig {
  pair: string;
  granularity: string;
  timeframe: string;
  chart?: IChartApi;
  series?: ISeriesApi<'Candlestick'>;
}

export interface UseDataLoaderOptions {
  onDataLoaded?: (candles: CandlestickData[]) => void;
  onGapFilled?: (gapData: CandlestickData[]) => void;
  onError?: (error: string) => void;
}

export function useDataLoader(options: UseDataLoaderOptions = {}) {
  const { onDataLoaded, onGapFilled, onError } = options;

  // ✅ PHASE 5 FIX: Mutex to prevent concurrent loadData() calls
  // This prevents race conditions where multiple parallel loads corrupt dataStore state
  let isLoading = false;

  /**
   * Get period in seconds from timeframe string
   */
  function getPeriodSeconds(period: string): number {
    const periodMap: Record<string, number> = {
      '1H': 3600,       // 1 hour
      '4H': 14400,      // 4 hours
      '6H': 21600,      // 6 hours
      '1D': 86400,      // 1 day
      '5D': 432000,     // 5 days
      '1W': 604800,     // 1 week
      '1M': 2592000,    // ~30 days
      '3M': 7776000,    // ~90 days
      '6M': 15552000,   // ~180 days
      '1Y': 31536000,   // 365 days
      '5Y': 157680000   // 5 years (1825 days)
    };
    return periodMap[period] || 3600;
  }

  /**
   * Create bridge candles to fill gaps in data
   */
  function createBridgeCandles(lastCandleTime: number, currentTime: number, interval: number): CandlestickData[] {
    const bridgeCandles: CandlestickData[] = [];
    const lastCandle = dataStore.candles[dataStore.candles.length - 1];
    
    if (!lastCandle) return bridgeCandles;
    
    const lastPrice = lastCandle.close;
    let bridgeTime = lastCandleTime + interval;
    
    while (bridgeTime < currentTime) {
      bridgeCandles.push({
        time: bridgeTime as any,
        open: lastPrice,
        high: lastPrice,
        low: lastPrice,
        close: lastPrice
      });
      bridgeTime += interval;
    }
    
    return bridgeCandles;
  }

  /**
   * Load initial chart data
   */
  async function loadData(config: DataLoaderConfig): Promise<void> {
    // ✅ PHASE 5 FIX: Early return if already loading
    // Prevents concurrent loadData() calls from corrupting state
    if (isLoading) {
      ChartDebug.warn('[DataLoader] Load already in progress, ignoring concurrent call');
      return;
    }

    isLoading = true;

    const loadStartTime = performance.now();
    perfTest.reset();
    perfTest.mark('loadData-start');

    if (config.timeframe === '3M' && config.granularity === '1d') {
      ChartDebug.critical(`[PERF FLOW START] Loading 3M/1d data at ${new Date().toISOString()}`);
      ChartDebug.critical(`[PERF] Step 1: Starting loadData()`);
    }

    statusStore.setLoading('Loading chart data...');
    chartStore.setLoading(true);

    try {
      const now = Math.floor(Date.now() / 1000);
      
      // ✅ Request ALL available data from database, not just recent timeframe
      const candleCount = getCandleCount(config.granularity, config.timeframe);
      const granularitySeconds = getGranularitySeconds(config.granularity);

      // Align to granularity boundaries to ensure we get complete candles
      const alignedNow = alignTimeToGranularity(now, config.granularity);

      // 🔧 FIX: Calculate start time based on number of candles (120) not period
      // This ensures we load 120 candles regardless of the period setting
      const candlesToLoad = 120; // Always load 120 candles
      const startTime = alignedNow - (candlesToLoad * granularitySeconds);

      ChartDebug.log(`📊 Loading ${config.timeframe} data: ${candleCount} candles for ${config.granularity}`);
      
      // Load data
      perfTest.mark('dataStore-loadData-start');
      // 🚀 PHASE 11: Load exactly 120 candles (show 60 visible, 60 for scrollback)
      // This provides optimal UX with infinite scroll loading more as needed
      const granularityCandles: Record<string, number> = {
        '1m': 120,    // Load 120, show 60 visible
        '5m': 120,    // Load 120, show 60 visible
        '15m': 120,   // Load 120, show 60 visible
        '30m': 120,   // Load 120, show 60 visible
        '1h': 120,    // Load 120, show 60 visible
        '4h': 120,    // Load 120, show 60 visible
        '1d': 120     // Load 120, show 60 visible
      };
      const candleLoadLimit = granularityCandles[config.granularity] || 300;
      ChartDebug.log(`📊 Loading: Starting with ${candleLoadLimit} candles (full range: ${candleCount} candles) for ${config.granularity}`);
      await dataStore.loadData(
        config.pair,
        config.granularity,
        startTime,
        alignedNow,
        candleLoadLimit
      );
      perfTest.measure('DataStore loadData', 'dataStore-loadData-start');
      
      const candles = dataStore.candles;

      // Update chart with loaded data if series is provided
      if (config.series && candles.length > 0) {
        // CRITICAL: Validate and normalize candles before passing to chart to prevent assertion errors
        // lightweight-charts requires:
        // 1. All times must be valid Unix timestamps (in SECONDS, not milliseconds)
        // 2. Data must be sorted ascending by time
        // 3. No duplicate times
        // 4. No zero or negative times
        const validCandles = candles
          .map(c => {
            // Normalize timestamps: convert milliseconds to seconds if needed
            // Timestamps after year 2286 (> 10^10) are in milliseconds
            if (typeof c.time === 'number' && c.time > 10000000000) {
              return { ...c, time: Math.floor(c.time / 1000) };
            }
            return c;
          })
          .filter(c => {
            if (!c || typeof c.time !== 'number') return false;
            // Valid range: year 2020 (1577836800) to year 2030 (1893456000)
            if (c.time < 1577836800 || c.time > 1893456000) return false;
            if (typeof c.close !== 'number' || c.close <= 0) return false;
            return true;
          })
          .sort((a, b) => (a.time as number) - (b.time as number)); // Ensure sorted

        if (validCandles.length === 0) {
          console.warn('⚠️ [DataLoader] No valid candles to display after filtering');
          statusStore.setError('No valid chart data available');
          return;
        }

        if (validCandles.length < candles.length) {
          console.warn(`⚠️ [DataLoader] Filtered out ${candles.length - validCandles.length} invalid candles before chart display`);
        }

        // 🚀 PHASE 6 FIX: Cap chart render to prevent crashes with too many candles
        const MAX_CANDLES_TO_RENDER = 1000;
        let candlesToRender = validCandles;

        if (validCandles.length > MAX_CANDLES_TO_RENDER) {
          // Keep the most recent candles for display
          candlesToRender = validCandles.slice(-MAX_CANDLES_TO_RENDER);
          console.warn(`⚠️ [useDataLoader] Limiting chart display to ${MAX_CANDLES_TO_RENDER} candles (have ${validCandles.length} valid total)`);
        }

        console.log(`[useDataLoader] Setting chart data with ${candlesToRender.length} candles for rendering (${validCandles.length} total loaded)`);
        config.series.setData(candlesToRender);

        // Positioning after setting data - Force 60 candles visible
        if (config.chart && validCandles.length > 0) {
          setTimeout(() => {
            // 🚀 PHASE 6 FIX: Force exactly 60 candles visible regardless of viewport width
            // This makes candles narrow enough to show 60 on initial load
            const totalCandles = candlesToRender.length;

            // Set visible range: show last 60 candles (or all if less than 60)
            const visibleRange = {
              from: Math.max(0, totalCandles - 60),
              to: totalCandles
            };

            config.chart!.timeScale().setVisibleLogicalRange(visibleRange);
          }, 200);
        }
      }
      
      // Set initial ready state
      statusStore.setReady();
      chartStore.setLoading(false);
      
      // Performance warning for slow loads
      const totalTime = performance.now() - loadStartTime;
      if (totalTime > 5000) { // More than 5 seconds
        ChartDebug.critical(`[PERF WARNING] Loading took ${(totalTime/1000).toFixed(1)}s - this is too slow!`);
      }
      
      // Call success callback
      if (onDataLoaded) {
        onDataLoaded(candles);
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error loading data';
      ChartDebug.error('[DataLoader] Failed to load data:', error);
      statusStore.setError(`Failed to load data: ${errorMessage}`);
      chartStore.setLoading(false);

      if (onError) {
        onError(errorMessage);
      }
    } finally {
      // ✅ PHASE 5 FIX: Always reset loading flag
      // Ensures isLoading is cleared even if exception occurs
      isLoading = false;
    }
  }

  /**
   * Check for and fill data gaps
   */
  async function checkAndFillDataGaps(chart?: IChartApi, series?: ISeriesApi<'Candlestick'>): Promise<void> {
    const candles = dataStore.candles;
    if (candles.length === 0) {
      return;
    }
    
    const lastCandle = candles[candles.length - 1];
    const lastCandleTime = lastCandle.time as number;
    const currentTime = Math.floor(Date.now() / 1000);
    const config = chartStore.config;
    
    // Calculate expected time gap based on granularity
    const candleInterval = getGranularitySeconds(config.granularity);
    const timeDiff = currentTime - lastCandleTime;
    
    // If gap is more than 1 candle interval, we need to fill it
    if (timeDiff > candleInterval) {
      ChartDebug.log(`Data gap detected: ${timeDiff} seconds (${Math.floor(timeDiff / candleInterval)} candles)`);
      statusStore.setLoading('Filling data gap...');
      
      try {
        // Try to fetch missing data from API
        const gapData = await dataStore.fetchGapData(lastCandleTime, currentTime);
        
        if (gapData.length > 0) {
          // Merge gap data with existing candles
          const mergedCandles = [...candles, ...gapData];

          // Let dataStore.setCandles handle validation and sorting
          dataStore.setCandles(mergedCandles);

          // Now get the validated sorted data from dataStore
          if (series && dataStore.candles.length > 0) {
            // Double-validate before setting on chart
            const validGapCandles = dataStore.candles
              .map(c => {
                if (typeof c.time === 'number' && c.time > 10000000000) {
                  return { ...c, time: Math.floor(c.time / 1000) };
                }
                return c;
              })
              .filter(c => {
                if (!c || typeof c.time !== 'number') return false;
                if (c.time < 1577836800 || c.time > 1893456000) return false;
                if (typeof c.close !== 'number' || c.close <= 0) return false;
                return true;
              })
              .sort((a, b) => (a.time as number) - (b.time as number));

            if (validGapCandles.length > 0) {
              series.setData(validGapCandles);
            }
          }

          statusStore.setReady();
          ChartDebug.log(`Gap filled with ${gapData.length} candles`);

          if (onGapFilled) {
            onGapFilled(gapData);
          }
        } else {
          // Create bridge candles if no API data available
          const bridgeCandles = createBridgeCandles(lastCandleTime, currentTime, candleInterval);

          if (bridgeCandles.length > 0) {
            const mergedCandles = [...candles, ...bridgeCandles];
            dataStore.setCandles(mergedCandles);

            // Use validated sorted data from dataStore
            if (series && dataStore.candles.length > 0) {
              // Double-validate before setting on chart
              const validBridgeCandles = dataStore.candles
                .map(c => {
                  if (typeof c.time === 'number' && c.time > 10000000000) {
                    return { ...c, time: Math.floor(c.time / 1000) };
                  }
                  return c;
                })
                .filter(c => {
                  if (!c || typeof c.time !== 'number') return false;
                  if (c.time < 1577836800 || c.time > 1893456000) return false;
                  if (typeof c.close !== 'number' || c.close <= 0) return false;
                  return true;
                })
                .sort((a, b) => (a.time as number) - (b.time as number));

              if (validBridgeCandles.length > 0) {
                series.setData(validBridgeCandles);
              }
            }

            ChartDebug.log(`Created ${bridgeCandles.length} bridge candles`);
          }

          statusStore.setReady();
        }
      } catch (error) {
        ChartDebug.error('[DataLoader] Failed to fill gap:', error);
        statusStore.setError('Failed to fill data gap');
        
        if (onError) {
          onError('Failed to fill data gap');
        }
      }
    }
  }

  /**
   * Wait for chart to be ready
   */
  async function waitForChart(getChart: () => IChartApi | null): Promise<IChartApi> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Chart initialization timeout'));
      }, 10000); // 10 second timeout
      
      const checkChart = () => {
        const chart = getChart();
        if (chart) {
          clearTimeout(timeout);
          resolve(chart);
        } else {
          setTimeout(checkChart, 100);
        }
      };
      
      checkChart();
    });
  }

  return {
    loadData,
    checkAndFillDataGaps,
    waitForChart,
    createBridgeCandles,
    getPeriodSeconds
  };
}