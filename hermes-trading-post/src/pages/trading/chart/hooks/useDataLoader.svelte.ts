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
import type { IChartApi, ISeriesApi } from 'lightweight-charts';
import type { CandlestickDataWithVolume } from '../stores/services/DataTransformations';

export interface DataLoaderConfig {
  pair: string;
  granularity: string;
  timeframe: string;
  chart?: IChartApi;
  series?: ISeriesApi<'Candlestick'>;
}

export interface UseDataLoaderOptions {
  onDataLoaded?: (candles: CandlestickDataWithVolume[]) => void;
  onGapFilled?: (gapData: CandlestickDataWithVolume[]) => void;
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

    const result = periodMap[period];
    if (!result) {
      return 3600;
    }
    return result;
  }

  /**
   * Create bridge candles to fill gaps in data
   */
  function createBridgeCandles(lastCandleTime: number, currentTime: number, interval: number): CandlestickDataWithVolume[] {
    const bridgeCandles: CandlestickDataWithVolume[] = [];
    const lastCandle = dataStore.candles[dataStore.candles.length - 1];

    if (!lastCandle) return bridgeCandles;

    const lastPrice = lastCandle.close;
    let bridgeTime = lastCandleTime + interval;

    while (bridgeTime < currentTime) {
      bridgeCandles.push({
        time: bridgeTime,
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
      const loadId = Math.random().toString(36).substring(7);
      const now = Math.floor(Date.now() / 1000);

      // ✅ Calculate exact number of candles needed based on granularity + period
      const candleCount = getCandleCount(config.granularity, config.timeframe);
      const granularitySeconds = getGranularitySeconds(config.granularity);
      const periodSeconds = getPeriodSeconds(config.timeframe);

      // 🎯 DEBUG 5Y: Log detailed 5Y data

      // Align to granularity boundaries to ensure we get complete candles
      const alignedNow = alignTimeToGranularity(now, config.granularity);

      // ⚡ FIX: Use period duration instead of candle count for start time calculation
      // For 5Y: use 157,680,000 seconds (5 years), NOT 1825 * 86400 seconds
      // This ensures we load the full requested time period, not just what fits in candle count
      const startTime = alignedNow - periodSeconds;

      // 🎯 FIX: Don't add buffer for long-term timeframes (1Y, 5Y) - load exact amount needed
      const isLongTerm = ['1Y', '5Y'].includes(config.timeframe);
      const candlesToLoad = isLongTerm
        ? Math.max(candleCount, 120) // No buffer for long-term
        : Math.max(candleCount + 60, 120); // +60 buffer for short-term


      ChartDebug.log(`📊 Loading ${config.timeframe} data: ${candleCount} candles needed${isLongTerm ? '' : ' + 60 buffer'} = ${candlesToLoad} total for ${config.granularity}`);

      // Load data
      perfTest.mark('dataStore-loadData-start');
      // Use the calculated candle count instead of hard-coded limits
      const candleLoadLimit = candlesToLoad;
      ChartDebug.log(`📊 Loading: Starting with ${candleLoadLimit} candles (period requires: ${candleCount} candles) for ${config.granularity}`);
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
          statusStore.setError('No valid chart data available');
          return;
        }

        if (validCandles.length < candles.length) {
        }

        // 🚀 PHASE 6 FIX: Cap chart render to prevent crashes with too many candles
        // Increased to 2000 to support 5Y timeframe (1825 candles needed)
        const MAX_CANDLES_TO_RENDER = 2000;
        let candlesToRender = validCandles;

        if (validCandles.length > MAX_CANDLES_TO_RENDER) {
          // Keep the most recent candles for display
          candlesToRender = validCandles.slice(-MAX_CANDLES_TO_RENDER);
        }


        // 🔧 FIX: DO NOT set data on series here - let ChartDataManager handle ALL series updates
        // If we call setData() here AND ChartDataManager also calls it, we get:
        // 1. Duplicate calls
        // 2. Potential data conflicts if they have different data
        // 3. Race conditions where one overwrites the other
        //
        // The flow should be: useDataLoader updates dataStore → ChartDataManager sees update → ChartDataManager calls series.setData()
        // This ensures a single source of truth (ChartDataManager) for series management

        // ⚡ SEAMLESS REFRESH FIX: Set visible candles based on timeframe
        // Short-term: Show 60 candles for detail
        // Long-term (1M+): Zoom all the way out to show full historical view
        if (config.chart && validCandles.length > 0) {
          const longTermPeriods = ['1M', '3M', '6M', '1Y', '5Y'];
          const isLongTerm = longTermPeriods.includes(config.timeframe);

          if (isLongTerm) {
            // Zoom all the way out for long-term timeframes
            // Set visible range to show ALL candles, not just the recent ones
            setTimeout(() => {
              try {
                const totalCandles = candlesToRender.length;
                const visibleRange = {
                  from: 0,
                  to: totalCandles
                };
                ChartDebug.log(`[FIT-LONG-TERM] Setting range 0→${totalCandles} for ${config.timeframe}`);
                config.chart!.timeScale().setVisibleLogicalRange(visibleRange);
                ChartDebug.log(`[FIT-LONG-TERM-DONE] Set visible range for ${config.timeframe}`);
              } catch (err) {
                ChartDebug.log(`[FIT-LONG-TERM-ERROR] Failed to set range: ${err}`);
              }
            }, 800);
          } else {
            // For short-term, show last 60 candles with shorter delay
            setTimeout(() => {
              const totalCandles = candlesToRender.length;
              const visibleRange = {
                from: Math.max(0, totalCandles - 60),
                to: totalCandles
              };
              config.chart!.timeScale().setVisibleLogicalRange(visibleRange);
            }, 200);
          }
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
              // Cast to chart-compatible type - our numeric timestamps work with UTCTimestamp
              series.setData(validGapCandles as any);
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
                // Cast to chart-compatible type - our numeric timestamps work with UTCTimestamp
                series.setData(validBridgeCandles as any);
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