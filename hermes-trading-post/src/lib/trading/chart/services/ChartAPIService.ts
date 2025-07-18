import type { Candle, DataRequest, WebSocketCandle } from '../types/data.types';
import { ChartDebug } from '../utils/debug';
import { perfTest } from '../utils/performanceTest';
import { CoinbaseAPI } from '../../../../services/coinbaseApi';

export class ChartAPIService {
  private coinbaseApi: CoinbaseAPI;
  private wsUrl: string = 'ws://localhost:8080';
  private ws: WebSocket | null = null;
  private wsReconnectTimeout: NodeJS.Timeout | null = null;
  private wsSubscriptions: Map<string, (data: WebSocketCandle) => void> = new Map();

  constructor() {
    this.coinbaseApi = new CoinbaseAPI();
  }

  async initialize() {
    // Initialize any required API connections
    ChartDebug.log('Initialized');
  }

  async fetchCandles(request: DataRequest): Promise<Candle[]> {
    const { pair, granularity, start, end, limit } = request;
    const fetchStartTime = performance.now();
    perfTest.mark('fetchCandles-start');
    
    // Log performance start for 3M/1d
    if (granularity === '1d' || granularity === '1D') {
      ChartDebug.critical(`[PERF START] fetchCandles for ${pair} ${granularity} at ${new Date().toISOString()}`);
    }
    
    // Map granularity string to seconds for Coinbase API
    const granularityMap: Record<string, number> = {
      '1m': 60,
      '5m': 300,
      '15m': 900,
      '30m': 1800,
      '1h': 3600,
      '2h': 7200,
      '4h': 14400,
      '6h': 21600,
      '12h': 43200,
      '1d': 86400,
      '1D': 86400  // Handle uppercase
    };
    
    const granularitySeconds = granularityMap[granularity] || 60;
    
    // Consolidated debug for 1d granularity
    if (granularity === '1d' || granularity === '1D') {
      ChartDebug.critical('Fetching 1d candles', {
        granularity: `${granularity} (${granularitySeconds}s)`,
        pair,
        start: `${start} (${new Date(start * 1000).toISOString()})`,
        end: `${end} (${new Date(end * 1000).toISOString()})`,
        timeRange: `${(end - start) / 86400} days`,
        expectedCandles: Math.ceil((end - start) / 86400),
        limit: limit || 'not set'
      });
    }

    try {
      // Coinbase has a max of 300 candles per request
      const maxCandles = 300;
      const maxTimeSpan = maxCandles * granularitySeconds;
      
      // Check if we need to chunk the request
      const timeRange = end - start;
      const expectedCandles = Math.ceil(timeRange / granularitySeconds);
      
      if (granularity === '1d' || granularity === '1D') {
        ChartDebug.critical('Coinbase API chunking', {
          limit: 300,
          needed: expectedCandles,
          willChunk: expectedCandles > maxCandles
        });
      }
      
      let allCandles: Candle[] = [];
      
      if (expectedCandles > maxCandles) {
        // Need to fetch in chunks
        ChartDebug.log(`Fetching ${expectedCandles} candles in chunks (max 300 per request)`);
        
        let currentStart = start;
        while (currentStart < end) {
          const currentEnd = Math.min(currentStart + maxTimeSpan, end);
          
          if (granularity === '1d' || granularity === '1D') {
            ChartDebug.critical(`Fetching chunk: ${new Date(currentStart * 1000).toISOString()} to ${new Date(currentEnd * 1000).toISOString()}`);
          }
          
          perfTest.mark(`chunk-${currentStart}-start`);
          const chunkCandles = await this.coinbaseApi.getCandles(
            pair,
            granularitySeconds,
            currentStart.toString(),
            currentEnd.toString()
          );
          perfTest.measure(`API chunk ${new Date(currentStart * 1000).toISOString()}`, `chunk-${currentStart}-start`);
          
          if (granularity === '1d' || granularity === '1D') {
            ChartDebug.critical(`Chunk returned ${chunkCandles.length} candles`);
          }
          
          allCandles = allCandles.concat(chunkCandles);
          currentStart = currentEnd;
          
          // Small delay to avoid rate limits - reduced from 100ms to 10ms
          if (currentStart < end) {
            await new Promise(resolve => setTimeout(resolve, 10));
          }
        }
      } else {
        // Single request is sufficient
        ChartDebug.log(`Fetching from Coinbase API: ${pair} ${granularity} (${granularitySeconds}s)`);
        
        if (granularity === '1d' || granularity === '1D') {
          ChartDebug.critical(`[PERF] Starting Coinbase API call at ${performance.now() - fetchStartTime}ms`);
        }
        
        const apiStartTime = performance.now();
        allCandles = await this.coinbaseApi.getCandles(
          pair,
          granularitySeconds,
          start.toString(),
          end.toString()
        );
        const apiEndTime = performance.now();
        
        if (granularity === '1d' || granularity === '1D') {
          ChartDebug.critical(`[PERF] Coinbase API call took ${apiEndTime - apiStartTime}ms`);
          ChartDebug.critical(`[PERF] Total time so far: ${apiEndTime - fetchStartTime}ms`);
        }
      }

      // Consolidated debug response for 1d granularity
      if (granularity === '1d' || granularity === '1D') {
        const debugData: any = {
          totalReceived: allCandles.length,
          expected: expectedCandles
        };
        
        if (allCandles.length > 0) {
          debugData.firstCandle = new Date(allCandles[0].time * 1000).toISOString();
          debugData.lastCandle = new Date(allCandles[allCandles.length - 1].time * 1000).toISOString();
        }
        
        if (allCandles.length < expectedCandles) {
          const totalDays = (end - start) / 86400;
          debugData.warning = {
            missing: expectedCandles - allCandles.length,
            possibleReasons: ['Weekends', 'Holidays', 'No data available'],
            approximateWeekends: Math.floor(totalDays / 7) * 2
          };
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
        ChartDebug.log('WebSocket connected');
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
          ChartDebug.error('Error processing WebSocket message:', error);
        }
      };

      this.ws.onerror = (error) => {
        ChartDebug.error('WebSocket error:', error);
        if (onError) {
          onError(new Error('WebSocket connection error'));
        }
      };

      this.ws.onclose = () => {
        ChartDebug.log('WebSocket disconnected');
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