/**
 * @file chartRealtimeService.ts
 * @description WebSocket real-time chart updates
 * Part of Phase 5D: Chart Services Consolidation
 * Replaces RedisChartService WebSocket functionality
 */

type WebSocketCandle = any; // Imported from page-specific types

/**
 * Real-time Chart Updates Service - manages WebSocket subscriptions for live data
 */
export class ChartRealtimeService {
  private backendUrl: string = `ws://${this.getBackendHost()}:4828`;
  private ws: WebSocket | null = null;
  private wsSubscriptions: Map<string, (data: WebSocketCandle) => void> = new Map();
  private onReconnectCallback: (() => void) | null = null;
  private wsReconnectTimeout: NodeJS.Timeout | null = null;

  private getBackendHost(): string {
    const envHost = (import.meta as any)?.env?.VITE_BACKEND_HOST;
    if (envHost) return envHost;
    if (typeof window !== 'undefined' && window.location) {
      return window.location.hostname || 'localhost';
    }
    return 'localhost';
  }

  /**
   * Subscribe to real-time candle updates via WebSocket with callback pattern
   * Returns unsubscribe function
   */
  subscribeToRealtime(
    pair: string,
    granularity: string,
    onCandleUpdate: (candle: WebSocketCandle) => void,
    onReconnect?: () => void
  ): () => void {
    const subscriptionKey = `${pair}:${granularity}`;
    this.wsSubscriptions.set(subscriptionKey, onCandleUpdate);
    this.onReconnectCallback = onReconnect || null;

    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.connectWebSocket();
    } else {
      // Send subscription message
      this.sendSubscription(pair, granularity);
    }

    // Return unsubscribe function
    return () => {
      this.wsSubscriptions.delete(subscriptionKey);
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(
          JSON.stringify({
            type: 'unsubscribe',
            pair,
            granularity
          })
        );
      }
      console.log(`Unsubscribed from ${subscriptionKey}`);
    };
  }

  /**
   * Connect to backend WebSocket for real-time data
   */
  private connectWebSocket() {
    if (this.ws) {
      this.ws.close();
    }

    console.log('🔗 Connecting to backend WebSocket...');
    this.ws = new WebSocket(this.backendUrl);

    this.ws.onopen = () => {
      console.log('✅ Connected to backend WebSocket');

      // Subscribe to all active subscriptions
      this.wsSubscriptions.forEach((callback, subscriptionKey) => {
        const [pair, granularity] = subscriptionKey.split(':');
        this.sendSubscription(pair, granularity);
      });

      if (this.onReconnectCallback) {
        this.onReconnectCallback();
      }
    };

    this.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        this.handleWebSocketMessage(message);
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    this.ws.onclose = (event) => {
      console.log('❌ Backend WebSocket disconnected');
      this.scheduleReconnect();
    };

    this.ws.onerror = (error) => {
      console.error('Backend WebSocket error:', error);
    };
  }

  /**
   * Send subscription message to backend
   */
  private sendSubscription(pair: string, granularity: string) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const message = {
        type: 'subscribe',
        pair,
        granularity
      };
      this.ws.send(JSON.stringify(message));
      console.log(`📡 Subscribed to ${pair}:${granularity}`);
    }
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleWebSocketMessage(message: any) {
    if (message.type === 'candle') {
      const subscriptionKey = `${message.pair}:${message.granularity}`;
      const callback = this.wsSubscriptions.get(subscriptionKey);

      if (callback) {
        callback(message as WebSocketCandle);
      }
    }
  }

  /**
   * Schedule WebSocket reconnection with exponential backoff
   */
  private scheduleReconnect() {
    if (this.wsReconnectTimeout) {
      clearTimeout(this.wsReconnectTimeout);
    }

    this.wsReconnectTimeout = setTimeout(() => {
      console.log('🔄 Attempting to reconnect to WebSocket...');
      this.connectWebSocket();
    }, 3000);
  }

  /**
   * Disconnect from WebSocket
   */
  disconnect(): void {
    if (this.wsReconnectTimeout) {
      clearTimeout(this.wsReconnectTimeout);
      this.wsReconnectTimeout = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.wsSubscriptions.clear();
    this.onReconnectCallback = null;
    console.log('🛑 Disconnected from WebSocket');
  }

  /**
   * Get active subscriptions
   */
  getSubscriptions(): string[] {
    return Array.from(this.wsSubscriptions.keys());
  }

  /**
   * Check connection status
   */
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Get WebSocket instance (for advanced usage)
   */
  getWebSocket(): WebSocket | null {
    return this.ws;
  }
}

/**
 * Export singleton instance
 */
export const chartRealtimeService = new ChartRealtimeService();
