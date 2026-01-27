/**
 * @file webSocketManager.ts
 * @description Manages WebSocket connections for real-time data
 */

import { CoinbaseWebSocket } from './coinbaseWebSocket';
import type { TickerData } from '../../types/coinbase';

type DataConsumer = {
  id: string;
  onTicker: (data: TickerData) => void;
  onReconnect?: () => void;
};

export class WebSocketManager {
  private static instance: WebSocketManager;
  private ws: CoinbaseWebSocket;
  private consumers = new Map<string, DataConsumer>();
  private subscribedSymbols = new Set<string>();
  private isConnected = false;
  private connectionCheckInterval: ReturnType<typeof setInterval> | null = null;

  private constructor() {
    this.ws = new CoinbaseWebSocket();
    this.setupWebSocket();
  }

  static getInstance(): WebSocketManager {
    if (!WebSocketManager.instance) {
      WebSocketManager.instance = new WebSocketManager();
    }
    return WebSocketManager.instance;
  }

  private setupWebSocket() {
    // Subscribe to all WebSocket messages
    this.ws.subscribe((data: any) => {
      if (data.type === 'ticker') {
        this.broadcastTicker(data as TickerData);
      }
    });

    // Monitor connection status more aggressively
    this.ws.onStatus((status) => {
      
      if (status === 'connected' && !this.isConnected) {
        this.isConnected = true;
        this.resubscribeAll();
        
        // Notify all consumers about reconnection
        for (const consumer of this.consumers.values()) {
          if (consumer.onReconnect) {
            try {
              consumer.onReconnect();
            } catch (error) {
            }
          }
        }
      } else if (status !== 'connected' && this.isConnected) {
        this.isConnected = false;
      }
      
      // If disconnected or error, try to reconnect
      if (status === 'disconnected' || status === 'error') {
        setTimeout(() => {
          if (!this.ws.isConnected()) {
            this.connect();
          }
        }, 2000);
      }
    });

    // Also poll connection status as backup
    this.connectionCheckInterval = setInterval(() => {
      const connected = this.ws.isConnected();
      if (!connected && this.isConnected) {
        this.isConnected = false;
        // Attempt reconnection
        this.connect();
      }
    }, 5000); // Check every 5 seconds
  }

  private broadcastTicker(data: TickerData) {
    for (const consumer of this.consumers.values()) {
      try {
        consumer.onTicker(data);
      } catch (error) {
      }
    }
  }

  private async resubscribeAll() {
    for (const symbol of this.subscribedSymbols) {
      await this.ws.subscribeTicker(symbol);
    }
  }

  async connect(): Promise<void> {
    
    // Check if WebSocket is already connected or connecting
    if (this.ws.isConnected()) {
      this.isConnected = true;
      return;
    }
    
    this.ws.connect();
    
    // Wait for connection to establish (up to 5 seconds)
    let attempts = 0;
    while (!this.ws.isConnected() && attempts < 50) {
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }
    
    if (this.ws.isConnected()) {
      this.isConnected = true;
      // Resubscribe to all symbols
      await this.resubscribeAll();
    } else {
    }
  }

  async subscribeSymbol(symbol: string): Promise<void> {
    this.subscribedSymbols.add(symbol);
    
    if (this.isConnected) {
      await this.ws.subscribeTicker(symbol);
    } else {
    }
  }

  async unsubscribeSymbol(symbol: string): Promise<void> {
    this.subscribedSymbols.delete(symbol);
    
    if (this.isConnected) {
      await this.ws.unsubscribeTicker(symbol);
    }
  }

  registerConsumer(consumer: DataConsumer): () => void {
    this.consumers.set(consumer.id, consumer);
    
    return () => {
      this.consumers.delete(consumer.id);
    };
  }

  getLastPrice(symbol: string): number | null {
    return this.ws.getLastPrice();
  }

  isSymbolSubscribed(symbol: string): boolean {
    return this.subscribedSymbols.has(symbol);
  }

  getConnectionStatus(): boolean {
    return this.isConnected;
  }

  disconnect(): void {
    if (this.connectionCheckInterval) {
      clearInterval(this.connectionCheckInterval);
      this.connectionCheckInterval = null;
    }
    this.ws.disconnect();
    this.isConnected = false;
  }
}

export const webSocketManager = WebSocketManager.getInstance();