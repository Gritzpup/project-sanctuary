/**
 * Real-time Subscription Hook for Chart Components
 * 
 * Handles WebSocket connections, real-time price updates, and live candle management
 * for chart real-time data streaming operations.
 */

import { dataStore } from '../stores/dataStore.svelte';
import { statusStore } from '../stores/statusStore.svelte';
import { chartStore } from '../stores/chartStore.svelte';
import { ChartDebug } from '../utils/debug';
import { getCandleCount } from '../../../../lib/chart/TimeframeCompatibility';
import { getGranularitySeconds } from '../utils/granularityHelpers';
import type { ISeriesApi, CandlestickData } from 'lightweight-charts';

export interface RealtimeSubscriptionConfig {
  pair: string;
  granularity: string;
}

export interface UseRealtimeSubscriptionOptions {
  onPriceUpdate?: (price: number) => void;
  onNewCandle?: (candle: CandlestickData) => void;
  onReconnect?: () => void;
  onError?: (error: string) => void;
}

export function useRealtimeSubscription(options: UseRealtimeSubscriptionOptions = {}) {
  const { onPriceUpdate, onNewCandle, onReconnect, onError } = options;

  // Disable aggressive auto-scroll to prevent snapping
  const ENABLE_SMALL_DATASET_AUTO_SCROLL = false; // DISABLED - causing snapping behavior

  // 🚀 RADICAL OPTIMIZATION: Remove RAF batching for INSTANT updates
  // Ticker updates come so fast that batching adds unnecessary delay
  // Let status store updates happen immediately

  /**
   * Maintains optimal candle count visible in the chart (60 for normal, 12 for small datasets)
   */
  function maintainCandleZoom(chartSeries: ISeriesApi<'Candlestick'>, candles: CandlestickData[]) {
    if (!chartSeries || candles.length === 0) return;
    
    try {
      const currentTime = candles[candles.length - 1].time as number;
      
      // Get chart instance from series
      const chart = (chartSeries as any)._chart || (chartSeries as any).chart;
      if (!chart || !chart.timeScale) return;
      
      // For small datasets (like 5m+1H = 12 candles), maintain original candle count
      // But never apply this to 1m charts to prevent positioning issues
      const config = chartStore?.config;
      const currentGranularity = config?.granularity;
      
      if (candles.length <= 30 && ENABLE_SMALL_DATASET_AUTO_SCROLL && currentGranularity !== '1m') {
        try {
          // Safely determine expected count with fallback
          let expectedCandleCount = 12; // Default for 5m+1H
          
          try {
            if (chartStore?.config?.granularity && chartStore?.config?.timeframe) {
              expectedCandleCount = getCandleCount(chartStore.config.granularity, chartStore.config.timeframe) || 12;
            }
          } catch (configError) {
            console.warn('Could not access chart config, using default candle count:', configError);
          }
          
          if (candles.length >= expectedCandleCount) {
            // For short timeframes like 1H, show expected candles + 1 for live candle
            const timeframe = chartStore?.config?.timeframe;
            const granularity = chartStore?.config?.granularity;
            const candleLimit = timeframe === '1H' ? expectedCandleCount + 1 : expectedCandleCount;
            
            
            // Show the most recent candles to maintain the window  
            const startIndex = Math.max(0, candles.length - candleLimit);
            const visibleCandles = candles.slice(startIndex);
            
            if (visibleCandles.length > 1) {
              const firstVisibleTime = visibleCandles[0].time as number;
              const timeSpan = currentTime - firstVisibleTime;
              const buffer = timeSpan * 0.1; // 10% buffer for better visibility
              
              // Ensure we don't set invalid time ranges
              if (firstVisibleTime > 0 && currentTime > firstVisibleTime) {
                chart.timeScale().setVisibleRange({
                  from: (firstVisibleTime - buffer) as any,
                  to: (currentTime + buffer) as any
                });
                
              }
            }
          } else {
            // Still building up to expected count, show all with minimal padding
            const padding = 1;
            chart.timeScale().setVisibleLogicalRange({
              from: -padding,
              to: Math.max(expectedCandleCount, candles.length) + padding
            });
            
          }
        } catch (smallDatasetError) {
          console.error('Error in small dataset zoom maintenance:', smallDatasetError);
          // Fall back to not maintaining zoom to prevent freezing
          ChartDebug.log(`Skipping zoom maintenance due to error: ${smallDatasetError.message}`);
        }
        return;
      }
      
      // For normal datasets, maintain exactly 60 candles visible
      const maxCandles = 60;
      const startIndex = Math.max(0, candles.length - maxCandles);
      const visibleCandles = candles.slice(startIndex);
      
      if (visibleCandles.length > 1) {
        const firstVisibleTime = visibleCandles[0].time as number;
        const timeSpan = currentTime - firstVisibleTime;
        const buffer = timeSpan * 0.05; // 5% buffer
        
        chart.timeScale().setVisibleRange({
          from: (firstVisibleTime - buffer) as any,
          to: (currentTime + buffer) as any
        });
        
        ChartDebug.log(`Maintained 60 candle zoom: showing ${visibleCandles.length} candles`);
      }
    } catch (error) {
      ChartDebug.error('Error maintaining candle zoom:', error);
    }
  }

  /**
   * Update live candle with new price data AND volume data
   */
  function updateLiveCandleWithPrice(price: number, chartSeries?: ISeriesApi<'Candlestick'>, volumeSeries?: any, fullCandleData?: any) {
    if (!chartSeries) return;

    const candles = dataStore.candles;
    if (candles.length === 0) {
      console.warn('⚠️ [Realtime] No historical candles available, skipping real-time update');
      return;
    }

    const config = chartStore?.config;
    const currentGranularity = config?.granularity || '1m';

    // 🔥 FIX: For ticker updates (no volume), ALWAYS update the existing candle
    // Only candle updates with official timestamps should create new candles
    // Ticker detection: type='ticker' OR time=0 (we set time=0 for tickers to prevent timestamp issues)
    const isTicker = fullCandleData?.type === 'ticker' || fullCandleData?.time === 0 || (!fullCandleData?.volume && fullCandleData?.type === 'ticker');

    if (isTicker) {
      // Ticker update: ALWAYS update the last candle, never create new ones
      // 🔒 Lock the candle reference to prevent race conditions
      const currentCandle = candles[candles.length - 1];

      // Skip ticker updates if we don't have real candle data yet (time would be 0)
      if (!currentCandle || currentCandle.time === 0 || currentCandle.time == null) {
        // Chart hasn't loaded real data yet, skip ticker updates
        return;
      }

      // 🛡️ Safety check: Make sure we're not trying to update a very old candle
      const now = Date.now() / 1000; // Current time in seconds
      // Ensure candleTime is in seconds (could be in milliseconds)
      // Timestamps after year 2286 are in milliseconds (> 10^10), need conversion
      const candleTime = (currentCandle.time as number);
      const candleTimeInSeconds = candleTime > 10000000000 ? candleTime / 1000 : candleTime;
      const candleAge = Math.abs(now - candleTimeInSeconds); // Use absolute value to handle any timestamp format
      const granularitySeconds = getGranularitySeconds(currentGranularity);

      // If candle is more than 2 granularity periods old, skip update to prevent
      // "Cannot update oldest data" error
      if (candleAge > granularitySeconds * 2) {
        // Silently skip - this is normal behavior when chart hasn't loaded yet
        return;
      }

      // Validate currentCandle has all required fields before updating
      if (!currentCandle ||
          currentCandle.open == null ||
          currentCandle.high == null ||
          currentCandle.low == null ||
          currentCandle.close == null) {
        console.warn('[Realtime] Skipping ticker update - currentCandle has null values:', currentCandle);
        return;
      }

      const updatedCandle: CandlestickData = {
        ...currentCandle,
        high: Math.max(currentCandle.high, price),
        low: Math.min(currentCandle.low, price),
        close: price,
        // Keep existing volume for ticker updates
        volume: (currentCandle as any).volume || 0
      } as any;

      try {
        chartSeries.update(updatedCandle);
        statusStore.setPriceUpdate(); // Direct update for instant response

        // Ensure status stays ready during ticker updates
        if (statusStore.status !== 'ready') {
          statusStore.setReady();
        }
      } catch (error) {
        // Silently handle "Cannot update oldest data" errors - they're expected
        // when candles roll over during ticker updates
        if (!(error as Error).message?.includes('Cannot update oldest data')) {
          console.error('[Realtime] Error updating ticker:', error);
        }
      }

      return; // Exit early for ticker updates
    }

    // Get current candle timestamp based on granularity (for official candle updates only)
    const now = Date.now();
    const granularitySeconds = getGranularitySeconds(currentGranularity);
    const currentCandleTime = Math.floor(now / (granularitySeconds * 1000)) * granularitySeconds; // Round down to granularity boundary
    const lastCandle = candles[candles.length - 1];
    const lastCandleTime = lastCandle.time as number;

    if (currentCandleTime > lastCandleTime) {
      // New candle needed
      const newCandle: CandlestickData = {
        time: currentCandleTime as any,
        open: price,
        high: price,
        low: price,
        close: price,
        // Preserve volume data if available, otherwise use 0
        volume: fullCandleData?.volume || 0
      } as any;
      

      // DO NOT call dataStore.setCandles() - it causes the entire database to be replaced!
      // Just update the chart directly
      chartSeries.update(newCandle);

      // Update volume series if available - MUST use exact same time as price candle
      if (volumeSeries && fullCandleData?.volume !== undefined) {
        const volumeData = {
          time: newCandle.time, // ✅ Use exact same time as price candle to prevent desync
          value: fullCandleData.volume * 1000, // Scale volume same as VolumePlugin (1000x)
          color: price >= lastCandle.close ? '#26a69aCC' : '#ef5350CC' // Up/down color (80% opacity)
        };
        volumeSeries.update(volumeData);
      }

      statusStore.setNewCandle();

      // Simple auto-scroll for all charts including 5m

      // DISABLED: Auto-scroll was causing chart to snap on every candle
      // Let the chart maintain its natural 60-candle view without forced scrolling
      // try {
      //   const chart = (chartSeries as any)._chart || (chartSeries as any).chart;
      //   if (chart && chart.timeScale) {
      //     const config = chartStore?.config;
      //     chart.timeScale().scrollToPosition(2, false);
      //   }
      // } catch (error) {
      //   console.error('Error auto-scrolling chart:', error);
      // }

      // Call new candle callback
      if (onNewCandle) {
        onNewCandle(newCandle);
      }
    } else {
      // Update current candle - no array copy needed, just get reference
      const currentCandle = candles[candles.length - 1];

      const updatedCandle: CandlestickData = {
        ...currentCandle,
        high: Math.max(currentCandle.high, price),
        low: Math.min(currentCandle.low, price),
        close: price,
        // Preserve volume from WebSocket data or keep existing volume
        volume: fullCandleData?.volume !== undefined ? fullCandleData.volume : (currentCandle as any).volume || 0
      } as any;

      // DO NOT call dataStore.setCandles() - it causes the entire database to be replaced!
      // Just update the chart directly
      chartSeries.update(updatedCandle);

      // Update volume series if available - MUST use exact same time as price candle
      if (volumeSeries && fullCandleData?.volume !== undefined) {
        const prevCandle = candles.length > 1 ? candles[candles.length - 2] : currentCandle;
        const volumeData = {
          time: updatedCandle.time, // ✅ Use exact same time as price candle to prevent desync
          value: fullCandleData.volume * 1000, // Scale volume same as VolumePlugin (1000x)
          color: price >= prevCandle.close ? '#26a69aCC' : '#ef5350CC' // Up/down color (80% opacity)
        };
        volumeSeries.update(volumeData);
      }

      statusStore.setPriceUpdate(); // Direct update for instant response

      // DISABLED: Auto-scroll was causing chart to snap constantly
      // Let the chart maintain its natural 60-candle view
      // const config = chartStore?.config;
      // if (config?.granularity === '5m') {
      //   try {
      //     const chart = (chartSeries as any)._chart || (chartSeries as any).chart;
      //     if (chart && chart.timeScale) {
      //       chart.timeScale().scrollToPosition(2, false);
      //     }
      //   } catch (error) {
      //     console.error('Error auto-scrolling 5m chart during price update:', error);
      //   }
      // }
      
      // Ensure status stays ready during price updates
      if (statusStore.status !== 'ready') {
        statusStore.setReady();
      }
    }
    
    // Call price update callback
    if (onPriceUpdate) {
      onPriceUpdate(price);
    }
  }

  /**
   * Subscribe to real-time data streams
   */
  function subscribeToRealtime(config: RealtimeSubscriptionConfig, chartSeries?: ISeriesApi<'Candlestick'>, volumeSeries?: any) {
    const { pair, granularity } = config;

    // Use dataStore to connect to backend WebSocket - single source of truth
    dataStore.subscribeToRealtime(
      pair,
      granularity,
      (candleData) => {
        // Update both price AND volume in real-time
        updateLiveCandleWithPrice(candleData.close, chartSeries, volumeSeries, candleData);
        statusStore.setPriceUpdate(); // Direct update for instant response
      },
      () => {
        statusStore.setReady();
        
        if (onReconnect) {
          onReconnect();
        }
      }
    );
    
    // Note: Removed dual WebSocket subscription to avoid conflicts
    // VolumePlugin will handle volume updates through dataStore
  }

  /**
   * Unsubscribe from all real-time data streams
   */
  function unsubscribeFromRealtime() {
    dataStore.unsubscribeFromRealtime();
  }

  /**
   * Check if real-time subscription is active
   */
  function isSubscribed(): boolean {
    return dataStore.realtimeUnsubscribe !== null;
  }

  return {
    subscribeToRealtime,
    unsubscribeFromRealtime,
    updateLiveCandleWithPrice,
    isSubscribed
  };
}