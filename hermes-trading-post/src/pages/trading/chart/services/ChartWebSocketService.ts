/**
 * Chart WebSocket Service
 *
 * Centralized WebSocket management for chart data.
 * Eliminates duplicate WebSocket logic across multiple services.
 *
 * Phase 4 Refactoring: Extracted from ChartAPIService and RedisChartService
 */

import type { WebSocketCandle } from '../types/data.types';
import { ChartDebug } from '../utils/debug';
import { statusStore } from '../stores/statusStore.svelte';

export type UnsubscribeFn = () => void;
export type MessageCallback<T = any> = (data: T) => void;
export type ReconnectCallback = () => void;

export interface WebSocketConfig {
  url: string;
  reconnectDelay?: number;
  maxReconnectAttempts?: number;
  debug?: boolean;
}

/**
 * Manages WebSocket connections and subscriptions for chart data
 */
export class ChartWebSocketService {
  private ws: WebSocket | null = null;
  private wsUrl: string;
  private reconnectDelay: number;
  private maxReconnectAttempts: number;
  private reconnectAttempts: number = 0;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private subscriptions: Map<string, MessageCallback> = new Map();
  private onReconnectCallback: ReconnectCallback | null = null;
  private debug: boolean;
  private isIntentionallyClosed: boolean = false;

  constructor(config: WebSocketConfig) {
    this.wsUrl = config.url;
    this.reconnectDelay = config.reconnectDelay || 2000;
    this.maxReconnectAttempts = config.maxReconnectAttempts || Infinity;
    this.debug = config.debug || false;

    if (this.debug) {
      ChartDebug.log(`WebSocket service initialized for ${this.wsUrl}`);
    }
  }

