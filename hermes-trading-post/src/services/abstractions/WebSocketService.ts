import { ServiceBase } from '../core/ServiceBase';

/**
 * WebSocket connection states
 */
export enum WebSocketState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  RECONNECTING = 'reconnecting',
  ERROR = 'error'
}

/**
 * WebSocket message types
 */
export interface WebSocketMessage<T = any> {
  type: string;
  data: T;
  timestamp?: number;
  id?: string;
}

/**
 * WebSocket configuration
 */
export interface WebSocketConfig {
  url: string;
  protocols?: string[];
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  heartbeatInterval?: number;
  messageTimeout?: number;
  autoReconnect?: boolean;
}

/**
 * Abstract base class for WebSocket services
 * Provides connection management, automatic reconnection, and message handling
 */
export abstract class WebSocketService extends ServiceBase {
  protected ws: WebSocket | null = null;
  protected config: Required<WebSocketConfig>;
  protected state: WebSocketState = WebSocketState.DISCONNECTED;
  protected reconnectAttempts: number = 0;
  protected reconnectTimer: any = null;
  protected heartbeatTimer: any = null;
  protected messageQueue: WebSocketMessage[] = [];
  protected pendingMessages: Map<string, {
    resolve: (value: any) => void;
    reject: (error: any) => void;
    timeout: any;
  }> = new Map();
  protected messageCounter: number = 0;

  constructor(config: WebSocketConfig) {
    super();
    
    this.config = {
      protocols: [],
      reconnectInterval: 5000,
      maxReconnectAttempts: 10,
      heartbeatInterval: 30000,
      messageTimeout: 10000,
      autoReconnect: true,
      ...config
    };
  }

  /**
   * Connect to WebSocket server
   */
  public async connect(): Promise<void> {
    this.assertInitialized();
    this.assertNotDisposed();

    if (this.state === WebSocketState.CONNECTED || this.state === WebSocketState.CONNECTING) {
      return;
    }

    this.setState(WebSocketState.CONNECTING);
    this.emit('connection:connecting', {});

    try {
      await this.createConnection();
    } catch (error) {
      this.setState(WebSocketState.ERROR);
      this.emit('connection:error', { error });
      throw error;
    }
  }

  /**
   * Disconnect from WebSocket server
   */
  public disconnect(): void {
    this.cleanup();
    this.setState(WebSocketState.DISCONNECTED);
    this.emit('connection:disconnected', { manual: true });
  }

  /**
   * Send message to server
   */
  public async send<T = any>(message: WebSocketMessage<T>): Promise<void> {
    if (this.state !== WebSocketState.CONNECTED) {
      if (this.config.autoReconnect) {
        // Queue message for when reconnected
        this.messageQueue.push(message);
        this.emit('message:queued', { message });
        return;
      } else {
        throw new Error('WebSocket is not connected');
      }
    }

    const messageWithId = {
      ...message,
      id: message.id || this.generateMessageId(),
      timestamp: Date.now()
    };

    try {
      this.ws!.send(JSON.stringify(messageWithId));
      this.emit('message:sent', { message: messageWithId });
    } catch (error) {
      this.emit('message:error', { message: messageWithId, error });
      throw error;
    }
  }

