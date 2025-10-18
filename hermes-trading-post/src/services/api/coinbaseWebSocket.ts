import type { WebSocketMessage, TickerMessage, SubscribeMessage } from '../types/coinbase';
import { priceForwarder } from './priceForwarder';

export class CoinbaseWebSocket {
  private ws: WebSocket | null = null;
  private url = 'wss://ws-feed.exchange.coinbase.com';
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private lastMessageTime: number = 0;
  private lastTickerTime: number = 0;
  private connectionTimeout: NodeJS.Timeout | null = null;
  private tickerCheckInterval: NodeJS.Timeout | null = null;
  private onPriceCallback: ((price: number) => void) | null = null;
  private onStatusCallback: ((status: 'connected' | 'disconnected' | 'error' | 'loading') => void) | null = null;
  private currentPrice: number = 0;
  private isSubscribed: boolean = false;
  private messageListeners: Set<(data: any) => void> = new Set();
  private subscribedSymbols: Set<string> = new Set();

  constructor() {
  }

  connect() {
    try {
      // Don't create a new connection if one already exists and is open/connecting
      if (this.ws && (this.ws.readyState === WebSocket.CONNECTING || this.ws.readyState === WebSocket.OPEN)) {
        return;
      }
      
      this.onStatusCallback?.('loading');
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        
        // Reset connection state
        this.isSubscribed = false;
        this.lastMessageTime = Date.now(); // Initialize last message time
        
        // Wait a moment for WebSocket to stabilize before subscribing
        setTimeout(() => {
          // Always subscribe to channels when connection opens
          this.subscribeToChannels();
          this.startHeartbeat();
          this.startConnectionTimeout();
          this.startTickerCheck();
          this.lastTickerTime = Date.now(); // Initialize ticker time
        }, 100);
      };

      this.ws.onmessage = (event) => {
        try {
          // Update last message time
          this.lastMessageTime = Date.now();
          this.resetConnectionTimeout();
          
          const data: WebSocketMessage = JSON.parse(event.data);
          // Only log important messages, not ticker updates
          if (data.type === 'error' || data.type === 'subscriptions') {
          }
          
          switch (data.type) {
            case 'ticker':
              const tickerData = data as TickerMessage;
              
              // Update last ticker time
              this.lastTickerTime = Date.now();
              
              // Notify all message listeners
              this.messageListeners.forEach(listener => {
                try {
                  listener(tickerData);
                } catch (error) {
                  // PERF: Don't log errors in hot path (fires 100s/sec)
                  // Errors are rare, so silent failure is acceptable for ticker processing
                  // Only log if it's a critical error affecting WebSocket connection
                  if (error instanceof Error && error.message?.includes('critical')) {
                    console.error('Critical error in message listener:', error.message);
                  }
                }
              });
              
              // Forward price to backend
              if (tickerData.price && tickerData.product_id) {
                priceForwarder.forwardPrice(parseFloat(tickerData.price), tickerData.product_id);
              }
              
              // Legacy support for BTC-USD price callback
              if (data.product_id === 'BTC-USD' && tickerData.price) {
                this.currentPrice = parseFloat(tickerData.price);
                this.onPriceCallback?.(this.currentPrice);
                // Update status to connected when we receive first ticker
                if (this.onStatusCallback) {
                  this.onStatusCallback('connected');
                }
              }
              break;
              
            case 'subscriptions':
              // console.log('Subscription confirmed for channels:', data);
              this.onStatusCallback?.('connected');
              break;
              
            case 'error':
              console.error('WebSocket error message:', data);
              this.onStatusCallback?.('error');
              break;
              
            default:
              console.log('Unhandled message type:', data.type);
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
          console.error('Raw message:', event.data);
        }
      };

      this.ws.onclose = () => {
        this.isSubscribed = false; // Reset subscription state
        this.onStatusCallback?.('disconnected');
        this.stopHeartbeat();
        this.stopConnectionTimeout();
        this.stopTickerCheck();
        this.scheduleReconnect();
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.onStatusCallback?.('error');
      };
    } catch (error) {
      console.error('Error connecting to WebSocket:', error);
      this.scheduleReconnect();
    }
  }

  private subscribeToChannels() {
    if (this.ws?.readyState === WebSocket.OPEN && this.subscribedSymbols.size > 0) {
      try {
        const subscribeMessage: SubscribeMessage = {
          type: 'subscribe',
          product_ids: Array.from(this.subscribedSymbols),
          channels: ['ticker']
        };
        this.ws.send(JSON.stringify(subscribeMessage));
        this.isSubscribed = true;
      } catch (error) {
        console.error('Error sending subscribe message:', error);
        // Trigger reconnection on send failure
        this.ws?.close();
      }
    } else if (this.subscribedSymbols.size === 0) {
    } else {
    }
  }

