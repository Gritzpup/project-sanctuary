import type { Candle, DataRequest, WebSocketCandle } from '../types/data.types';

export class ChartAPIService {
  private baseUrl: string = '/api';
  private wsUrl: string = 'ws://localhost:8080';
  private ws: WebSocket | null = null;
  private wsReconnectTimeout: NodeJS.Timeout | null = null;
  private wsSubscriptions: Map<string, (data: WebSocketCandle) => void> = new Map();

  async initialize() {
    // Initialize any required API connections
    console.log('ChartAPIService: Initialized');
  }

  async fetchCandles(request: DataRequest): Promise<Candle[]> {
    const { pair, granularity, start, end, limit } = request;
    
    // Build query parameters
    const params = new URLSearchParams({
      granularity,
      ...(start && { start: start.toString() }),
      ...(end && { end: end.toString() }),
      ...(limit && { limit: limit.toString() })
    });

    const url = `${this.baseUrl}/candles/${pair}?${params}`;
    console.log(`ChartAPIService: Fetching from ${url}`);

    try {
      const response = await fetch(url);
      
      if (!response.ok) {
        if (response.status === 429) {
          throw new Error('Rate limit exceeded');
        }
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      // Validate and transform response
      if (!Array.isArray(data)) {
        throw new Error('Invalid API response: expected array of candles');
      }

      return data.map(this.transformApiCandle);
    } catch (error) {
      console.error('ChartAPIService: Error fetching candles:', error);
      throw error;
    }
  }

  subscribeToWebSocket(
    pair: string,
    granularity: string,
    onMessage: (candle: WebSocketCandle) => void,
    onError?: (error: Error) => void
  ): { unsubscribe: () => void } {
    const subscriptionKey = `${pair}:${granularity}`;
    
    // Store the callback
    this.wsSubscriptions.set(subscriptionKey, onMessage);

    // Connect WebSocket if not connected
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.connectWebSocket(onError);
    } else {
      // Subscribe to the pair/granularity
      this.sendSubscription(pair, granularity);
    }

    // Return unsubscribe function
    return {
      unsubscribe: () => {
        this.wsSubscriptions.delete(subscriptionKey);
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.sendUnsubscription(pair, granularity);
        }
      }
    };
  }

  private connectWebSocket(onError?: (error: Error) => void) {
    try {
      this.ws = new WebSocket(this.wsUrl);

      this.ws.onopen = () => {
        console.log('ChartAPIService: WebSocket connected');
        this.clearReconnectTimeout();
        
        // Resubscribe to all active subscriptions
        for (const key of this.wsSubscriptions.keys()) {
          const [pair, granularity] = key.split(':');
          this.sendSubscription(pair, granularity);
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'candle') {
            const key = `${data.pair}:${data.granularity}`;
            const callback = this.wsSubscriptions.get(key);
            if (callback) {
              callback(this.transformWebSocketCandle(data));
            }
          }
        } catch (error) {
          console.error('ChartAPIService: Error processing WebSocket message:', error);
        }
      };

      this.ws.onerror = (error) => {
        console.error('ChartAPIService: WebSocket error:', error);
        if (onError) {
          onError(new Error('WebSocket connection error'));
        }
      };

      this.ws.onclose = () => {
        console.log('ChartAPIService: WebSocket disconnected');
        this.scheduleReconnect(onError);
      };
    } catch (error) {
      console.error('ChartAPIService: Error creating WebSocket:', error);
      if (onError) {
        onError(error as Error);
      }
    }
  }

  private sendSubscription(pair: string, granularity: string) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'subscribe',
        pair,
        granularity
      }));
    }
  }

  private sendUnsubscription(pair: string, granularity: string) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'unsubscribe',
        pair,
        granularity
      }));
    }
  }

  private scheduleReconnect(onError?: (error: Error) => void) {
    this.clearReconnectTimeout();
    
    this.wsReconnectTimeout = setTimeout(() => {
      console.log('ChartAPIService: Attempting WebSocket reconnection...');
      this.connectWebSocket(onError);
    }, 5000); // Reconnect after 5 seconds
  }

  private clearReconnectTimeout() {
    if (this.wsReconnectTimeout) {
      clearTimeout(this.wsReconnectTimeout);
      this.wsReconnectTimeout = null;
    }
  }

  private transformApiCandle(candle: any): Candle {
    return {
      time: candle[0] || candle.time,
      low: parseFloat(candle[1] || candle.low),
      high: parseFloat(candle[2] || candle.high),
      open: parseFloat(candle[3] || candle.open),
      close: parseFloat(candle[4] || candle.close),
      volume: parseFloat(candle[5] || candle.volume || '0')
    };
  }

  private transformWebSocketCandle(data: any): WebSocketCandle {
    return {
      time: data.time,
      open: data.open,
      high: data.high,
      low: data.low,
      close: data.close,
      volume: data.volume || 0,
      type: data.candleType || 'update'
    };
  }

  destroy() {
    // Clear all subscriptions
    this.wsSubscriptions.clear();
    
    // Close WebSocket
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    // Clear reconnect timeout
    this.clearReconnectTimeout();
  }
}