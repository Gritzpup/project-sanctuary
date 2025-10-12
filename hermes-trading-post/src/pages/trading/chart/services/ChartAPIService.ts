import type { Candle, DataRequest, WebSocketCandle } from '../types/data.types';
import { ChartDebug } from '../utils/debug';
import { perfTest } from '../utils/performanceTest';
import { CoinbaseAPI } from '../../../../services/api/coinbaseApi';
import { getGranularitySeconds } from '../utils/granularityHelpers';
import { Logger } from '../../../../utils/Logger';
import { statusStore } from '../stores/statusStore.svelte';

export class ChartAPIService {
  private coinbaseApi: CoinbaseAPI;
  private wsUrl: string = 'ws://localhost:4828'; // Backend WebSocket for status/data sync
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
    
    Logger.debug('ChartAPIService', `fetchCandles called for ${pair} ${granularity}`);
    if (start && end) {
      Logger.debug('ChartAPIService', `Time range: ${new Date(start * 1000).toISOString()} to ${new Date(end * 1000).toISOString()}`);
    }
    
    // Log performance start for 3M/1d
    if (granularity === '1d' || granularity === '1D') {
      ChartDebug.critical(`[PERF START] fetchCandles for ${pair} ${granularity} at ${new Date().toISOString()}`);
    }
    
    const granularitySeconds = getGranularitySeconds(granularity);
    
    // Consolidated debug for 1d granularity
    if ((granularity === '1d' || granularity === '1D') && start && end) {
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
      if (!start || !end) {
        throw new Error('Start and end timestamps are required for chunked requests');
      }
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
        
        // Debug for 5m granularity API calls
        if (granularity === '5m') {
          console.log('🔍 5m API Request:', {
            pair,
            granularity: `${granularity} (${granularitySeconds}s)`,
            start: start ? `${start} (${new Date(start * 1000).toISOString()})` : 'undefined',
            end: end ? `${end} (${new Date(end * 1000).toISOString()})` : 'undefined',
            expectedCandles: expectedCandles
          });
        }
        
        if (granularity === '1d' || granularity === '1D') {
          ChartDebug.critical(`[PERF] Starting Coinbase API call at ${performance.now() - fetchStartTime}ms`);
        }
        
        const apiStartTime = performance.now();
        allCandles = await this.coinbaseApi.getCandles(
          pair,
          granularitySeconds,
          start?.toString(),
          end?.toString()
        );
        const apiEndTime = performance.now();
        
        // Debug for 5m granularity API response
        if (granularity === '5m') {
          console.log('🔍 5m API Response:', {
            expectedCandles,
            receivedCandles: allCandles.length,
            firstCandle: allCandles.length > 0 ? new Date(allCandles[0].time * 1000).toISOString() : 'none',
            lastCandle: allCandles.length > 0 ? new Date(allCandles[allCandles.length - 1].time * 1000).toISOString() : 'none'
          });
        }
        
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
        
        if (allCandles.length < expectedCandles && start && end) {
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
      console.error('Failed to update status store:', error);
    }
    
    // Return unsubscribe function
    return {
      unsubscribe: () => {
        console.log(`🔌 Unsubscribed from chart WebSocket for ${pair}:${granularity}`);
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
                console.error('Failed to update status store:', error);
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
          console.error('Failed to update status store:', error);
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
            
            const key = `${data.pair}:${data.granularity}`;
            const callback = this.wsSubscriptions.get(key);
            if (callback) {
              const transformedData = this.transformWebSocketCandle(data);
              callback(transformedData);
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
          console.error('Failed to update status store:', error);
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
          console.error('Failed to update status store:', error);
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