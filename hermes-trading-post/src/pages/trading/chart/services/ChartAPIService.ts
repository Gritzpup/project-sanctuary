import type { Candle, DataRequest, WebSocketCandle } from '../types/data.types';
import { ChartDebug } from '../utils/debug';
import { perfTest } from '../utils/performanceTest';
import { getGranularitySeconds } from '../utils/granularityHelpers';
import { logger } from '../../../../services/logging';
import { statusStore } from '../stores/statusStore.svelte';
import { getBackendWsUrl } from '../../../../utils/backendConfig';

export class ChartAPIService {
  private wsUrl: string = getBackendWsUrl(); // Backend WebSocket for status/data sync
  private ws: WebSocket | null = null;
  private wsReconnectTimeout: NodeJS.Timeout | null = null;
  private wsSubscriptions: Map<string, (data: WebSocketCandle) => void> = new Map();
  private onReconnectCallback: (() => void) | null = null;

  constructor() {
    // No initialization needed - all data fetching now goes through backend API
  }

  async initialize() {
    // Initialize any required API connections
    ChartDebug.log('Initialized');
  }

  async fetchCandles(request: DataRequest): Promise<Candle[]> {
    const { pair, granularity, start, end, limit } = request;
    const fetchStartTime = performance.now();
    perfTest.mark('fetchCandles-start');

    logger.debug(`fetchCandles called for ${pair} ${granularity}`, {}, 'ChartAPIService');
    if (start && end) {
      logger.debug(`Time range: ${new Date(start * 1000).toISOString()} to ${new Date(end * 1000).toISOString()}`, {}, 'ChartAPIService');
    }

    // Log performance start for 3M/1d
    if (granularity === '1d' || granularity === '1D') {
      ChartDebug.critical(`[PERF START] fetchCandles for ${pair} ${granularity} at ${new Date().toISOString()}`);
    }

    try {
      // ✅ REDIS OPTIMIZATION: Fetch from backend API which serves from Redis cache
      // This eliminates duplicate Coinbase API calls and uses pre-cached historical candles
      // The backend's ContinuousCandleUpdater keeps Redis updated with official Coinbase candles

      const granularitySeconds = getGranularitySeconds(granularity);
      ChartDebug.log(`📊 Fetching from Redis via backend: ${pair} ${granularity} (${granularitySeconds}s)`);

      perfTest.mark('redis-api-start');
      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4828';
      const apiUrl = `${backendUrl}/api/candles/${pair}/${granularity}?start=${start}&end=${end}`;

      const response = await fetch(apiUrl, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Backend API error: ${response.statusText}`);
      }

      const result = await response.json();
      perfTest.measure('Redis API fetch', 'redis-api-start');

      if (!result.success || !result.data) {
        throw new Error('Invalid response from backend candle API');
      }

      const allCandles: Candle[] = result.data;

      // Debug logging for 1d granularity
      if (granularity === '1d' || granularity === '1D') {
        const debugData: any = {
          totalReceived: allCandles.length
        };

        if (allCandles.length > 0) {
          debugData.firstCandle = new Date(allCandles[0].time * 1000).toISOString();
          debugData.lastCandle = new Date(allCandles[allCandles.length - 1].time * 1000).toISOString();
        }

        ChartDebug.critical('API response for 1d', debugData);
      }

      // Measure total API time
      perfTest.measure('Total API fetchCandles', 'fetchCandles-start');
      
      // Transform to our Candle format
      const transformedCandles = allCandles.map((candle: any) => ({
        time: candle.time,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        volume: candle.volume || 0
      }));
      
      
      if (granularity === '1d' || granularity === '1D') {
        ChartDebug.critical(`[PERF END] fetchCandles completed in ${performance.now() - fetchStartTime}ms`);
        ChartDebug.critical(`[PERF] Returned ${transformedCandles.length} candles`);
      }
      
      return transformedCandles;
    } catch (error) {
      ChartDebug.error('Error fetching candles:', error);
      throw error;
    }
  }

  subscribeToWebSocket(
    pair: string,
    granularity: string,
    onMessage: (candle: WebSocketCandle) => void,
    onError?: (error: Error) => void,
    onReconnect?: () => void
  ): { unsubscribe: () => void } {
    
    // Store callbacks for reconnection
    this.onReconnectCallback = onReconnect || null;
    
    // Store the subscription first
    const subscriptionKey = `${pair}:${granularity}`;
    this.wsSubscriptions.set(subscriptionKey, onMessage);
    
    // Connect to our backend WebSocket (will reuse existing if available)
    this.connectWebSocket(onError);
    
    // If WebSocket is already open, send subscription immediately
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.sendSubscription(pair, granularity);
    }


    // Update status store
    try {
      statusStore.setWebSocketConnected(true);
    } catch (error) {
    }
    
    // Return unsubscribe function
    return {
      unsubscribe: () => {
        this.wsSubscriptions.delete(subscriptionKey);
        
        // Send unsubscription to backend
        this.sendUnsubscription(pair, granularity);
        
        // Delay closing WebSocket to allow for quick resubscriptions
        if (this.wsSubscriptions.size === 0 && this.ws) {
          setTimeout(() => {
            // Double check that no new subscriptions were added
            if (this.wsSubscriptions.size === 0 && this.ws) {
              this.ws.close();
              this.ws = null;


              // Update status store
              try {
                statusStore.setWebSocketConnected(false);
              } catch (error) {
              }
            }
          }, 100); // 100ms delay to allow for granularity switches
        }
      }
    };
  }

  private connectWebSocket(onError?: (error: Error) => void) {
    // Don't create a new WebSocket if one is already connected
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return;
    }
    
    // If there's a WebSocket in connecting state, wait for it
    if (this.ws && this.ws.readyState === WebSocket.CONNECTING) {
      return;
    }
    
    try {
      this.ws = new WebSocket(this.wsUrl);

      this.ws.onopen = () => {
        ChartDebug.log('WebSocket connected');
        this.clearReconnectTimeout();


        // Update status store - WebSocket is connected
        try {
          statusStore.setWebSocketConnected(true);
        } catch (error) {
        }
        
        // Resubscribe to all active subscriptions
        for (const key of this.wsSubscriptions.keys()) {
          const [pair, granularity] = key.split(':');
          this.sendSubscription(pair, granularity);
        }
        
        // Call reconnect callback if this is a reconnection
        if (this.onReconnectCallback && this.wsSubscriptions.size > 0) {
          this.onReconnectCallback();
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'candle') {
            const key = `${data.data?.pair}:${data.data?.granularity}`;
            const callback = this.wsSubscriptions.get(key);
            if (callback) {
              const transformedData = this.transformWebSocketCandle(data.data);
              callback(transformedData);
            } else {
            }
          }
        } catch (error) {
          ChartDebug.error('Error processing WebSocket message:', error);
        }
      };

      this.ws.onerror = (error) => {
        ChartDebug.error('WebSocket error:', error);


        // Update status store - WebSocket error
        try {
          statusStore.setWebSocketConnected(false);
        } catch (error) {
        }
        
        if (onError) {
          onError(new Error('WebSocket connection error'));
        }
      };

      this.ws.onclose = () => {
        ChartDebug.log('WebSocket disconnected');


        // Update status store - WebSocket disconnected
        try {
          statusStore.setWebSocketConnected(false);
        } catch (error) {
        }
        
        this.scheduleReconnect(onError);
      };
    } catch (error) {
      ChartDebug.error('Error creating WebSocket:', error);
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
      ChartDebug.log('Attempting WebSocket reconnection...');
      this.connectWebSocket(onError);
    }, 2000); // Reconnect after 2 seconds (reduced from 5)
  }

  private clearReconnectTimeout() {
    if (this.wsReconnectTimeout) {
      clearTimeout(this.wsReconnectTimeout);
      this.wsReconnectTimeout = null;
    }
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