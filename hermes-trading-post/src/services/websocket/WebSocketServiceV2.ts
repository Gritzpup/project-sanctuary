/**
 * @file WebSocketServiceV2.ts
 * @description Enhanced WebSocket service with circuit breaker and subscription management
 * Part of Phase 20: Real-time Data Pipeline
 * 🚀 Adds resilience, auto-recovery, and subscription tracking
 */

import { CircuitBreaker, createWebSocketCircuitBreaker } from './CircuitBreaker';
import { metricsCollector } from '../monitoring/MetricsCollector';

export enum WebSocketState {
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  DISCONNECTING = 'DISCONNECTING',
  DISCONNECTED = 'DISCONNECTED',
  ERROR = 'ERROR'
}

interface Subscription {
  id: string;
  channel: string;
  product_ids: string[];
  callback: (data: any) => void;
  createdAt: number;
}

interface WebSocketMessage {
  type: string;
  [key: string]: any;
}

/**
 * Enhanced WebSocket service with circuit breaker pattern
 */
export class WebSocketServiceV2 {
  private ws: WebSocket | null = null;
  private url: string;
  private state: WebSocketState = WebSocketState.DISCONNECTED;
  private circuitBreaker: CircuitBreaker;
  private subscriptions = new Map<string, Subscription>();
  private messageQueue: WebSocketMessage[] = [];
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 1000;
  private maxReconnectDelay = 30000;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private heartbeatInterval = 30000; // 30 seconds
  private debug: boolean = false;
  private stateChangeCallbacks: ((state: WebSocketState) => void)[] = [];

  constructor(url: string, debug = false) {
    this.url = url;
    this.debug = debug;
    this.circuitBreaker = createWebSocketCircuitBreaker();

    // Monitor circuit breaker state
    this.circuitBreaker.onStateChanged((newState, oldState) => {
      if (this.debug) {
      }

      // Auto-reconnect if transitioning to half-open
      if (newState === 'HALF_OPEN') {
        this.reconnect();
      }
    });

    if (this.debug) {
    }
  }

  /**
   * Connect to WebSocket
   */
  async connect(): Promise<void> {
    if (this.state === WebSocketState.CONNECTED || this.state === WebSocketState.CONNECTING) {
      if (this.debug) {
      }
      return;
    }

    this.setState(WebSocketState.CONNECTING);

    try {
      await this.circuitBreaker.execute(async () => {
        return new Promise<void>((resolve, reject) => {
          try {
            this.ws = new WebSocket(this.url);

            this.ws.onopen = () => {
              if (this.debug) {
              }
              this.setState(WebSocketState.CONNECTED);
              this.reconnectAttempts = 0;
              this.reconnectDelay = 1000;
              this.startHeartbeat();
              this.flushMessageQueue();
              resolve();
            };

            this.ws.onmessage = (event) => {
              this.handleMessage(event.data);
            };

            this.ws.onerror = (error) => {
              if (this.debug) {
              }
              this.setState(WebSocketState.ERROR);
              reject(new Error('WebSocket error'));
            };

            this.ws.onclose = () => {
              if (this.debug) {
              }
              this.setState(WebSocketState.DISCONNECTED);
              this.stopHeartbeat();
              this.scheduleReconnect();
            };
          } catch (error) {
            reject(error);
          }
        });
      });
    } catch (error) {
      if (this.debug) {
      }
      this.setState(WebSocketState.ERROR);
      this.scheduleReconnect();
    }
  }

  /**
   * Disconnect from WebSocket
   */
  async disconnect(): Promise<void> {
    if (this.state === WebSocketState.DISCONNECTED || this.state === WebSocketState.DISCONNECTING) {
      return;
    }

    this.setState(WebSocketState.DISCONNECTING);
    this.stopHeartbeat();

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.setState(WebSocketState.DISCONNECTED);
    if (this.debug) {
    }
  }

  /**
   * Subscribe to channel
   */
  subscribe(
    channel: string,
    product_ids: string[],
    callback: (data: any) => void
  ): string {
    const subscriptionId = `sub-${Date.now()}-${Math.random()}`;

    const subscription: Subscription = {
      id: subscriptionId,
      channel,
      product_ids,
      callback,
      createdAt: Date.now()
    };

    this.subscriptions.set(subscriptionId, subscription);

    if (this.debug) {
    }

    // Send subscription if connected
    if (this.state === WebSocketState.CONNECTED && this.ws) {
      const message = {
        type: 'subscribe',
        channels: [{ name: channel, product_ids }]
      };
      this.send(message);
    }

    // Record metric
    metricsCollector.recordEvent('websocket_subscribe', {
      channel,
      product_count: product_ids.length
    });

    return subscriptionId;
  }

