import type { CandlestickData } from 'lightweight-charts';
import type { Candle, DataRequest, WebSocketCandle } from '../types/data.types';
import { ChartDebug } from '../utils/debug';
import { logger } from '../../../../services/logging';
import { statusStore } from '../stores/statusStore.svelte';
import { dataStore } from '../stores/dataStore.svelte';
import { fetchCandlesBinary, isBinaryFormat, calculateSavings, formatBytes } from '../../../../utils/binaryFormat';

interface RedisChartDataResponse {
  success: boolean;
  data: {
    candles: Candle[];
    metadata: {
      pair: string;
      granularity: string;
      totalCandles: number;
      firstTimestamp: number;
      lastTimestamp: number;
      source: string;
      cacheHitRatio: number;
      storageMetadata?: any;
    };
  };
  error?: string;
}

export class RedisChartService {
  // Use window.location.hostname to work on any network machine
  private getBackendHost(): string {
    const envHost = import.meta.env.VITE_BACKEND_HOST;
    return envHost || window.location.hostname || 'localhost';
  }

  private backendUrl: string = `http://${this.getBackendHost()}:4828`; // Backend API base URL
  private wsUrl: string = `ws://${this.getBackendHost()}:4828`; // Backend WebSocket for real-time data
  private ws: WebSocket | null = null;
  private wsReconnectTimeout: NodeJS.Timeout | null = null;
  private wsSubscriptions: Map<string, (data: WebSocketCandle) => void> = new Map();
  private onReconnectCallback: (() => void) | null = null;

  constructor() {
    ChartDebug.log('RedisChartService initialized');
  }

  async initialize() {
    // Test basic connectivity to backend
    try {
      const response = await fetch(`${this.backendUrl}/health`);
    } catch (error) {
    }
  }

