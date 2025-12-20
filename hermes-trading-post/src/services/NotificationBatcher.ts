/**
 * @file NotificationBatcher.ts
 * @description Batches reactive state notifications to reduce redundant callback invocations
 * Groups multiple rapid notifications into single batch for optimal performance
 */

export class NotificationBatcher {
  private rafId: number | null = null;
  private isPending = false;
  private callbacks: Set<() => void> = new Set();

  /**
   * Schedule notification - batches multiple calls into one RAF cycle
   */
  scheduleNotification(callback: () => void): void {
    if (!callback) return;

    // Add callback to batch
    this.callbacks.add(callback);

    // If we don't already have a pending notification, schedule one
    if (!this.isPending) {
      this.isPending = true;

      this.rafId = requestAnimationFrame(() => {
        this.flush();
      });
    }
  }

  /**
   * Immediately flush any pending notifications
   */
  flush(): void {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    if (this.callbacks.size === 0) {
      this.isPending = false;
      return;
    }

    // Execute all callbacks in batch
    const callbacksToExecute = Array.from(this.callbacks);
    this.callbacks.clear();
    this.isPending = false;

    for (const callback of callbacksToExecute) {
      try {
        callback();
      } catch (error) {
        // Silently handle errors to prevent one callback from blocking others
      }
    }
  }

  /**
   * Reset batcher state
   */
  reset(): void {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.callbacks.clear();
    this.isPending = false;
  }

  /**
   * Check if there are pending notifications
   */
  hasPending(): boolean {
    return this.isPending;
  }

  /**
   * Get statistics for debugging
   */
  getStats(): { pendingCallbacks: number; isPending: boolean } {
    return {
      pendingCallbacks: this.callbacks.size,
      isPending: this.isPending,
    };
  }
}

// Export singleton instances for different notification types
export const dataUpdateNotifier = new NotificationBatcher();
export const historicalDataNotifier = new NotificationBatcher();