  /**
   * Connect to WebSocket server
   */
  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      if (this.debug) {
        ChartDebug.log('WebSocket already connected');
      }
      return;
    }

    if (this.ws?.readyState === WebSocket.CONNECTING) {
      if (this.debug) {
        ChartDebug.log('WebSocket connection already in progress');
      }
      return;
    }

    this.isIntentionallyClosed = false;

    try {
      if (this.debug) {
        ChartDebug.log(`Connecting to WebSocket: ${this.wsUrl}`);
      }

      this.ws = new WebSocket(this.wsUrl);

      this.ws.onopen = () => this.handleOpen();
      this.ws.onmessage = (event) => this.handleMessage(event);
      this.ws.onerror = (error) => this.handleError(error);
      this.ws.onclose = (event) => this.handleClose(event);
    } catch (error) {
      // PERF: Disabled - console.error('Failed to create WebSocket:', error);
      this.scheduleReconnect();
    }
  }

  /**
   * Subscribe to messages for a specific channel/key
   * @param key - Subscription identifier (e.g., "BTC-USD:1m")
   * @param callback - Callback function for messages
   * @returns Unsubscribe function
   */
  subscribe<T = WebSocketCandle>(key: string, callback: MessageCallback<T>): UnsubscribeFn {
    this.subscriptions.set(key, callback as MessageCallback);

    if (this.debug) {
      ChartDebug.log(`Subscribed to ${key}. Total subscriptions: ${this.subscriptions.size}`);
    }

    // Ensure WebSocket is connected
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.connect();
    }

    // Send subscription message if connection is open
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.sendSubscriptionMessage(key);
    }

    // Return unsubscribe function
    return () => {
      this.unsubscribe(key);
    };
  }

  /**
   * Unsubscribe from a specific channel
   */
  private unsubscribe(key: string): void {
    this.subscriptions.delete(key);

    if (this.debug) {
      ChartDebug.log(`Unsubscribed from ${key}. Remaining: ${this.subscriptions.size}`);
    }

    // Close WebSocket if no more subscriptions
    if (this.subscriptions.size === 0) {
      setTimeout(() => {
        if (this.subscriptions.size === 0 && this.ws) {
          this.disconnect();
        }
      }, 5000); // 5 second grace period
    }
  }

  /**
   * Disconnect and cleanup WebSocket
   */
  disconnect(): void {
    this.isIntentionallyClosed = true;
    this.clearReconnectTimeout();

    if (this.ws) {
      if (this.debug) {
        ChartDebug.log('Disconnecting WebSocket');
      }

      try {
        this.ws.close();
      } catch (error) {
        // PERF: Disabled - console.error('Error closing WebSocket:', error);
      }

      this.ws = null;
    }
  }

  /**
   * Clear all subscriptions
   */
  clearSubscriptions(): void {
    this.subscriptions.clear();
    if (this.debug) {
      ChartDebug.log('Cleared all subscriptions');
    }
  }

  /**
   * Set reconnect callback
   */
  setReconnectCallback(callback: ReconnectCallback): void {
    this.onReconnectCallback = callback;
  }

  /**
   * Get current connection state
   */
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Get number of active subscriptions
   */
  getSubscriptionCount(): number {
    return this.subscriptions.size;
  }

  // Private handlers

  private handleOpen(): void {
    if (this.debug) {
      ChartDebug.log('✅ WebSocket connected');
    }

    this.reconnectAttempts = 0;

    // Re-subscribe to all channels after reconnection
    for (const key of this.subscriptions.keys()) {
      this.sendSubscriptionMessage(key);
    }

    // Call reconnect callback if there are active subscriptions
    if (this.onReconnectCallback && this.subscriptions.size > 0) {
      this.onReconnectCallback();
    }
  }

  private handleMessage(event: MessageEvent): void {
    try {
      const data = JSON.parse(event.data);

      // Route message to appropriate subscribers
      for (const [key, callback] of this.subscriptions.entries()) {
        // Match subscription key to message (implementation depends on your message format)
        // This is a simple example - adjust based on your WebSocket message structure
        if (this.messageMatchesSubscription(data, key)) {
          try {
            callback(data);
          } catch (error) {
            // PERF: Disabled - console.error(`Error in subscription callback for ${key}:`, error);
          }
        }
      }
    } catch (error) {
      // PERF: Disabled - console.error('Failed to parse WebSocket message:', error);
    }
  }

  private handleError(error: Event): void {
    // PERF: Disabled - console.error('🔴 [WebSocket] ERROR:', {
    //   error,
    //   readyState: this.ws?.readyState,
    //   url: this.wsUrl
    // });

    statusStore.setDatabaseActivity('error');
  }

  private handleClose(event: CloseEvent): void {
    if (this.debug) {
      ChartDebug.log(`WebSocket closed: code=${event.code}, reason=${event.reason}`);
    }

    this.ws = null;

    // Only reconnect if closure was not intentional
    if (!this.isIntentionallyClosed && this.subscriptions.size > 0) {
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      // PERF: Disabled - console.error('Max reconnect attempts reached. Giving up.');
      return;
    }

    this.clearReconnectTimeout();

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.min(this.reconnectAttempts, 5); // Exponential backoff cap at 5x

    if (this.debug) {
      ChartDebug.log(`Scheduling reconnect attempt ${this.reconnectAttempts} in ${delay}ms`);
    }

    this.reconnectTimeout = setTimeout(() => {
      if (this.subscriptions.size > 0) {
        this.connect();
      }
    }, delay);
  }

  private clearReconnectTimeout(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }

  private sendSubscriptionMessage(key: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    try {
      // Parse subscription key (e.g., "BTC-USD:1m" -> { pair: "BTC-USD", granularity: "1m" })
      const [pair, granularity] = key.split(':');

      const message = {
        type: 'subscribe',
        pair,
        granularity
      };

      this.ws.send(JSON.stringify(message));

      if (this.debug) {
        ChartDebug.log(`Sent subscription message for ${key}`);
      }
    } catch (error) {
      // PERF: Disabled - console.error(`Failed to send subscription message for ${key}:`, error);
    }
  }

  private messageMatchesSubscription(data: any, subscriptionKey: string): boolean {
    // Extract pair and granularity from subscription key
    const [pair, granularity] = subscriptionKey.split(':');

    // Match based on message structure
    // Adjust this logic based on your actual WebSocket message format
    return (
      data &&
      (data.pair === pair || data.product_id === pair) &&
      (data.granularity === granularity || data.interval === granularity)
    );
  }
}
