import type { CandlestickData } from 'lightweight-charts';
import type { Candle, DataRequest, WebSocketCandle } from '../types/data.types';
import { ChartDebug } from '../utils/debug';
import { Logger } from '../../../../utils/Logger';

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
  private backendUrl: string = 'http://localhost:4828'; // Backend API base URL
  private wsUrl: string = 'ws://localhost:4828'; // Backend WebSocket for real-time data
  private ws: WebSocket | null = null;
  private wsReconnectTimeout: NodeJS.Timeout | null = null;
  private wsSubscriptions: Map<string, (data: WebSocketCandle) => void> = new Map();
  private onReconnectCallback: (() => void) | null = null;

  constructor() {
    ChartDebug.log('RedisChartService initialized');
  }

  async initialize() {
    console.log('🚀 [RedisChartService] Initializing Redis chart service...');
    
    // Test basic connectivity to backend
    try {
      console.log('🧪 [RedisChartService] Testing backend connectivity...');
      const response = await fetch(`${this.backendUrl}/health`);
      if (response.ok) {
        const health = await response.json();
        console.log('✅ [RedisChartService] Backend health check passed:', health.status);
      } else {
        console.warn('⚠️ [RedisChartService] Backend health check failed with status:', response.status);
      }
    } catch (error) {
      console.error('❌ [RedisChartService] Backend connectivity test failed:', error);
    }
    
    ChartDebug.log('Redis chart service ready');
  }

  /**
   * Fetch historical candles from Redis backend
   */
  async fetchCandles(request: DataRequest): Promise<Candle[]> {
    const { pair, granularity, start, end, limit = 1000 } = request;
    const fetchStartTime = performance.now();
    
    console.log(`🔄 [RedisChartService] Fetching candles from Redis backend: ${pair} ${granularity}`);
    ChartDebug.log(`Fetching candles from Redis backend: ${pair} ${granularity}`);
    if (start && end) {
      ChartDebug.log(`Time range: ${new Date(start * 1000).toISOString()} to ${new Date(end * 1000).toISOString()}`);
    }
    
    try {
      const params = new URLSearchParams({
        pair: pair || 'BTC-USD',
        granularity: granularity || '1m',
        maxCandles: (limit || 10000).toString() // Use provided limit or 10k for large datasets
      });
      
      if (start) {
        params.append('startTime', start.toString());
      }
      
      if (end) {
        params.append('endTime', end.toString());
      }
      
      const url = `${this.backendUrl}/api/trading/chart-data?${params}`;
      console.log(`🌐 [RedisChartService] Redis fetch URL: ${url}`);
      ChartDebug.log(`Redis fetch URL: ${url}`);
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result: RedisChartDataResponse = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Redis fetch failed');
      }
      
      const { candles, metadata } = result.data;
      const fetchTime = performance.now() - fetchStartTime;
      
      console.log(`✅ [RedisChartService] Loaded ${candles.length} candles from Redis in ${fetchTime.toFixed(2)}ms`);
      
      ChartDebug.log(`Redis fetch completed in ${fetchTime.toFixed(2)}ms`, {
        candleCount: candles.length,
        source: metadata.source,
        cacheHitRatio: metadata.cacheHitRatio.toFixed(2),
        pair: metadata.pair,
        granularity: metadata.granularity
      });
      
      // Log Redis storage metrics
      Logger.info('RedisChartService', 'Fetched candles from Redis', {
        pair: metadata.pair,
        granularity: metadata.granularity,
        candleCount: candles.length,
        source: metadata.source,
        cacheHitRatio: metadata.cacheHitRatio,
        fetchTimeMs: fetchTime,
        storageStats: metadata.storageMetadata
      });
      
      return candles;
      
    } catch (error) {
      const fetchTime = performance.now() - fetchStartTime;
      console.error(`❌ [RedisChartService] Redis fetch failed in ${fetchTime.toFixed(2)}ms:`, error);
      ChartDebug.error(`Redis fetch failed in ${fetchTime.toFixed(2)}ms:`, error);
      
      Logger.error('RedisChartService', 'Failed to fetch candles from Redis', {
        error: error.message,
        pair,
        granularity,
        fetchTimeMs: fetchTime
      });
      
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
      console.error(`❌ [RedisChartService] Error fetching candles with metadata:`, error);
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
      
    } catch (error) {
      ChartDebug.error('Failed to get storage stats:', error);
      Logger.error('RedisChartService', 'Failed to get storage stats', { error: error.message });
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
      try {
        const message = JSON.parse(event.data);
        this.handleWebSocketMessage(message);
      } catch (error) {
        ChartDebug.error('Failed to parse WebSocket message:', error);
      }
    };
    
    this.ws.onclose = () => {
      ChartDebug.warn('❌ Backend WebSocket disconnected');
      this.scheduleReconnect();
    };
    
    this.ws.onerror = (error) => {
      ChartDebug.error('Backend WebSocket error:', error);
    };
  }

  /**
   * Send subscription message to backend
   */
  private sendSubscription(pair: string, granularity: string) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'subscribe',
        pair,
        granularity
      }));
      ChartDebug.log(`📡 Subscribed to ${pair}:${granularity}`);
    }
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleWebSocketMessage(message: any) {
    switch (message.type) {
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