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
  
  // Temporary flag to disable new auto-scroll logic if it causes issues
  const ENABLE_SMALL_DATASET_AUTO_SCROLL = false; // DISABLED - causing chart to freeze

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
      if (candles.length <= 30 && ENABLE_SMALL_DATASET_AUTO_SCROLL) {
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
          
          if (candles.length > expectedCandleCount) {
            // Show only the most recent candles to maintain the window
            const startIndex = candles.length - expectedCandleCount;
            const visibleCandles = candles.slice(startIndex);
            
            if (visibleCandles.length > 1) {
              const firstVisibleTime = visibleCandles[0].time as number;
              const timeSpan = currentTime - firstVisibleTime;
              const buffer = timeSpan * 0.05; // 5% buffer
              
              chart.timeScale().setVisibleRange({
                from: (firstVisibleTime - buffer) as any,
                to: (currentTime + buffer) as any
              });
              
              console.log(`🎯 Maintained ${expectedCandleCount}-candle window: showing candles ${startIndex + 1}-${candles.length} of ${candles.length} total`);
            }
          } else {
            // Still building up to expected count, show all with padding
            chart.timeScale().setVisibleLogicalRange({
              from: -2,
              to: expectedCandleCount + 2
            });
            
            console.log(`🔄 Building to ${expectedCandleCount} candles: currently showing ${candles.length}`);
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
   * Update live candle with new price data (volume handled by VolumePlugin)
   */
  function updateLiveCandleWithPrice(price: number, chartSeries?: ISeriesApi<'Candlestick'>, volumeSeries?: any, fullCandleData?: any) {
    if (!chartSeries) return;
    
    const candles = dataStore.candles;
    if (candles.length === 0) return;
    
    // Get current minute timestamp
    const now = Date.now();
    const currentMinute = Math.floor(now / 60000) * 60; // Round down to minute in seconds
    const lastCandle = candles[candles.length - 1];
    const lastCandleTime = lastCandle.time as number;
    
    if (currentMinute > lastCandleTime) {
      // New candle needed
      const newCandle: CandlestickData = {
        time: currentMinute as any,
        open: price,
        high: price,
        low: price,
        close: price,
        // Preserve volume data if available, otherwise use 0
        volume: fullCandleData?.volume || 0
      } as any;
      
      // Add to dataStore - this will trigger VolumePlugin update
      const updatedCandles = [...candles, newCandle];
      dataStore.setCandles(updatedCandles);
      
      // Update chart series only (volume handled by plugin)
      chartSeries.setData(updatedCandles);
      statusStore.setNewCandle();
      
      // Maintain 60 candle zoom level after new candle creation
      maintainCandleZoom(chartSeries, updatedCandles);
      
      // Call new candle callback
      if (onNewCandle) {
        onNewCandle(newCandle);
      }
    } else {
      // Update current candle
      const updatedCandles = [...candles];
      const currentCandle = updatedCandles[updatedCandles.length - 1];
      
      const updatedCandle: CandlestickData = {
        ...currentCandle,
        high: Math.max(currentCandle.high, price),
        low: Math.min(currentCandle.low, price),
        close: price,
        // Preserve volume from WebSocket data or keep existing volume
        volume: fullCandleData?.volume !== undefined ? fullCandleData.volume : (currentCandle as any).volume || 0
      } as any;
      
      updatedCandles[updatedCandles.length - 1] = updatedCandle;
      
      // Update dataStore - this will trigger VolumePlugin update
      dataStore.setCandles(updatedCandles);
      
      // Update chart with live candle (volume handled by plugin)
      chartSeries.update(updatedCandle);
      statusStore.setPriceUpdate();
      
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
        // Only update candle price, volume is handled by VolumePlugin
        updateLiveCandleWithPrice(candleData.close, chartSeries, null, candleData);
        statusStore.setPriceUpdate();
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