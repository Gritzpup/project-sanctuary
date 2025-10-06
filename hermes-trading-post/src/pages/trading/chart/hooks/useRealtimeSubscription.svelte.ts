/**
 * Real-time Subscription Hook for Chart Components
 * 
 * Handles WebSocket connections, real-time price updates, and live candle management
 * for chart real-time data streaming operations.
 */

import { dataStore } from '../stores/dataStore.svelte';
import { statusStore } from '../stores/statusStore.svelte';
import { ChartDebug } from '../utils/debug';
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

  /**
   * Maintains exactly 60 candles visible in the chart
   */
  function maintainCandleZoom(chartSeries: ISeriesApi<'Candlestick'>, candles: CandlestickData[]) {
    if (!chartSeries || candles.length === 0) return;
    
    try {
      const currentTime = candles[candles.length - 1].time as number;
      
      // Get chart instance from series
      const chart = (chartSeries as any)._chart || (chartSeries as any).chart;
      if (!chart || !chart.timeScale) return;
      
      // For small datasets like 5m+1H, DON'T maintain zoom - let chart handle it naturally
      if (candles.length <= 20) {
        ChartDebug.log(`Skipping zoom maintenance for small dataset: ${candles.length} candles`);
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
   * Update live candle with new price data and corresponding volume
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
      
      // Add to dataStore
      const updatedCandles = [...candles, newCandle];
      dataStore.setCandles(updatedCandles);
      
      // Update chart
      chartSeries.setData(updatedCandles);
      statusStore.setNewCandle();
      
      // Update volume series if available
      if (volumeSeries) {
        
        // 🔥 FIX: Use real volume from WebSocket data
        const volume = fullCandleData?.volume || (newCandle as any).volume || 0;
        
        // 🔥 FIX: Use volume-based coloring instead of price-based
        // Compare to previous candle volume to determine color
        let isVolumeUp = true; // Default for new candles
        if (candles.length > 0) {
          const prevVolume = candles[candles.length - 1].volume || 0;
          isVolumeUp = volume >= prevVolume;
        }
        
        const volumeBar = {
          time: newCandle.time,
          value: volume,
          color: isVolumeUp ? '#26a69a80' : '#ef535080'
        };
        
        try {
          volumeSeries.update(volumeBar);
        } catch (error) {
          console.error('Error adding new volume bar:', error);
        }
      }
      
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
      dataStore.setCandles(updatedCandles);
      
      // Update chart with live candle
      chartSeries.update(updatedCandle);
      statusStore.setPriceUpdate();
      
      // Update volume series for current candle if available
      if (volumeSeries) {
        // 🔥 FIX: Use real volume from WebSocket data
        const volume = fullCandleData?.volume || (updatedCandle as any).volume || 0;
        
        // 🔥 FIX: Use volume-based coloring instead of price-based
        // Compare to previous candle volume to determine color
        let isVolumeUp = true; // Default
        if (updatedCandles.length > 1) {
          const prevIndex = updatedCandles.length - 2;
          const prevVolume = updatedCandles[prevIndex].volume || 0;
          isVolumeUp = volume >= prevVolume;
        }
        
        const volumeBar = {
          time: updatedCandle.time,
          value: volume,
          color: isVolumeUp ? '#26a69a80' : '#ef535080'
        };
        
        try {
          volumeSeries.update(volumeBar);
        } catch (error) {
          console.error('Error updating volume bar:', error);
        }
      }
      
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
    
    // Use dataStore to connect to backend WebSocket instead of Coinbase directly
    dataStore.subscribeToRealtime(
      pair,
      granularity,
      (candleData) => {
        updateLiveCandleWithPrice(candleData.close, chartSeries, volumeSeries, candleData);
        statusStore.setPriceUpdate();
      },
      () => {
        statusStore.setReady();
        
        if (onReconnect) {
          onReconnect();
        }
      }
    );
    
    
    // Also keep Coinbase for price updates but don't use it for status
    import('../../../../services/api/coinbaseWebSocket').then(({ coinbaseWebSocket }) => {
      
      // Don't update status based on Coinbase - only use backend WebSocket for status
      coinbaseWebSocket.subscribeTicker('BTC-USD');
      
      // Subscribe to ticker updates as backup price source
      const unsubscribe = coinbaseWebSocket.subscribe((tickerData) => {
        if (tickerData.product_id === 'BTC-USD' && tickerData.price) {
          updateLiveCandleWithPrice(parseFloat(tickerData.price), chartSeries, volumeSeries);
          // Update status to show we're receiving real-time data
          statusStore.setReady();
        }
      });
      
      // Store unsubscribe function for cleanup
      dataStore.realtimeUnsubscribe = unsubscribe;
    }).catch((error) => {
      ChartDebug.error('Failed to load Coinbase WebSocket:', error);
      if (onError) {
        onError('Failed to load backup price feed');
      }
    });
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