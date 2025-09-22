import type { Candle, DataRequest, WebSocketCandle } from '../types/data.types';
import { ChartDebug } from '../utils/debug';
import { perfTest } from '../utils/performanceTest';
import { CoinbaseAPI } from '../../../../services/api/coinbaseApi';
import { getGranularitySeconds } from '../utils/granularityHelpers';

export class ChartAPIService {
  private coinbaseApi: CoinbaseAPI;
  private wsUrl: string = 'ws://localhost:4827'; // Backend WebSocket for status/data sync
  private ws: WebSocket | null = null;
  private wsReconnectTimeout: NodeJS.Timeout | null = null;
  private wsSubscriptions: Map<string, (data: WebSocketCandle) => void> = new Map();
  private onReconnectCallback: (() => void) | null = null;

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
    
    console.log(`[ChartAPIService] fetchCandles called for ${pair} ${granularity}`);
    console.log(`[ChartAPIService] Time range: ${new Date(start * 1000).toISOString()} to ${new Date(end * 1000).toISOString()}`);
    
    // Log performance start for 3M/1d
    if (granularity === '1d' || granularity === '1D') {
      ChartDebug.critical(`[PERF START] fetchCandles for ${pair} ${granularity} at ${new Date().toISOString()}`);
    }
    
    const granularitySeconds = getGranularitySeconds(granularity);
    
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
      console.error('[ChartAPIService] Error fetching candles:', error);
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
    console.log(`🔌 Chart WebSocket connecting to ${this.wsUrl} for ${pair}:${granularity}`);
    console.log('🔌 WebSocket URL:', this.wsUrl);
    
    // Store callbacks for reconnection
    this.onReconnectCallback = onReconnect || null;
    
    // Connect to our backend WebSocket
    this.connectWebSocket(onError);
    
    // Store the subscription
    const subscriptionKey = `${pair}:${granularity}`;
    this.wsSubscriptions.set(subscriptionKey, onMessage);
    
    // Import and update status store
    import('../stores/statusStore.svelte').then(({ statusStore }) => {
      statusStore.setWebSocketConnected(true);
    }).catch(console.error);
    
    // Return unsubscribe function
    return {
      unsubscribe: () => {
        console.log(`🔌 Unsubscribed from chart WebSocket for ${pair}:${granularity}`);
        this.wsSubscriptions.delete(subscriptionKey);
        
        // If no more subscriptions, close WebSocket
        if (this.wsSubscriptions.size === 0 && this.ws) {
          this.ws.close();
          this.ws = null;
          
          // Update status store
          import('../stores/statusStore.svelte').then(({ statusStore }) => {
            statusStore.setWebSocketConnected(false);
          }).catch(console.error);
        }
      }
    };
  }

  private connectWebSocket(onError?: (error: Error) => void) {
    try {
      this.ws = new WebSocket(this.wsUrl);

      this.ws.onopen = () => {
        console.log('🟢 WebSocket connected to backend');
        ChartDebug.log('WebSocket connected');
        this.clearReconnectTimeout();
        
        // Update status store - WebSocket is connected
        import('../stores/statusStore.svelte').then(({ statusStore }) => {
          console.log('🔧 Before setWebSocketConnected - wsConnected:', statusStore.wsConnected);
          statusStore.setWebSocketConnected(true);
          console.log('✅ After setWebSocketConnected - wsConnected:', statusStore.wsConnected);
        }).catch(console.error);
        
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
        console.log('🔴 WebSocket error');
        ChartDebug.error('WebSocket error:', error);
        
        // Update status store - WebSocket error
        import('../stores/statusStore.svelte').then(({ statusStore }) => {
          statusStore.setWebSocketConnected(false);
        }).catch(console.error);
        
        if (onError) {
          onError(new Error('WebSocket connection error'));
        }
      };

      this.ws.onclose = () => {
        console.log('🔴 WebSocket disconnected');
        ChartDebug.log('WebSocket disconnected');
        
        // Update status store - WebSocket disconnected
        import('../stores/statusStore.svelte').then(({ statusStore }) => {
          statusStore.setWebSocketConnected(false);
        }).catch(console.error);
        
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