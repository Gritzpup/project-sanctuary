/**
 * @file DepthChartWebSocket.ts
 * @description WebSocket management for DepthChart L2 orderbook data
 * Extracted from DepthChart.svelte to reduce component complexity
 */

import { orderbookStore } from '../stores/orderbookStore.svelte';

export interface WebSocketCallbacks {
  onConnect?: () => void;
  onMessage?: (data: any) => void;
  onError?: (error: any) => void;
  onClose?: () => void;
  onChartUpdate?: () => void;
}

export class DepthChartWebSocket {
  private ws: WebSocket | null = null;
  private lastChartUpdate = 0;
  private callbacks: WebSocketCallbacks;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimer: NodeJS.Timeout | null = null;

  // Chart update throttling
  private readonly CHART_UPDATE_THROTTLE = 2000; // Max 0.5 updates per second

  constructor(callbacks: WebSocketCallbacks = {}) {
    this.callbacks = callbacks;
  }

  connect(): boolean {
    // Check if already connected
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.log('[DepthChartWebSocket] Already connected');
      return true;
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[DepthChartWebSocket] Max reconnection attempts reached');
      return false;
    }

    try {
      console.log('[DepthChartWebSocket] Creating WebSocket connection...');
      this.ws = new WebSocket('wss://ws-feed.exchange.coinbase.com');

      this.ws.onmessage = (event) => this.handleMessage(event);
      this.ws.onerror = (error) => this.handleError(error);
      this.ws.onclose = () => this.handleClose();
      this.ws.onopen = () => this.handleOpen();

      return true;
    } catch (error) {
      console.error('[DepthChartWebSocket] Failed to create WebSocket:', error);
      return false;
    }
  }

  private handleOpen() {
    console.log('[DepthChartWebSocket] Connected, subscribing to BTC-USD L2...');
    this.reconnectAttempts = 0;

    // Subscribe to L2 channel
    this.ws?.send(JSON.stringify({
      type: 'subscribe',
      product_ids: ['BTC-USD'],
      channels: ['level2']
    }));

    this.callbacks.onConnect?.();
  }

  private handleMessage(event: MessageEvent) {
    try {
      const message = JSON.parse(event.data);

      // Pass to callback for processing
      this.callbacks.onMessage?.(message);

      // Handle specific message types
      if (message.type === 'snapshot') {
        console.log('[DepthChartWebSocket] Received L2 snapshot');
        orderbookStore.processSnapshot(message);
        this.throttledChartUpdate();
      } else if (message.type === 'l2update') {
        this.handleLevel2Message(message);
      } else if (message.type === 'error') {
        console.error('[DepthChartWebSocket] Error from exchange:', message);
      }
    } catch (err) {
      console.error('[DepthChartWebSocket] Message parse error:', err);
    }
  }

  private handleError(error: Event) {
    console.error('[DepthChartWebSocket] WebSocket error:', error);
    this.callbacks.onError?.(error);
    this.scheduleReconnect();
  }

  private handleClose() {
    console.log('[DepthChartWebSocket] Connection closed');
    this.callbacks.onClose?.();
    this.scheduleReconnect();
  }

  private scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[DepthChartWebSocket] Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);

    console.log(`[DepthChartWebSocket] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }

  private handleLevel2Message(data: any) {
    if (!data.changes || data.changes.length === 0) return;

    // Process each change
    for (const change of data.changes) {
      const [side, price, size] = change;
      this.handleOrderbookDelta({
        side,
        price: parseFloat(price),
        size: parseFloat(size)
      });
    }

    // Throttled chart update
    this.throttledChartUpdate();
  }

  private handleOrderbookDelta(delta: any) {
    if (!delta || typeof delta.price !== 'number' || typeof delta.size !== 'number') {
      return;
    }

    const isBid = delta.side === 'buy';

    if (delta.size === 0) {
      // Remove level
      orderbookStore.removeLevel(delta.price, isBid);
    } else {
      // Add or update level
      orderbookStore.updateLevel(delta.price, delta.size, isBid);
    }
  }

  private throttledChartUpdate() {
    const now = Date.now();
    if (now - this.lastChartUpdate >= this.CHART_UPDATE_THROTTLE) {
      this.lastChartUpdate = now;
      this.callbacks.onChartUpdate?.();
    }
  }

  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.reconnectAttempts = 0;
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}