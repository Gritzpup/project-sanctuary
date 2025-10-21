/**
 * @file WebSocketBatcher.ts
 * @description Batches incoming WebSocket messages to prevent UI thread saturation
 * Part of Phase 1: Critical Performance Fixes
 *
 * Problem: WebSocket messages arrive at 50-100/sec, but each one triggers chart updates
 * Solution: Batch messages and process them at controlled intervals (100ms max or 50 messages)
 * Expected Impact: Additional 20-30% CPU reduction on top of RAF batching
 */

import type { WebSocketCandle } from '../types/data.types';

interface BatchConfig {
  maxMessages?: number;  // Maximum messages to batch (default: 50)
  maxWaitMs?: number;    // Maximum wait time before processing batch (default: 100ms)
}

/**
 * WebSocket Message Batcher - throttles incoming messages to prevent queue saturation
 * Processes batches at 100ms intervals or when 50 messages accumulate, whichever comes first
 */
export class WebSocketBatcher {
  private pendingMessages: WebSocketCandle[] = [];
  private batchTimeoutId: NodeJS.Timeout | null = null;
  private onBatchReady: ((messages: WebSocketCandle[]) => void) | null = null;
  private messageCountSinceLastBatch = 0;

  private config: Required<BatchConfig>;

  constructor(config: BatchConfig = {}) {
    this.config = {
      maxMessages: config.maxMessages ?? 50,
      maxWaitMs: config.maxWaitMs ?? 100
    };
  }

  /**
   * Add a message to the batch
   * Triggers batch processing if threshold is reached
   */
  addMessage(message: WebSocketCandle): void {
    this.pendingMessages.push(message);
    this.messageCountSinceLastBatch++;

    // If we've accumulated enough messages, process immediately without waiting
    if (this.pendingMessages.length >= this.config.maxMessages) {
      this.processBatch();
      return;
    }

    // Schedule batch processing if not already scheduled
    if (!this.batchTimeoutId) {
      this.batchTimeoutId = setTimeout(() => {
        this.processBatch();
      }, this.config.maxWaitMs);
    }
  }

  /**
   * Set the callback for when a batch is ready
   */
  onBatch(callback: (messages: WebSocketCandle[]) => void): () => void {
    this.onBatchReady = callback;

    // Return unsubscribe function
    // ✅ PHASE 7 FIX: Clear batch timeout on unsubscribe
    // Prevents orphaned timers from continuing to fire after unsubscribe
    return () => {
      this.onBatchReady = null;
      if (this.batchTimeoutId) {
        clearTimeout(this.batchTimeoutId);
        this.batchTimeoutId = null;
      }
    };
  }

  /**
   * Process the current batch of messages
   */
  private processBatch(): void {
    // Clear timeout
    if (this.batchTimeoutId) {
      clearTimeout(this.batchTimeoutId);
      this.batchTimeoutId = null;
    }

    // Only process if we have messages
    if (this.pendingMessages.length === 0) {
      return;
    }

    const messagesToProcess = [...this.pendingMessages];
    this.pendingMessages = [];
    this.messageCountSinceLastBatch = 0;

    // Call the callback with the batch
    if (this.onBatchReady) {
      this.onBatchReady(messagesToProcess);
    }
  }

  /**
   * Force process any pending messages immediately
   */
  flush(): void {
    this.processBatch();
  }

  /**
   * Get number of pending messages
   */
  getPendingCount(): number {
    return this.pendingMessages.length;
  }

  /**
   * Check if batcher is active (has pending messages or timeout)
   */
  isActive(): boolean {
    return this.pendingMessages.length > 0 || this.batchTimeoutId !== null;
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    if (this.batchTimeoutId) {
      clearTimeout(this.batchTimeoutId);
      this.batchTimeoutId = null;
    }
    this.pendingMessages = [];
    this.onBatchReady = null;
  }
}

/**
 * Export singleton instance for use across the app
 */
export const webSocketBatcher = new WebSocketBatcher({
  maxMessages: 50,
  maxWaitMs: 100
});
