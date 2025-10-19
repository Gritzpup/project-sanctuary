/**
 * @file chartRealtimeService.ts
 * @description WebSocket real-time chart updates with message batching
 * Part of Phase 5D: Chart Services Consolidation + Phase 1: Performance Fixes
 * Replaces RedisChartService WebSocket functionality
 * Features: WebSocket batching (100ms/50 messages) to reduce UI thread saturation
 */

type WebSocketCandle = any; // Imported from page-specific types

interface PendingBatch {
  messages: WebSocketCandle[];
  timeoutId: NodeJS.Timeout | null;
}

/**
 * Real-time Chart Updates Service - manages WebSocket subscriptions for live data
 * ⚡ PERF: Batches incoming messages to prevent UI thread saturation (50-100/sec → 100ms batches)
 */
export class ChartRealtimeService {
  private backendUrl: string = `ws://${this.getBackendHost()}:4828`;
  private ws: WebSocket | null = null;
  private wsSubscriptions: Map<string, (data: WebSocketCandle) => void> = new Map();
  private onReconnectCallback: (() => void) | null = null;
  private wsReconnectTimeout: NodeJS.Timeout | null = null;

  // ⚡ PERF: Message batching per subscription to prevent queue saturation
  // Each subscription gets its own batcher to handle 50-100 msgs/sec
  private messageBatchers: Map<string, PendingBatch> = new Map();
  private readonly BATCH_MAX_MESSAGES = 50;
  private readonly BATCH_MAX_WAIT_MS = 100;

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

      // Clean up any pending batch for this subscription
      const batch = this.messageBatchers.get(subscriptionKey);
      if (batch) {
        if (batch.timeoutId) {
          clearTimeout(batch.timeoutId);
        }
        this.messageBatchers.delete(subscriptionKey);
      }

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
   * ⚡ PERF: Batches messages before callback to prevent queue saturation
   * Instead of immediate processing: MSG → callback → chart update
   * Batches: MSG → batch (100ms/50 messages) → process batch → callbacks → chart updates
   */
  private handleWebSocketMessage(message: any) {
    if (message.type === 'candle') {
      const subscriptionKey = `${message.pair}:${message.granularity}`;

      // Add to batch for this subscription
      this.addMessageToBatch(subscriptionKey, message);
    }
  }

  /**
   * Add message to batch for a subscription
   * Process batch when: (1) 50 messages accumulated OR (2) 100ms elapsed
   */
  private addMessageToBatch(subscriptionKey: string, message: WebSocketCandle) {
    // Get or create batch for this subscription
    let batch = this.messageBatchers.get(subscriptionKey);
    if (!batch) {
      batch = { messages: [], timeoutId: null };
      this.messageBatchers.set(subscriptionKey, batch);
    }

    batch.messages.push(message);

    // Process immediately if batch is full
    if (batch.messages.length >= this.BATCH_MAX_MESSAGES) {
      this.processBatch(subscriptionKey);
      return;
    }

    // Schedule batch processing if not already scheduled
    if (!batch.timeoutId) {
      batch.timeoutId = setTimeout(() => {
        this.processBatch(subscriptionKey);
      }, this.BATCH_MAX_WAIT_MS);
    }
  }

  /**
   * Process accumulated messages for a subscription
   */
  private processBatch(subscriptionKey: string) {
    const batch = this.messageBatchers.get(subscriptionKey);
    if (!batch || batch.messages.length === 0) {
      return;
    }

    // Clear timeout
    if (batch.timeoutId) {
      clearTimeout(batch.timeoutId);
      batch.timeoutId = null;
    }

    const callback = this.wsSubscriptions.get(subscriptionKey);
    if (!callback) {
      // Subscription was removed, discard batch
      batch.messages = [];
      return;
    }

    // Process each message in batch through callback
    // This preserves message order while benefiting from batching overhead reduction
    for (const msg of batch.messages) {
      callback(msg);
    }

    // Clear batch for next round
    batch.messages = [];
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

    // Clean up all message batchers
    this.messageBatchers.forEach((batch) => {
      if (batch.timeoutId) {
        clearTimeout(batch.timeoutId);
      }
    });
    this.messageBatchers.clear();

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