  /**
   * Send message and wait for response
   */
  public async request<TRequest = any, TResponse = any>(
    message: WebSocketMessage<TRequest>
  ): Promise<TResponse> {
    const messageId = message.id || this.generateMessageId();
    const messageWithId = { ...message, id: messageId };

    return new Promise((resolve, reject) => {
      // Set up timeout
      const timeout = setTimeout(() => {
        this.pendingMessages.delete(messageId);
        reject(new Error(`Request timeout for message ${messageId}`));
      }, this.config.messageTimeout);

      // Store pending request
      this.pendingMessages.set(messageId, { resolve, reject, timeout });

      // Send message
      this.send(messageWithId).catch(error => {
        this.pendingMessages.delete(messageId);
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  /**
   * Get current connection state
   */
  public getState(): WebSocketState {
    return this.state;
  }

  /**
   * Check if connected
   */
  public isConnected(): boolean {
    return this.state === WebSocketState.CONNECTED;
  }

  /**
   * Get connection statistics
   */
  public getStats(): {
    state: WebSocketState;
    reconnectAttempts: number;
    queuedMessages: number;
    pendingRequests: number;
    uptime: number;
  } {
    return {
      state: this.state,
      reconnectAttempts: this.reconnectAttempts,
      queuedMessages: this.messageQueue.length,
      pendingRequests: this.pendingMessages.size,
      uptime: this.isConnected() ? Date.now() - this.connectionTime : 0
    };
  }

  protected async onInitialize(): Promise<void> {
    if (this.config.autoReconnect) {
      await this.connect();
    }
  }

  protected async onDispose(): Promise<void> {
    this.cleanup();
  }

  /**
   * Abstract methods for subclasses
   */
  protected abstract onConnected(): void;
  protected abstract onDisconnected(reason: string): void;
  protected abstract onMessage(message: WebSocketMessage): void;
  protected abstract onError(error: Event): void;

  /**
   * Optional hooks for authentication and health checks
   */
  protected async authenticate(): Promise<void> {
    // Override in subclasses if authentication is needed
  }

  protected createHeartbeatMessage(): WebSocketMessage {
    return { type: 'ping', data: null };
  }

  protected isHeartbeatResponse(message: WebSocketMessage): boolean {
    return message.type === 'pong';
  }

  private connectionTime: number = 0;

  /**
   * Create WebSocket connection
   */
  private async createConnection(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.config.url, this.config.protocols);
        
        this.ws.onopen = async () => {
          this.connectionTime = Date.now();
          this.setState(WebSocketState.CONNECTED);
          this.reconnectAttempts = 0;
          
          try {
            // Authenticate if needed
            await this.authenticate();
            
            // Process queued messages
            await this.processMessageQueue();
            
            // Start heartbeat
            this.startHeartbeat();
            
            // Notify subclass
            this.onConnected();
            
            this.emit('connection:connected', {});
            resolve();
          } catch (error) {
            reject(error);
          }
        };

        this.ws.onclose = (event) => {
          this.handleDisconnection(event.reason || 'Connection closed');
        };

        this.ws.onerror = (event) => {
          this.onError(event);
          this.emit('connection:error', { event });
        };

        this.ws.onmessage = (event) => {
          try {
            const message: WebSocketMessage = JSON.parse(event.data);
            this.handleMessage(message);
          } catch (error) {
            console.error('Failed to parse WebSocket message:', error);
            this.emit('message:parseError', { rawData: event.data, error });
          }
        };

      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Handle incoming messages
   */
  private handleMessage(message: WebSocketMessage): void {
    // Check if this is a response to a pending request
    if (message.id && this.pendingMessages.has(message.id)) {
      const pending = this.pendingMessages.get(message.id)!;
      clearTimeout(pending.timeout);
      this.pendingMessages.delete(message.id);
      pending.resolve(message.data);
      return;
    }

    // Check if this is a heartbeat response
    if (this.isHeartbeatResponse(message)) {
      this.emit('heartbeat:response', {});
      return;
    }

    // Emit message event
    this.emit('message:received', { message });

    // Call subclass handler
    this.onMessage(message);
  }

  /**
   * Handle disconnection
   */
  private handleDisconnection(reason: string): void {
    this.cleanup();
    this.setState(WebSocketState.DISCONNECTED);
    this.onDisconnected(reason);
    this.emit('connection:disconnected', { reason, manual: false });

    // Auto-reconnect if enabled
    if (this.config.autoReconnect && this.reconnectAttempts < this.config.maxReconnectAttempts) {
      this.scheduleReconnect();
    }
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect(): void {
    this.setState(WebSocketState.RECONNECTING);
    this.reconnectAttempts++;
    
    const delay = this.config.reconnectInterval * Math.pow(1.5, this.reconnectAttempts - 1);
    
    this.emit('connection:reconnecting', { 
      attempt: this.reconnectAttempts, 
      maxAttempts: this.config.maxReconnectAttempts,
      delay
    });

    this.reconnectTimer = setTimeout(() => {
      this.connect().catch(error => {
        console.error('Reconnection failed:', error);
      });
    }, delay);
  }

  /**
   * Process queued messages
   */
  private async processMessageQueue(): Promise<void> {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift()!;
      try {
        await this.send(message);
      } catch (error) {
        console.error('Failed to send queued message:', error);
        // Re-queue the message
        this.messageQueue.unshift(message);
        break;
      }
    }
  }

  /**
   * Start heartbeat mechanism
   */
  private startHeartbeat(): void {
    if (this.config.heartbeatInterval > 0) {
      this.heartbeatTimer = setInterval(() => {
        if (this.isConnected()) {
          this.send(this.createHeartbeatMessage()).catch(error => {
            console.error('Heartbeat failed:', error);
          });
        }
      }, this.config.heartbeatInterval);
    }
  }

  /**
   * Clean up resources
   */
  private cleanup(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    // Reject all pending messages
    for (const [id, pending] of this.pendingMessages) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('Connection closed'));
    }
    this.pendingMessages.clear();
  }

  /**
   * Set connection state
   */
  private setState(newState: WebSocketState): void {
    const previousState = this.state;
    this.state = newState;
    this.emit('state:changed', { previous: previousState, current: newState });
  }

  /**
   * Generate unique message ID
   */
  private generateMessageId(): string {
    return `msg-${Date.now()}-${++this.messageCounter}`;
  }
}