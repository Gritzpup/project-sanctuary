import type { WebSocketMessage, TickerMessage, SubscribeMessage } from '../types/coinbase';

export class CoinbaseWebSocket {
  private ws: WebSocket | null = null;
  private url = 'wss://ws-feed.exchange.coinbase.com';
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private onPriceCallback: ((price: number) => void) | null = null;
  private onStatusCallback: ((status: 'connected' | 'disconnected' | 'error' | 'loading') => void) | null = null;
  private currentPrice: number = 0;

  constructor() {
    console.log('CoinbaseWebSocket constructor called');
    this.connect();
  }

  private connect() {
    try {
      console.log('Connecting to Coinbase WebSocket:', this.url);
      this.onStatusCallback?.('loading');
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        console.log('WebSocket opened successfully');
        this.subscribe();
        this.startHeartbeat();
      };

      this.ws.onmessage = (event) => {
        try {
          const data: WebSocketMessage = JSON.parse(event.data);
          console.log('WebSocket message type:', data.type, data.product_id || '');
          
          switch (data.type) {
            case 'ticker':
              if (data.product_id === 'BTC-USD') {
                const tickerData = data as TickerMessage;
                if (tickerData.price) {
                  this.currentPrice = parseFloat(tickerData.price);
                  this.onPriceCallback?.(this.currentPrice);
                  // Update status to connected when we receive first ticker
                  if (this.onStatusCallback) {
                    this.onStatusCallback('connected');
                  }
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

  private subscribe() {
    if (this.ws?.readyState === WebSocket.OPEN) {
      const subscribeMessage: SubscribeMessage = {
        type: 'subscribe',
        product_ids: ['BTC-USD'],
        channels: ['ticker']
      };
      console.log('Sending subscribe message:', subscribeMessage);
      this.ws.send(JSON.stringify(subscribeMessage));
    } else {
      console.error('Cannot subscribe - WebSocket not open. ReadyState:', this.ws?.readyState);
    }
  }

  private startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        // Coinbase doesn't require explicit heartbeat, but we check connection
        // by re-subscribing to keep the connection alive
        const subscribeMessage: SubscribeMessage = {
          type: 'subscribe',
          product_ids: ['BTC-USD'],
          channels: ['ticker']
        };
        this.ws.send(JSON.stringify(subscribeMessage));
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

  getCurrentPrice(): number {
    return this.currentPrice;
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