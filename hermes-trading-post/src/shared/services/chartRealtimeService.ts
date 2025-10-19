/**
 * @file chartRealtimeService.ts
 * @description WebSocket real-time chart updates
 * Part of Phase 5D: Chart Services Consolidation
 */

import type { CandleData } from '../../types/coinbase';

/**
 * Real-time Chart Updates Service - manages WebSocket subscriptions for live data
 */
export class ChartRealtimeService {
  private ws: WebSocket | null = null;
  private subscriptions: Set<string> = new Set();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 3000;

  /**
   * Connect to WebSocket for real-time updates
   */
  connect(url: string, onMessage: (data: any) => void, onError: (error: Error) => void): void {
    try {
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        console.log(`🟢 WebSocket connected to ${url}`);
        this.reconnectAttempts = 0;
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          onMessage(data);
        } catch (error) {
          console.warn('Failed to parse WebSocket message:', error);
        }
      };

      this.ws.onerror = (event) => {
        console.error('WebSocket error:', event);
        onError(new Error('WebSocket connection error'));
      };

      this.ws.onclose = () => {
        console.log(`🔴 WebSocket disconnected`);
        this.attemptReconnect(url, onMessage, onError);
      };
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
      onError(error as Error);
    }
  }

  /**
   * Subscribe to real-time updates for a pair
   */
  subscribe(pair: string, granularity: string): void {
    const subscriptionKey = `${pair}:${granularity}`;

    if (!this.subscriptions.has(subscriptionKey) && this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          type: 'subscribe',
          pair,
          granularity
        })
      );

      this.subscriptions.add(subscriptionKey);
    }
  }

  /**
   * Unsubscribe from real-time updates
   */
  unsubscribe(pair: string, granularity: string): void {
    const subscriptionKey = `${pair}:${granularity}`;

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          type: 'unsubscribe',
          pair,
          granularity
        })
      );
    }

    this.subscriptions.delete(subscriptionKey);
  }

  /**
   * Get active subscriptions
   */
  getSubscriptions(): string[] {
    return Array.from(this.subscriptions);
  }

  /**
   * Check connection status
   */
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Disconnect from WebSocket
   */
  disconnect(): void {
    if (this.ws) {
      console.log(`🛑 Disconnecting WebSocket`);
      this.ws.close();
      this.ws = null;
      this.subscriptions.clear();
    }
  }

  /**
   * Attempt to reconnect with exponential backoff
   */
  private attemptReconnect(
    url: string,
    onMessage: (data: any) => void,
    onError: (error: Error) => void
  ): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

      console.log(`🔄 Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

      setTimeout(() => {
        this.connect(url, onMessage, onError);
      }, delay);
    } else {
      console.error('❌ Max reconnection attempts reached');
      onError(new Error('Failed to reconnect after maximum attempts'));
    }
  }
}

/**
 * Export singleton instance
 */
export const chartRealtimeService = new ChartRealtimeService();
