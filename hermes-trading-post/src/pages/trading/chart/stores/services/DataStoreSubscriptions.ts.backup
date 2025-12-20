/**
 * @file DataStoreSubscriptions.ts
 * @description WebSocket and event subscriptions for chart data
 * Handles realtime price updates, candle updates, and subscription lifecycle
 */

import type { CandlestickData } from 'lightweight-charts';
import type { WebSocketCandle } from '../../types/data.types';
import { RedisChartService } from '../../services/RedisChartService';
import { orderbookStore } from '../../../orderbook/stores/orderbookStore.svelte';

/**
 * Manages WebSocket and event subscriptions for realtime data
 */
export class DataStoreSubscriptions {
  private dataService = new RedisChartService();
  private realtimeUnsubscribe: (() => void) | null = null;
  private orderbookPriceUnsubscribe: (() => void) | null = null;
  private priceUpdateLoggedOnce = false;

  /**
   * Timestamp validation range (Jan 2020 - Jan 2030)
   */
  private readonly VALID_TIME_START = 1577836800;
  private readonly VALID_TIME_END = 1893456000;

  /**
   * Subscribe to realtime candle and price updates
   * @param pair Trading pair
   * @param granularity Candle granularity
   * @param onCandleUpdate Callback for candle updates
   * @param onReconnect Callback for reconnection events
   * @returns Unsubscribe function
   */
  subscribeToRealtime(
    pair: string,
    granularity: string,
    onCandleUpdate?: (candle: CandlestickData) => void,
    onReconnect?: () => void
  ): () => void {
    // Cleanup existing realtime subscription
    this.unsubscribeFromRealtime();

    // Subscribe to WebSocket candle updates
    this.realtimeUnsubscribe = chartRealtimeService.subscribeToRealtime(
      pair,
      granularity,
      (update: WebSocketCandle) => {
        if (!this.isValidUpdate(update)) {
          return;
        }

        // Process full candle updates (time > 0)
        if (update.time && update.time > 0) {
          const normalizedTime = this.normalizeTimestamp(update.time);

          // Validate timestamp
          if (!this.isValidTimestamp(normalizedTime)) {
            return;
          }

          // Notify callback with processed candle
          if (onCandleUpdate) {
            onCandleUpdate({
              time: normalizedTime as any,
              open: update.open,
              high: update.high,
              low: update.low,
              close: update.close,
              volume: update.volume || 0
            });
          }
        }

        // Notify callback with ticker update (for real-time price)
        if (onCandleUpdate) {
          onCandleUpdate(update as CandlestickData);
        }
      },
      onReconnect
    );

    // Also subscribe to orderbook L2 for instant price updates
    this.subscribeToOrderbookPrices(onCandleUpdate);

    // Return cleanup function
    return () => this.unsubscribeFromRealtime();
  }

  /**
   * Subscribe to orderbook price updates for instant chart updates
   * @param onPriceUpdate Callback for price updates
   */
  private subscribeToOrderbookPrices(onPriceUpdate?: (price: number) => void) {
    // Cleanup existing subscription
    if (this.orderbookPriceUnsubscribe) {
      this.orderbookPriceUnsubscribe();
    }

    this.orderbookPriceUnsubscribe = orderbookStore.subscribeToPriceUpdates(
      (price: number) => {
        // Log once to confirm price updates are working
        if (!this.priceUpdateLoggedOnce) {
          this.priceUpdateLoggedOnce = true;
        }

        // Notify callback with latest price
        if (onPriceUpdate) {
          onPriceUpdate(price);
        }
      }
    );
  }

  /**
   * Unsubscribe from all realtime updates
   */
  unsubscribeFromRealtime(): void {
    if (this.realtimeUnsubscribe) {
      this.realtimeUnsubscribe();
      this.realtimeUnsubscribe = null;
    }

    if (this.orderbookPriceUnsubscribe) {
      this.orderbookPriceUnsubscribe();
      this.orderbookPriceUnsubscribe = null;
    }
  }

  /**
   * Validate WebSocket update
   * @param update Update object
   * @returns True if update is valid
   */
  private isValidUpdate(update: any): boolean {
    if (!update) return false;
    if (typeof update.open !== 'number' || typeof update.close !== 'number') {
      return false;
    }
    return true;
  }

  /**
   * Normalize timestamp to seconds
   * @param time Timestamp (milliseconds or seconds)
   * @returns Normalized timestamp in seconds
   */
  private normalizeTimestamp(time: number): number {
    // Convert milliseconds to seconds if needed
    if (time > 10000000000) {
      return Math.floor(time / 1000);
    }
    return time;
  }

  /**
   * Validate timestamp is within reasonable range
   * @param time Timestamp to validate
   * @returns True if timestamp is valid
   */
  private isValidTimestamp(time: number): boolean {
    return time >= this.VALID_TIME_START && time <= this.VALID_TIME_END;
  }

  /**
   * Check if subscriptions are active
   * @returns True if subscriptions are active
   */
  isSubscribed(): boolean {
    return this.realtimeUnsubscribe !== null;
  }

  /**
   * Reset subscription state
   */
  reset(): void {
    this.unsubscribeFromRealtime();
    this.priceUpdateLoggedOnce = false;
  }
}

// Export singleton instance
export const dataStoreSubscriptions = new DataStoreSubscriptions();