  private startHeartbeat() {
    // Clear any existing heartbeat interval
    this.stopHeartbeat();
    
    // Send heartbeat more frequently to prevent idle timeout
    this.heartbeatInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        try {
          // Send a ping frame to keep connection alive
          // Coinbase WebSocket accepts subscribe/unsubscribe as activity
          // Send empty subscribe to act as keepalive
          const keepAliveMessage = {
            type: 'subscribe',
            product_ids: [],
            channels: []
          };
          this.ws.send(JSON.stringify(keepAliveMessage));
        } catch (error) {
          console.error('Heartbeat failed:', error);
          this.ws?.close();
        }
      } else {
        this.ws?.close();
      }
    }, 15000); // Check every 15 seconds instead of 30
  }

  private startTickerCheck() {
    // Clear any existing ticker check interval
    this.stopTickerCheck();
    
    // Check if we're receiving ticker messages
    this.tickerCheckInterval = setInterval(() => {
      if (this.subscribedSymbols.size > 0 && this.ws?.readyState === WebSocket.OPEN) {
        const now = Date.now();
        const timeSinceLastTicker = now - this.lastTickerTime;
        
        // If we haven't received a ticker in 30 seconds but are subscribed, resubscribe
        if (timeSinceLastTicker > 30000) {
          
          // Resubscribe to all symbols
          this.subscribeToChannels();
        }
      }
    }, 20000); // Check every 20 seconds
  }

  private stopTickerCheck() {
    if (this.tickerCheckInterval) {
      clearInterval(this.tickerCheckInterval);
      this.tickerCheckInterval = null;
    }
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private startConnectionTimeout() {
    // Clear any existing timeout first
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
    }
    // If no message received in 60 seconds, consider connection dead
    this.connectionTimeout = setTimeout(() => {
      const now = Date.now();
      const timeSinceLastMessage = now - this.lastMessageTime;
      console.log(`Connection timeout at ${new Date().toISOString()} - no messages received for ${timeSinceLastMessage}ms (last message: ${new Date(this.lastMessageTime).toISOString()})`);
      
      // Force close and reconnect
      if (this.ws) {
        this.ws.close();
      }
    }, 60000);
  }

  private resetConnectionTimeout() {
    // Just restart the timeout
    this.startConnectionTimeout();
  }

  private stopConnectionTimeout() {
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
      this.connectionTimeout = null;
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }
    this.reconnectTimeout = setTimeout(() => {
      // console.log('Attempting to reconnect to Coinbase...');
      this.connect();
    }, 5000); // Reconnect after 5 seconds
  }

  onPrice(callback: (price: number) => void) {
    this.onPriceCallback = callback;
  }

  onStatus(callback: (status: 'connected' | 'disconnected' | 'error' | 'loading') => void) {
    this.onStatusCallback = callback;
  }

  getLastPrice(): number | null {
    return this.currentPrice || null;
  }
  
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  subscribe(listener: (data: any) => void): () => void {
    this.messageListeners.add(listener);
    return () => {
      this.messageListeners.delete(listener);
    };
  }

  subscribeTicker(symbol: string) {
    
    // Check if already subscribed
    if (this.subscribedSymbols.has(symbol)) {
      return;
    }
    
    this.subscribedSymbols.add(symbol);
    
    // Always try to subscribe immediately if connected
    if (this.ws?.readyState === WebSocket.OPEN) {
      try {
        // If already connected, send subscription immediately
        const subscribeMessage: SubscribeMessage = {
          type: 'subscribe',
          product_ids: [symbol],
          channels: ['ticker']
        };
        this.ws.send(JSON.stringify(subscribeMessage));
        this.isSubscribed = true;
      } catch (error) {
        console.error('Error subscribing to ticker:', error);
        // Ensure we reconnect if send fails
        this.ws?.close();
      }
    } else {
      // Ensure we're trying to connect
      if (!this.ws || this.ws.readyState === WebSocket.CLOSED) {
        this.connect();
      }
    }
  }

  unsubscribeTicker(symbol: string) {
    this.subscribedSymbols.delete(symbol);
    if (this.ws?.readyState === WebSocket.OPEN) {
      // Send unsubscribe message
      const unsubscribeMessage = {
        type: 'unsubscribe',
        product_ids: [symbol],
        channels: ['ticker']
      };
      this.ws.send(JSON.stringify(unsubscribeMessage));
    }
  }

  disconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    this.stopHeartbeat();
    this.stopConnectionTimeout();
    this.stopTickerCheck();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    // Clear all listeners to prevent memory leaks
    this.messageListeners.clear();
    this.subscribedSymbols.clear();
    this.isSubscribed = false;
  }
}

// Export singleton instance for convenience
export const coinbaseWebSocket = new CoinbaseWebSocket();