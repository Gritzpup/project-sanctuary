/**
 * @file websocket-batcher.ts
 * @description WebSocket message batching utility for reducing message overhead
 * 🚀 PHASE 16d: Batch multiple messages into single transmission
 */

/**
 * WebSocket message batcher
 * Collects messages and sends them in batches to reduce network overhead
 */
export class WebSocketBatcher {
  private batch: any[] = [];
  private batchTimeout: ReturnType<typeof setTimeout> | null = null;
  private socket: WebSocket | null = null;
  private readonly BATCH_INTERVAL_MS: number;
  private readonly MAX_BATCH_SIZE: number;
  private readonly IMMEDIATE_THRESHOLD: number;

  /**
   * Create a new WebSocket batcher
   * @param batchIntervalMs Time to wait before flushing batch (default: 50ms)
   * @param maxBatchSize Maximum messages before forcing flush (default: 20)
   * @param immediateThreshold Send immediately if this many messages (default: 1)
   */
  constructor(
    batchIntervalMs: number = 50,
    maxBatchSize: number = 20,
    immediateThreshold: number = 1
  ) {
    this.BATCH_INTERVAL_MS = batchIntervalMs;
    this.MAX_BATCH_SIZE = maxBatchSize;
    this.IMMEDIATE_THRESHOLD = immediateThreshold;
  }

  /**
   * Set the WebSocket connection
   */
  setWebSocket(socket: WebSocket): void {
    this.socket = socket;
  }

  /**
   * Add a message to the batch
   * @param message Message to batch
   * @param immediate Send immediately (bypass batching)
   */
  addMessage(message: any, immediate: boolean = false): void {
    if (!this.socket) {
      console.warn('WebSocketBatcher: No socket connected');
      return;
    }

    if (immediate) {
      this.socket.send(JSON.stringify(message));
      return;
    }

    this.batch.push(message);

    // Send immediately if batch is large
    if (this.batch.length >= this.MAX_BATCH_SIZE) {
      this.flush();
    } else if (!this.batchTimeout) {
      // Schedule flush for next batch window
      this.batchTimeout = setTimeout(() => this.flush(), this.BATCH_INTERVAL_MS);
    }
  }

  /**
   * Flush current batch
   */
  private flush(): void {
    if (this.batch.length === 0 || !this.socket) return;

    try {
      // Create batch message
      const batchMessage = {
        type: 'batch',
        messages: this.batch,
        timestamp: Date.now()
      };

      // Send as JSON
      this.socket.send(JSON.stringify(batchMessage));

      // Clear batch
      this.batch = [];

      // Clear timeout
      if (this.batchTimeout) {
        clearTimeout(this.batchTimeout);
        this.batchTimeout = null;
      }
    } catch (error) {
      console.error('WebSocketBatcher: Error flushing batch:', error);
    }
  }

  /**
   * Force flush the current batch (call before closing connection)
   */
  forceFlush(): void {
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = null;
    }
    this.flush();
  }

  /**
   * Get current batch size
   */
  getBatchSize(): number {
    return this.batch.length;
  }

  /**
   * Get statistics
   */
  getStats(): {
    pendingMessages: number;
    hasScheduledFlush: boolean;
  } {
    return {
      pendingMessages: this.batch.length,
      hasScheduledFlush: this.batchTimeout !== null
    };
  }

  /**
   * Clear all pending messages
   */
  clear(): void {
    this.batch = [];
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = null;
    }
  }
}

/**
 * Batch decoder for server side
 * Decodes batched messages from client
 */
export class WebSocketBatchDecoder {
  /**
   * Decode a potential batch message
   * @param message Raw message data
   * @returns Array of decoded messages
   */
  static decode(message: any): any[] {
    try {
      if (typeof message === 'string') {
        message = JSON.parse(message);
      }

      // Check if this is a batch message
      if (message && message.type === 'batch' && Array.isArray(message.messages)) {
        return message.messages;
      }

      // Single message, return as array
      return [message];
    } catch (error) {
      console.error('WebSocketBatchDecoder: Error decoding message:', error);
      return [];
    }
  }
}

/**
 * Server-side batch sender
 * Batches messages to client
 */
export class WebSocketBatchSender {
  private batches: Map<WebSocket, any[]> = new Map();
  private timeouts: Map<WebSocket, ReturnType<typeof setTimeout>> = new Map();
  private readonly BATCH_INTERVAL_MS: number;
  private readonly MAX_BATCH_SIZE: number;

  /**
   * Create a new WebSocket batch sender
   * @param batchIntervalMs Time to wait before flushing batch
   * @param maxBatchSize Maximum messages before forcing flush
   */
  constructor(batchIntervalMs: number = 50, maxBatchSize: number = 20) {
    this.BATCH_INTERVAL_MS = batchIntervalMs;
    this.MAX_BATCH_SIZE = maxBatchSize;
  }

  /**
   * Add a message to a client's batch
   * @param socket Client WebSocket connection
   * @param message Message to send
   */
  addMessage(socket: WebSocket, message: any): void {
    if (socket.readyState !== WebSocket.OPEN) return;

    let batch = this.batches.get(socket);
    if (!batch) {
      batch = [];
      this.batches.set(socket, batch);
    }

    batch.push(message);

    // Send immediately if batch is full
    if (batch.length >= this.MAX_BATCH_SIZE) {
      this.flush(socket);
    } else if (!this.timeouts.has(socket)) {
      // Schedule flush
      const timeout = setTimeout(() => this.flush(socket), this.BATCH_INTERVAL_MS);
      this.timeouts.set(socket, timeout);
    }
  }

  /**
   * Flush batch for a specific client
   */
  private flush(socket: WebSocket): void {
    const batch = this.batches.get(socket);
    if (!batch || batch.length === 0 || socket.readyState !== WebSocket.OPEN) {
      return;
    }

    try {
      const batchMessage = {
        type: 'batch',
        messages: batch,
        timestamp: Date.now()
      };

      socket.send(JSON.stringify(batchMessage));

      // Clear batch
      this.batches.delete(socket);

      // Clear timeout
      const timeout = this.timeouts.get(socket);
      if (timeout) {
        clearTimeout(timeout);
        this.timeouts.delete(socket);
      }
    } catch (error) {
      console.error('WebSocketBatchSender: Error sending batch:', error);
    }
  }

  /**
   * Cleanup when client disconnects
   */
  cleanup(socket: WebSocket): void {
    // Flush any pending messages
    this.flush(socket);

    // Clear timeouts
    const timeout = this.timeouts.get(socket);
    if (timeout) {
      clearTimeout(timeout);
    }

    this.batches.delete(socket);
    this.timeouts.delete(socket);
  }

  /**
   * Force flush all batches (use before shutdown)
   */
  flushAll(): void {
    for (const socket of this.batches.keys()) {
      if (socket.readyState === WebSocket.OPEN) {
        this.flush(socket);
      }
    }
  }
}
