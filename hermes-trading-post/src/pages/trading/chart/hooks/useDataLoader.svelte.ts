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

  /**
   * Get period in seconds from timeframe string
   */
  function getPeriodSeconds(period: string): number {
    const periodMap: Record<string, number> = {
      '1H': 3600,       // 1 hour
      '6H': 21600,      // 6 hours
      '1D': 86400,      // 1 day
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
      
      // Calculate appropriate start time based on timeframe
      // Request data for the exact timeframe period
      const timeRange = getPeriodSeconds(config.timeframe);
      const startTime = alignedNow - timeRange;
      
      console.log(`🎯 Loading ${config.granularity} data from database for ${config.timeframe} display`);
      console.log(`⏰ Time alignment: ${now} -> ${alignedNow} (${alignedNow - now}s offset)`);
      console.log(`📅 Requesting data from ${startTime} to ${alignedNow}`);
      
      // Debug for 5m+1H and 15m+1H combinations
      if ((config.granularity === '5m' || config.granularity === '15m') && config.timeframe === '1H') {
        const debugInfo = {
          pair: config.pair,
          granularity: config.granularity,
          timeframe: config.timeframe,
          expectedCandles: candleCount,
          granularitySeconds: granularitySeconds,
          timeRange: `${timeRange} seconds (${timeRange / 60} minutes)`,
          now: `${now} (${new Date(now * 1000).toISOString()})`,
          alignedNow: `${alignedNow} (${new Date(alignedNow * 1000).toISOString()})`,
          start: `${startTime} (${new Date(startTime * 1000).toISOString()})`
        };
        console.log(`🔍 ${config.granularity}+1H Data Loading Debug:`, debugInfo);
      }
      
      // Consolidated debug for 3M/1d (reduce multiple log calls)
      if (config.timeframe === '3M' && config.granularity === '1d') {
        const debugInfo = {
          period: `${config.timeframe} + ${config.granularity} = ${candleCount} candles`,
          timeRange: `${timeRange} seconds = ${timeRange / 86400} days`,
          now: `${now} (${new Date(now * 1000).toISOString()})`,
          start: `${startTime} (${new Date(startTime * 1000).toISOString()})`,
          expectedCandles: candleCount
        };
        ChartDebug.critical('Loading 3M/1d data:', debugInfo);
      }
      
      // Load data
      perfTest.mark('dataStore-loadData-start');
      await dataStore.loadData(
        config.pair,
        config.granularity,
        startTime,
        alignedNow,
        candleCount * 2 // Request 2x expected candles to ensure we have enough
      );
      perfTest.measure('DataStore loadData', 'dataStore-loadData-start');
      
      const candles = dataStore.candles;
      
      // Debug actual results for 5m+1H and 15m+1H combinations
      if ((config.granularity === '5m' || config.granularity === '15m') && config.timeframe === '1H') {
        console.log(`🔍 ${config.granularity}+1H Data Loading Results:`, {
          expectedCandles: candleCount,
          actualCandles: candles.length,
          firstCandle: candles.length > 0 ? new Date((candles[0].time as number) * 1000).toISOString() : 'none',
          lastCandle: candles.length > 0 ? new Date((candles[candles.length - 1].time as number) * 1000).toISOString() : 'none',
          timeSpan: candles.length > 1 ? `${((candles[candles.length - 1].time as number) - (candles[0].time as number)) / 60} minutes` : 'single candle'
        });
      }
      
      // Performance analysis for 3M/1d
      if (config.timeframe === '3M' && config.granularity === '1d') {
        if (candles.length > 0) {
          const firstCandle = candles[0];
          const lastCandle = candles[candles.length - 1];
          const actualDays = ((lastCandle.time as number) - (firstCandle.time as number)) / 86400;
          const visibleDays = ((now + 30) - startTime) / 86400;
          ChartDebug.critical('3M/1d Performance Analysis:', {
            from: new Date(startTime * 1000).toISOString(),
            to: new Date((now + 30) * 1000).toISOString(),
            visibleDays: visibleDays.toFixed(1),
            actualCandles: candles.length,
            expectedCandles: candleCount,
            dataSpan: `${actualDays.toFixed(1)} days`
          });
        }
      }
      
      // Update chart with loaded data if series is provided
      if (config.series && candles.length > 0) {
        // Use all available candles to match volume data
        console.log(`📊 Setting ${candles.length} candles on price series for ${config.granularity}/${config.timeframe}`);
        
        config.series.setData(candles);
        
        // Positioning after setting data - let ChartCanvas handle it
        if (config.chart && candles.length > 0) {
          setTimeout(() => {
            console.log(`📊 useDataLoader: Positioning ${candles.length} candles for ${config.granularity}/${config.timeframe}`);
            // For 1H timeframes, scroll to real-time but don't override chart positioning
            if (config.timeframe === '1H') {
              config.chart!.timeScale().scrollToRealTime();
              console.log(`🎯 useDataLoader: 1H timeframe - scrolled to real-time, ChartCanvas will handle view`);
            } else {
              config.chart!.timeScale().fitContent();
              config.chart!.timeScale().scrollToRealTime();
            }
          }, 200);
        }
        
        // For 5m+1H and 15m+1H debug exactly what we're setting
        if ((config.granularity === '5m' || config.granularity === '15m') && config.timeframe === '1H') {
          console.log(`🔍 ${config.granularity}+1H Candles being set on chart:`, {
            totalFetched: candles.length,
            candlesShown: candles.length,
            expectedCandles: candleCount,
            firstCandle: candles[0] ? new Date((candles[0].time as number) * 1000).toISOString() : 'none',
            lastCandle: candles[candles.length - 1] ? new Date((candles[candles.length - 1].time as number) * 1000).toISOString() : 'none'
          });
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
          const mergedCandles = [...candles, ...gapData].sort(
            (a, b) => (a.time as number) - (b.time as number)
          );
          
          dataStore.setCandles(mergedCandles);
          
          // Update chart series if provided
          if (series) {
            series.setData(mergedCandles);
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
            
            if (series) {
              series.setData(mergedCandles);
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