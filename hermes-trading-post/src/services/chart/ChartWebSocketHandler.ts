/**
 * ChartWebSocketHandler - Handles real-time WebSocket data for charts
 * Extracted from the monolithic chartDataFeed.ts
 */

import { coinbaseWebSocket } from '../api/coinbaseWebSocket';
import { CandleAggregator } from '../data/candleAggregator';
import type { CandleData } from '../../types/coinbase';

export class ChartWebSocketHandler {
  private subscribers: Map<string, (data: CandleData, isNew?: boolean, metadata?: any) => void> = new Map();
  private aggregator: CandleAggregator;
  private realtimeUnsubscribe: (() => void) | null = null;
  private wsConnected = false;
  private symbol: string;
  private currentGranularity: string;
  
  constructor(symbol: string = 'BTC-USD', granularity: string = '1m') {
    this.symbol = symbol;
    this.currentGranularity = granularity;
    this.aggregator = new CandleAggregator(granularity);
  }

  /**
   * Connect to WebSocket and start listening for price updates
   */
  connect(): void {
    if (this.wsConnected) {
      return;
    }

    
    // Subscribe to price updates
    coinbaseWebSocket.subscribeTicker(this.symbol);
    
    // Setup price update handler
    this.realtimeUnsubscribe = coinbaseWebSocket.onPrice((price: number) => {
      this.handlePriceUpdate(price);
    });
    
    // Setup candle completion handler
    this.aggregator.onCandleComplete((candle: CandleData) => {
      this.notifySubscribers(candle, true);
    });
    
    this.wsConnected = true;
  }

  /**
   * Disconnect from WebSocket
   */
  disconnect(): void {
    if (this.realtimeUnsubscribe) {
      this.realtimeUnsubscribe();
      this.realtimeUnsubscribe = null;
    }
    
    if (this.wsConnected) {
      coinbaseWebSocket.unsubscribeTicker(this.symbol);
      this.wsConnected = false;
    }
  }

  /**
   * Handle incoming price updates
   */
  private handlePriceUpdate(price: number): void {
    const timestamp = Date.now();
    
    // Update aggregator
    const updatedCandle = this.aggregator.updatePrice(price, timestamp);
    
    if (updatedCandle) {
      // Notify subscribers of updated current candle
      this.notifySubscribers(updatedCandle, false, { isCurrentCandle: true });
    }
  }

  /**
   * Change granularity for aggregation
   */
  setGranularity(granularity: string): void {
    if (this.currentGranularity !== granularity) {
      this.currentGranularity = granularity;
      this.aggregator = new CandleAggregator(granularity);
      
      // Re-setup candle completion handler
      this.aggregator.onCandleComplete((candle: CandleData) => {
        this.notifySubscribers(candle, true);
      });
    }
  }

  /**
   * Subscribe to candle updates
   */
  subscribe(id: string, callback: (data: CandleData, isNew?: boolean, metadata?: any) => void): void {
    this.subscribers.set(id, callback);
  }

  /**
   * Unsubscribe from candle updates
   */
  unsubscribe(id: string): void {
    this.subscribers.delete(id);
  }

  /**
   * Notify all subscribers of new/updated candle
   */
  private notifySubscribers(candle: CandleData, isNew: boolean, metadata?: any): void {
    this.subscribers.forEach(callback => {
      try {
        callback(candle, isNew, metadata);
      } catch (error) {
      }
    });
  }

  /**
   * Get current aggregator state
   */
  getCurrentCandle(): CandleData | null {
    return this.aggregator.getCurrentCandle();
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.wsConnected;
  }

  /**
   * Get connection stats
   */
  getStats(): { connected: boolean, subscribers: number, symbol: string, granularity: string } {
    return {
      connected: this.wsConnected,
      subscribers: this.subscribers.size,
      symbol: this.symbol,
      granularity: this.currentGranularity
    };
  }
}