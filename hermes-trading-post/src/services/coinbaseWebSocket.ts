import type { WebSocketMessage, TickerMessage, SubscribeMessage } from '../types/coinbase';

export class CoinbaseWebSocket {
  private ws: WebSocket | null = null;
  private url = 'wss://ws-feed.exchange.coinbase.com';
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private onPriceCallback: ((price: number) => void) | null = null;
  private onStatusCallback: ((status: 'connected' | 'disconnected' | 'error' | 'loading') => void) | null = null;
  private currentPrice: number = 0;
  private isSubscribed: boolean = false;
  private messageListeners: Set<(data: any) => void> = new Set();
  private subscribedSymbols: Set<string> = new Set();

  constructor() {
    console.log('CoinbaseWebSocket constructor called');
  }

  connect() {
    try {
      console.log('Connecting to Coinbase WebSocket:', this.url);
      this.onStatusCallback?.('loading');
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        console.log('WebSocket opened successfully');
        console.log(`WebSocket onopen: subscribedSymbols = ${Array.from(this.subscribedSymbols).join(', ')}`);
        // Always subscribe to channels when connection opens
        this.subscribeToChannels();
        this.startHeartbeat();
      };

      this.ws.onmessage = (event) => {
        try {
          const data: WebSocketMessage = JSON.parse(event.data);
          // Only log important messages, not ticker updates
          if (data.type === 'error' || data.type === 'subscriptions') {
            console.log('WebSocket message:', data.type, data);
          }
          
          switch (data.type) {
            case 'ticker':
              const tickerData = data as TickerMessage;
              console.log(`CoinbaseWebSocket: Received ticker for ${tickerData.product_id} - price: ${tickerData.price}, listeners: ${this.messageListeners.size}`);
              
              // Notify all message listeners
              this.messageListeners.forEach(listener => {
                try {
                  listener(tickerData);
                } catch (error) {
                  console.error('Error in message listener:', error);
                }
              });
              
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
        console.log('WebSocket disconnected');
        this.isSubscribed = false; // Reset subscription state
        this.onStatusCallback?.('disconnected');
        this.stopHeartbeat();
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
    console.log(`CoinbaseWebSocket: subscribeToChannels called, symbols: ${Array.from(this.subscribedSymbols).join(', ')}, ws state: ${this.ws?.readyState}`);
    if (this.ws?.readyState === WebSocket.OPEN && this.subscribedSymbols.size > 0) {
      const subscribeMessage: SubscribeMessage = {
        type: 'subscribe',
        product_ids: Array.from(this.subscribedSymbols),
        channels: ['ticker']
      };
      console.log('CoinbaseWebSocket: Sending subscribe message:', JSON.stringify(subscribeMessage));
      this.ws.send(JSON.stringify(subscribeMessage));
      this.isSubscribed = true;
    } else if (this.subscribedSymbols.size === 0) {
      console.log('CoinbaseWebSocket: No symbols to subscribe to yet');
    }
  }

  private startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        // Coinbase WebSocket doesn't require explicit heartbeat messages
        // Just check if connection is still alive
        console.log('WebSocket heartbeat check - connection still open');
      } else {
        console.log('WebSocket heartbeat check - connection lost, will reconnect');
        this.ws?.close();
      }
    }, 30000); // Check every 30 seconds
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }
    this.reconnectTimeout = setTimeout(() => {
      console.log('Attempting to reconnect to Coinbase...');
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
    console.log(`CoinbaseWebSocket: subscribeTicker called for ${symbol}`);
    this.subscribedSymbols.add(symbol);
    
    // Always try to subscribe immediately if connected
    if (this.ws?.readyState === WebSocket.OPEN) {
      // If already connected, send subscription immediately
      const subscribeMessage: SubscribeMessage = {
        type: 'subscribe',
        product_ids: [symbol],
        channels: ['ticker']
      };
      console.log(`CoinbaseWebSocket: Sending immediate subscribe message for ${symbol}:`, JSON.stringify(subscribeMessage));
      this.ws.send(JSON.stringify(subscribeMessage));
      this.isSubscribed = true;
    } else {
      console.log(`CoinbaseWebSocket: WebSocket not open (state: ${this.ws?.readyState}), symbol added to queue for connection`);
      // The subscription will be sent when the WebSocket connects
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
    }
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

export const coinbaseWebSocket = new CoinbaseWebSocket();