import { CoinbaseWebSocket } from './coinbaseWebSocket';
import type { TickerData } from '../types/coinbase';

type DataConsumer = {
  id: string;
  onTicker: (data: TickerData) => void;
};

export class WebSocketManager {
  private static instance: WebSocketManager;
  private ws: CoinbaseWebSocket;
  private consumers = new Map<string, DataConsumer>();
  private subscribedSymbols = new Set<string>();
  private isConnected = false;

  private constructor() {
    console.log('WebSocketManager: Creating singleton instance');
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

    // Poll connection status
    setInterval(() => {
      const connected = this.ws.isConnected();
      if (connected && !this.isConnected) {
        this.isConnected = true;
        this.resubscribeAll();
      } else if (!connected && this.isConnected) {
        this.isConnected = false;
      }
    }, 1000);
  }

  private broadcastTicker(data: TickerData) {
    console.log(`WebSocketManager: Broadcasting ticker data to ${this.consumers.size} consumers`);
    for (const consumer of this.consumers.values()) {
      try {
        console.log(`WebSocketManager: Sending to consumer ${consumer.id}`);
        consumer.onTicker(data);
      } catch (error) {
        console.error(`Error in consumer ${consumer.id}:`, error);
      }
    }
  }

  private async resubscribeAll() {
    for (const symbol of this.subscribedSymbols) {
      await this.ws.subscribeTicker(symbol);
    }
  }

  async connect(): Promise<void> {
    console.log('WebSocketManager: connect() called, isConnected:', this.isConnected);
    if (!this.isConnected) {
      this.ws.connect();
      // Wait a bit for connection to establish
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  async subscribeSymbol(symbol: string): Promise<void> {
    console.log('WebSocketManager: subscribeSymbol called for', symbol, 'isConnected:', this.isConnected);
    this.subscribedSymbols.add(symbol);
    
    if (this.isConnected) {
      await this.ws.subscribeTicker(symbol);
    } else {
      console.log('WebSocketManager: Not connected yet, symbol will be subscribed when connected');
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
    this.ws.disconnect();
  }
}

export const webSocketManager = WebSocketManager.getInstance();