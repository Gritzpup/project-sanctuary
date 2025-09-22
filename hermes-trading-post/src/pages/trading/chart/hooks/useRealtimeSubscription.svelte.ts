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
   * Update live candle with new price data
   */
  function updateLiveCandleWithPrice(price: number, chartSeries?: ISeriesApi<'Candlestick'>) {
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
        close: price
      };
      
      // Add to dataStore
      const updatedCandles = [...candles, newCandle];
      dataStore.setCandles(updatedCandles);
      
      // Update chart
      chartSeries.setData(updatedCandles);
      statusStore.setNewCandle();
      
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
        close: price
      };
      
      updatedCandles[updatedCandles.length - 1] = updatedCandle;
      dataStore.setCandles(updatedCandles);
      
      // Update chart with live candle
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
  function subscribeToRealtime(config: RealtimeSubscriptionConfig, chartSeries?: ISeriesApi<'Candlestick'>) {
    const { pair, granularity } = config;
    
    // Use dataStore to connect to backend WebSocket instead of Coinbase directly
    dataStore.subscribeToRealtime(
      pair,
      granularity,
      (candleData) => {
        updateLiveCandleWithPrice(candleData.close, chartSeries);
        statusStore.setPriceUpdate();
      },
      () => {
        console.log('🔄 Backend WebSocket reconnected');
        statusStore.setReady();
        
        if (onReconnect) {
          onReconnect();
        }
      }
    );
    
    console.log('✅ Backend WebSocket subscription active');
    
    // Also keep Coinbase for price updates but don't use it for status
    import('../../../../services/api/coinbaseWebSocket').then(({ coinbaseWebSocket }) => {
      console.log('📡 Also subscribing to Coinbase for additional price data');
      
      // Don't update status based on Coinbase - only use backend WebSocket for status
      coinbaseWebSocket.subscribeTicker('BTC-USD');
      
      // Subscribe to ticker updates as backup price source
      const unsubscribe = coinbaseWebSocket.subscribe((tickerData) => {
        if (tickerData.product_id === 'BTC-USD' && tickerData.price) {
          updateLiveCandleWithPrice(parseFloat(tickerData.price), chartSeries);
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