  /**
   * Fetch historical candles from Redis backend with binary format support
   */
  async fetchCandles(request: DataRequest): Promise<Candle[]> {
    const { pair, granularity, start, end, limit = 1000 } = request;

    try {
      const params = new URLSearchParams({
        pair: pair || 'BTC-USD',
        granularity: granularity || '1m',
        maxCandles: (limit || 10000).toString(), // Use provided limit or 10k for large datasets
        format: 'msgpack' // Request binary format
      });

      if (start) {
        params.append('startTime', start.toString());
      }

      if (end) {
        params.append('endTime', end.toString());
      }

      const url = `${this.backendUrl}/api/trading/chart-data?${params}`;

      // Try binary format first (3-5x smaller)
      try {
        const binaryCandles = await fetchCandlesBinary(url);

        if (binaryCandles.length > 0) {
          // Calculate and log savings
          const savings = calculateSavings(binaryCandles);
          ChartDebug.log(`📦 Binary format: ${formatBytes(savings.binarySize)} vs JSON: ${formatBytes(savings.jsonSize)} - ${savings.savingsPercent.toFixed(1)}% smaller`);

          // Convert to Candle format
          return binaryCandles.map(c => ({
            time: c.time as number,
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close,
            volume: (c as any).volume || 0
          }));
        }
      } catch (binaryError) {
        // Binary format not supported by backend, fallback to JSON
        ChartDebug.log('Binary format not available, using JSON fallback');
      }

      // Fallback to JSON
      const response = await fetch(url.replace('format=msgpack', 'format=json'));

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result: RedisChartDataResponse = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Redis fetch failed');
      }

      const { candles } = result.data;

      return candles;

    } catch (error) {

      // Return empty array instead of throwing to allow graceful degradation
      return [];
    }
  }

  /**
   * Fetch candles with metadata including totalCandles count
   */
  async fetchCandlesWithMetadata(request: DataRequest): Promise<{ candles: Candle[], metadata: any }> {
    const { pair, granularity, start, end, limit = 1000 } = request;
    
    try {
      const params = new URLSearchParams({
        pair: pair || 'BTC-USD',
        granularity: granularity || '1m',
        maxCandles: (limit || 10000).toString()
      });
      
      if (start) {
        params.append('startTime', start.toString());
      }
      
      if (end) {
        params.append('endTime', end.toString());
      }
      
      const url = `${this.backendUrl}/api/trading/chart-data?${params}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result: RedisChartDataResponse = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Redis fetch failed');
      }
      
      const { candles, metadata } = result.data;
      
      return { candles, metadata };
      
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get Redis storage statistics
   */
  async getStorageStats(): Promise<any> {
    try {
      const response = await fetch(`${this.backendUrl}/api/trading/storage-stats`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Storage stats fetch failed');
      }
      
      return result.data;
      
    } catch (error: unknown) {
      ChartDebug.error('Failed to get storage stats:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      return null;
    }
  }

  /**
   * Subscribe to real-time candle updates via WebSocket
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
        this.ws.send(JSON.stringify({
          type: 'unsubscribe',
          pair,
          granularity
        }));
      }
      ChartDebug.log(`Unsubscribed from ${subscriptionKey}`);
    };
  }

  /**
   * Connect to backend WebSocket for real-time data
   */
  private connectWebSocket() {
    if (this.ws) {
      this.ws.close();
    }

    // Removed verbose logging for performance
    ChartDebug.log('Connecting to backend WebSocket...');
    this.ws = new WebSocket(this.wsUrl);

    this.ws.onopen = () => {
      ChartDebug.log('✅ Connected to backend WebSocket');

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
      // Removed excessive logging that was causing performance issues
      try {
        const message = JSON.parse(event.data);
        this.handleWebSocketMessage(message);
      } catch (error) {
        ChartDebug.error('Failed to parse WebSocket message:', error);
      }
    };

    this.ws.onclose = (event) => {
      // PERF: Disabled - console logging removed for performance
      ChartDebug.warn('❌ Backend WebSocket disconnected');
      this.scheduleReconnect();
    };

    this.ws.onerror = (error) => {
      // PERF: Disabled - console logging removed for performance
      ChartDebug.error('Backend WebSocket error:', error);
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
      // Removed verbose logging for performance
      this.ws.send(JSON.stringify(message));
      ChartDebug.log(`📡 Subscribed to ${pair}:${granularity}`);
    } else {
    }
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleWebSocketMessage(message: any) {
    switch (message.type) {
      case 'ticker':
        // 🚀 RADICAL OPTIMIZATION: Handle instant ticker updates (no throttle)
        // Forward to candle callback as optimistic price update
        const tickerKey = `${message.pair}:1m`; // Always use 1m for ticker
        const tickerCallback = this.wsSubscriptions.get(tickerKey);

        if (tickerCallback) {
          const tickerData: WebSocketCandle = {
            time: 0,  // ⚠️ CRITICAL: Don't use message.time! It's Date.now() which changes every ms
            open: message.price,
            high: message.price,
            low: message.price,
            close: message.price,
            volume: 0,  // Volume not available in ticker
            type: 'ticker' // Mark as ticker update
          };

          tickerCallback(tickerData);
        }
        break;

      case 'candle':
        const subscriptionKey = `${message.pair}:${message.granularity}`;
        const callback = this.wsSubscriptions.get(subscriptionKey);

        if (callback) {
          const candleData: WebSocketCandle = {
            time: message.time,
            open: message.open,
            high: message.high,
            low: message.low,
            close: message.close,
            volume: message.volume || 0,
            type: message.candleType || 'update'
          };

          callback(candleData);
        }
        break;
        
      case 'subscribed':
        ChartDebug.log(`✅ Subscription confirmed: ${message.pair}:${message.granularity}`);
        break;
        
      case 'unsubscribed':
        ChartDebug.log(`❌ Unsubscription confirmed: ${message.pair}:${message.granularity}`);
        break;
        
      case 'error':
        ChartDebug.error('Backend WebSocket error:', message.message);
        break;

      case 'database_activity':
        // Forward database activity to statusStore
        try {
          const activity = message.data;
          if (activity.type === 'fetch_start' || activity.type === 'API_FETCH') {
            statusStore.setDatabaseActivity('fetching', 2000);
          } else if (activity.type === 'store_complete' || activity.type === 'REDIS_STORE') {
            statusStore.setDatabaseActivity('storing', 1500);

            // Update database count when new candles are stored
            try {
              dataStore.updateDatabaseCount();
            } catch (err) {
            }
          } else if (activity.type === 'error' || activity.type === 'API_ERROR') {
            statusStore.setDatabaseActivity('error', 3000);
          }
        } catch (error) {
        }
        break;

      default:
        // Ignore other message types (bot management, etc.)
        break;
    }
  }

  /**
   * Schedule WebSocket reconnection
   */
  private scheduleReconnect() {
    if (this.wsReconnectTimeout) {
      clearTimeout(this.wsReconnectTimeout);
    }
    
    this.wsReconnectTimeout = setTimeout(() => {
      ChartDebug.log('🔄 Attempting to reconnect to backend WebSocket...');
      this.connectWebSocket();
    }, 2000);
  }

  /**
   * Disconnect and cleanup
   */
  disconnect() {
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
    
    ChartDebug.log('Redis chart service disconnected and cleaned up');
  }
}