  /**
   * Unsubscribe from channel
   */
  unsubscribe(subscriptionId: string): void {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) return;

    this.subscriptions.delete(subscriptionId);

    if (this.debug) {
    }

    // Send unsubscribe message if connected
    if (this.state === WebSocketState.CONNECTED && this.ws) {
      const message = {
        type: 'unsubscribe',
        channels: [{ name: subscription.channel, product_ids: subscription.product_ids }]
      };
      this.send(message);
    }

    // Record metric
    metricsCollector.recordEvent('websocket_unsubscribe', {
      channel: subscription.channel
    });
  }

  /**
   * Send message
   */
  send(message: WebSocketMessage): void {
    if (this.state === WebSocketState.CONNECTED && this.ws) {
      try {
        this.ws.send(JSON.stringify(message));
      } catch (error) {
        if (this.debug) {
        }
        this.messageQueue.push(message);
      }
    } else {
      this.messageQueue.push(message);
    }
  }

  /**
   * Get current state
   */
  getState(): WebSocketState {
    return this.state;
  }

  /**
   * Register state change callback
   */
  onStateChange(callback: (state: WebSocketState) => void): () => void {
    this.stateChangeCallbacks.push(callback);

    // Return unsubscribe function
    return () => {
      const index = this.stateChangeCallbacks.indexOf(callback);
      if (index > -1) {
        this.stateChangeCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Get subscription stats
   */
  getStats(): {
    state: WebSocketState;
    subscriptionCount: number;
    messageQueueSize: number;
    circuitBreakerState: string;
    reconnectAttempts: number;
  } {
    return {
      state: this.state,
      subscriptionCount: this.subscriptions.size,
      messageQueueSize: this.messageQueue.length,
      circuitBreakerState: this.circuitBreaker.getState(),
      reconnectAttempts: this.reconnectAttempts
    };
  }

  /**
   * Private: Handle incoming message
   */
  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data);

      // Record latency
      if (message.time) {
        const latency = Date.now() - new Date(message.time).getTime();
        metricsCollector.recordWebSocketLatency(Math.abs(latency));
      }

      // Dispatch to subscriptions
      for (const subscription of this.subscriptions.values()) {
        if (
          message.type === subscription.channel ||
          (message.product_id && subscription.product_ids.includes(message.product_id))
        ) {
          try {
            subscription.callback(message);
          } catch (error) {
            if (this.debug) {
            }
            metricsCollector.recordEvent('websocket_callback_error', {
              channel: subscription.channel
            });
          }
        }
      }
    } catch (error) {
      if (this.debug) {
      }
    }
  }

  /**
   * Private: Reconnect
   */
  private reconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      if (this.debug) {
      }
      metricsCollector.recordEvent('websocket_max_reconnects_reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1), this.maxReconnectDelay);

    if (this.debug) {
    }

    this.connect().catch((error) => {
      if (this.debug) {
      }
    });
  }

  /**
   * Private: Schedule reconnect
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts), this.maxReconnectDelay);

    this.reconnectTimer = setTimeout(() => {
      this.reconnect();
    }, delay);
  }

  /**
   * Private: Start heartbeat
   */
  private startHeartbeat(): void {
    this.stopHeartbeat();

    this.heartbeatTimer = setInterval(() => {
      if (this.state === WebSocketState.CONNECTED && this.ws) {
        try {
          this.ws.send(JSON.stringify({ type: 'heartbeat' }));
        } catch (error) {
          if (this.debug) {
          }
        }
      }
    }, this.heartbeatInterval);
  }

  /**
   * Private: Stop heartbeat
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * Private: Flush message queue
   */
  private flushMessageQueue(): void {
    while (this.messageQueue.length > 0 && this.state === WebSocketState.CONNECTED) {
      const message = this.messageQueue.shift();
      if (message) {
        this.send(message);
      }
    }
  }

  /**
   * Private: Set state and notify callbacks
   */
  private setState(newState: WebSocketState): void {
    if (this.state === newState) return;

    const oldState = this.state;
    this.state = newState;

    if (this.debug) {
    }

    for (const callback of this.stateChangeCallbacks) {
      try {
        callback(newState);
      } catch (error) {
        if (this.debug) {
        }
      }
    }
  }
}
