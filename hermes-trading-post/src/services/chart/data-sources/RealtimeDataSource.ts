import type { CandleData } from '../../../types/coinbase';
import { getBackendWsUrl } from '../../../utils/backendConfig';

export class RealtimeDataSource {
  private websocket: WebSocket | null = null;
  private reconnectTimer: any = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  
  private subscriptions: Set<string> = new Set();
  private candleUpdateCallbacks: ((candle: CandleData, metadata: any) => void)[] = [];
  private connectionChangeCallbacks: ((connected: boolean) => void)[] = [];
  
  private isConnected = false;

  constructor() {
    this.connect();
  }

  public async subscribe(symbol: string, granularity: string): Promise<void> {
    const subscriptionKey = `${symbol}:${granularity}`;
    
    if (this.subscriptions.has(subscriptionKey)) {
      return;
    }
    
    this.subscriptions.add(subscriptionKey);
    
    if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
      this.sendSubscription(symbol, granularity);
    }
    
    console.log(`📡 Subscribed to realtime data: ${subscriptionKey}`);
  }

  public async unsubscribe(symbol: string, granularity: string): Promise<void> {
    const subscriptionKey = `${symbol}:${granularity}`;
    this.subscriptions.delete(subscriptionKey);
    
    if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
      this.sendUnsubscription(symbol, granularity);
    }
    
    console.log(`📡 Unsubscribed from realtime data: ${subscriptionKey}`);
  }

  public onCandleUpdate(callback: (candle: CandleData, metadata: any) => void): void {
    this.candleUpdateCallbacks.push(callback);
  }

  public onConnectionChange(callback: (connected: boolean) => void): void {
    this.connectionChangeCallbacks.push(callback);
  }

  private connect(): void {
    try {
      this.websocket = new WebSocket(getBackendWsUrl());
      
      this.websocket.onopen = () => {
        console.log('🟢 Realtime data WebSocket connected');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.notifyConnectionChange(true);
        
        // Resubscribe to all active subscriptions
        this.resubscribeAll();
      };
      
      this.websocket.onmessage = (event) => {
        this.handleMessage(event);
      };
      
      this.websocket.onclose = () => {
        console.log('🔴 Realtime data WebSocket disconnected');
        this.isConnected = false;
        this.notifyConnectionChange(false);
        this.handleReconnect();
      };
      
      this.websocket.onerror = (error) => {
        console.error('Realtime data WebSocket error:', error);
      };
      
    } catch (error) {
      console.error('Error connecting to realtime data WebSocket:', error);
      this.handleReconnect();
    }
  }

  private handleMessage(event: MessageEvent): void {
    try {
      const data = JSON.parse(event.data);
      
      if (data.type === 'candle') {
        const candle: CandleData = {
          symbol: data.pair,
          time: data.time,
          open: data.open,
          high: data.high,
          low: data.low,
          close: data.close,
          volume: data.volume
        };
        
        const metadata = {
          granularity: data.granularity,
          candleType: data.candleType
        };
        
        this.notifyCandleUpdate(candle, metadata);
      }
      
    } catch (error) {
      console.error('Error parsing realtime data message:', error);
    }
  }

  private sendSubscription(symbol: string, granularity: string): void {
    if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
      this.websocket.send(JSON.stringify({
        type: 'subscribe',
        pair: symbol,
        granularity: granularity
      }));
    }
  }

  private sendUnsubscription(symbol: string, granularity: string): void {
    if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
      this.websocket.send(JSON.stringify({
        type: 'unsubscribe',
        pair: symbol,
        granularity: granularity
      }));
    }
  }

  private resubscribeAll(): void {
    this.subscriptions.forEach(subscription => {
      const [symbol, granularity] = subscription.split(':');
      this.sendSubscription(symbol, granularity);
    });
  }

  private handleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached for realtime data');
      return;
    }
    
    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    console.log(`🔄 Reconnecting to realtime data in ${delay}ms (attempt ${this.reconnectAttempts})`);
    
    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }

  private notifyCandleUpdate(candle: CandleData, metadata: any): void {
    this.candleUpdateCallbacks.forEach(callback => {
      try {
        callback(candle, metadata);
      } catch (error) {
        console.error('Error in candle update callback:', error);
      }
    });
  }

  private notifyConnectionChange(connected: boolean): void {
    this.connectionChangeCallbacks.forEach(callback => {
      try {
        callback(connected);
      } catch (error) {
        console.error('Error in connection change callback:', error);
      }
    });
  }

  public getConnectionStatus(): boolean {
    return this.isConnected;
  }

  public async cleanup(): Promise<void> {
    console.log('🧹 Cleaning up RealtimeDataSource');
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    
    if (this.websocket) {
      this.websocket.close();
      this.websocket = null;
    }
    
    this.subscriptions.clear();
    this.candleUpdateCallbacks = [];
    this.connectionChangeCallbacks = [];
    this.isConnected = false;
    
    console.log('✅ RealtimeDataSource cleanup complete');
  }
}