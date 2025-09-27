// Unified WebSocket management to eliminate duplication

export interface WebSocketConfig {
  url: string;
  protocols?: string[];
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  pingInterval?: number;
  pongTimeout?: number;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Event) => void;
  onMessage?: (data: any) => void;
}

export interface WebSocketMessage {
  type: string;
  data?: any;
  timestamp?: number;
}

export class WebSocketManager {
  private ws: WebSocket | null = null;
  private config: WebSocketConfig;
  private reconnectTimer: any = null;
  private reconnectAttempts = 0;
  private pingTimer: any = null;
  private pongTimer: any = null;
  private isConnected = false;
  private isReconnecting = false;
  private messageQueue: WebSocketMessage[] = [];
  private subscriptions: Map<string, Set<(data: any) => void>> = new Map();

  constructor(config: WebSocketConfig) {
    this.config = {
      reconnectInterval: 5000,
      maxReconnectAttempts: 10,
      pingInterval: 30000,
      pongTimeout: 10000,
      ...config
    };
  }

  public connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.isConnected || this.isReconnecting) {
        resolve();
        return;
      }

      this.isReconnecting = true;

      try {
        this.ws = new WebSocket(this.config.url, this.config.protocols);

        this.ws.onopen = () => {
          console.log(`🟢 WebSocket connected to ${this.config.url}`);
          this.isConnected = true;
          this.isReconnecting = false;
          this.reconnectAttempts = 0;
          
          this.startPing();
          this.flushMessageQueue();
          
          if (this.config.onConnect) {
            this.config.onConnect();
          }
          
          resolve();
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event);
        };

        this.ws.onclose = (event) => {
          console.log(`🔴 WebSocket disconnected from ${this.config.url}`, event.code, event.reason);
          this.handleDisconnect();
        };

        this.ws.onerror = (error) => {
          console.error(`❌ WebSocket error on ${this.config.url}:`, error);
          this.isReconnecting = false;
          
          if (this.config.onError) {
            this.config.onError(error);
          }
          
          reject(error);
        };

      } catch (error) {
        this.isReconnecting = false;
        console.error('Error creating WebSocket:', error);
        reject(error);
      }
    });
  }

  public disconnect(): void {
    console.log(`🛑 Disconnecting WebSocket from ${this.config.url}`);
    
    this.clearTimers();
    this.isConnected = false;
    this.isReconnecting = false;
    
    if (this.ws) {
      this.ws.close(1000, 'Manual disconnect');
      this.ws = null;
    }
  }

  public send(message: WebSocketMessage): void {
    if (this.isConnected && this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        const messageWithTimestamp = {
          ...message,
          timestamp: Date.now()
        };
        this.ws.send(JSON.stringify(messageWithTimestamp));
      } catch (error) {
        console.error('Error sending WebSocket message:', error);
        this.queueMessage(message);
      }
    } else {
      this.queueMessage(message);
    }
  }

  public subscribe(eventType: string, callback: (data: any) => void): () => void {
    if (!this.subscriptions.has(eventType)) {
      this.subscriptions.set(eventType, new Set());
    }
    
    this.subscriptions.get(eventType)!.add(callback);
    
    // Return unsubscribe function
    return () => {
      const callbacks = this.subscriptions.get(eventType);
      if (callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          this.subscriptions.delete(eventType);
        }
      }
    };
  }

  public unsubscribe(eventType: string, callback?: (data: any) => void): void {
    if (callback) {
      const callbacks = this.subscriptions.get(eventType);
      if (callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          this.subscriptions.delete(eventType);
        }
      }
    } else {
      this.subscriptions.delete(eventType);
    }
  }

  public getConnectionState(): {
    isConnected: boolean;
    isReconnecting: boolean;
    reconnectAttempts: number;
    queuedMessages: number;
    subscriptions: number;
  } {
    return {
      isConnected: this.isConnected,
      isReconnecting: this.isReconnecting,
      reconnectAttempts: this.reconnectAttempts,
      queuedMessages: this.messageQueue.length,
      subscriptions: this.subscriptions.size
    };
  }

  private handleMessage(event: MessageEvent): void {
    try {
      const data = JSON.parse(event.data);
      
      // Handle pong messages
      if (data.type === 'pong') {
        this.handlePong();
        return;
      }
      
      // Notify general message handler
      if (this.config.onMessage) {
        this.config.onMessage(data);
      }
      
      // Notify specific subscribers
      const callbacks = this.subscriptions.get(data.type);
      if (callbacks) {
        callbacks.forEach(callback => {
          try {
            callback(data);
          } catch (error) {
            console.error(`Error in WebSocket subscription callback for '${data.type}':`, error);
          }
        });
      }
      
    } catch (error) {
      console.error('Error parsing WebSocket message:', error, event.data);
    }
  }

  private handleDisconnect(): void {
    this.isConnected = false;
    this.clearTimers();
    
    if (this.config.onDisconnect) {
      this.config.onDisconnect();
    }
    
    this.startReconnection();
  }

  private startReconnection(): void {
    if (this.isReconnecting || this.reconnectAttempts >= this.config.maxReconnectAttempts!) {
      if (this.reconnectAttempts >= this.config.maxReconnectAttempts!) {
        console.error(`❌ Max reconnection attempts (${this.config.maxReconnectAttempts}) reached for ${this.config.url}`);
      }
      return;
    }

    this.reconnectAttempts++;
    const delay = this.config.reconnectInterval! * Math.pow(2, Math.min(this.reconnectAttempts - 1, 4));
    
    console.log(`🔄 Reconnecting to ${this.config.url} in ${delay}ms (attempt ${this.reconnectAttempts})`);
    
    this.reconnectTimer = setTimeout(() => {
      this.connect().catch(error => {
        console.error('Reconnection failed:', error);
      });
    }, delay);
  }

  private queueMessage(message: WebSocketMessage): void {
    this.messageQueue.push(message);
    
    // Limit queue size to prevent memory issues
    if (this.messageQueue.length > 100) {
      this.messageQueue.shift();
    }
  }

  private flushMessageQueue(): void {
    if (this.messageQueue.length > 0) {
      console.log(`📤 Flushing ${this.messageQueue.length} queued messages`);
      
      const messages = [...this.messageQueue];
      this.messageQueue = [];
      
      messages.forEach(message => this.send(message));
    }
  }

  private startPing(): void {
    if (this.config.pingInterval! > 0) {
      this.pingTimer = setInterval(() => {
        this.sendPing();
      }, this.config.pingInterval);
    }
  }

  private sendPing(): void {
    if (this.isConnected && this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.send({ type: 'ping' });
      
      // Start pong timeout
      this.pongTimer = setTimeout(() => {
        console.warn('Pong timeout - connection may be dead');
        this.ws?.close();
      }, this.config.pongTimeout);
    }
  }

  private handlePong(): void {
    if (this.pongTimer) {
      clearTimeout(this.pongTimer);
      this.pongTimer = null;
    }
  }

  private clearTimers(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
    
    if (this.pongTimer) {
      clearTimeout(this.pongTimer);
      this.pongTimer = null;
    }
  }
}

// WebSocket Manager Factory for common configurations
export class WebSocketFactory {
  public static createTradingWebSocket(url: string): WebSocketManager {
    return new WebSocketManager({
      url,
      reconnectInterval: 3000,
      maxReconnectAttempts: 10,
      pingInterval: 30000,
      pongTimeout: 10000
    });
  }

  public static createChartDataWebSocket(url: string): WebSocketManager {
    return new WebSocketManager({
      url,
      reconnectInterval: 5000,
      maxReconnectAttempts: 5,
      pingInterval: 60000,
      pongTimeout: 15000
    });
  }

  public static createNotificationWebSocket(url: string): WebSocketManager {
    return new WebSocketManager({
      url,
      reconnectInterval: 10000,
      maxReconnectAttempts: 3,
      pingInterval: 120000,
      pongTimeout: 30000
    });
  }
}