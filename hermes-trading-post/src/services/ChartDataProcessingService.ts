/**
 * Chart Data Processing Service
 *
 * High-level API for delegating data transformations to Web Worker.
 * Handles worker lifecycle, message serialization, and request tracking.
 *
 * 🚀 PHASE 17: Worker thread delegation for heavy computations
 */

/**
 * Manages communication with ChartDataWorker
 */
export class ChartDataProcessingService {
  private worker: Worker | null = null;
  private requestId = 0;
  private pendingRequests = new Map<
    string,
    {
      resolve: (value: any) => void;
      reject: (error: Error) => void;
      timeout: NodeJS.Timeout;
    }
  >();

  private readonly WORKER_TIMEOUT_MS = 30000; // 30 second timeout
  private isInitialized = false;

  /**
   * Initialize the worker
   */
  initialize(): void {
    if (this.isInitialized || this.worker) {
      return;
    }

    try {
      // Create worker from TypeScript file (Vite will handle compilation)
      this.worker = new Worker(
        new URL('../workers/ChartDataWorker.ts', import.meta.url),
        { type: 'module' }
      );

      // Set up message handler
      this.worker.onmessage = (event: MessageEvent) => {
        this.handleWorkerMessage(event.data);
      };

      // Set up error handler
      this.worker.onerror = (error: ErrorEvent) => {
        // Reject all pending requests
        for (const [requestId, { reject, timeout }] of this.pendingRequests.entries()) {
          clearTimeout(timeout);
          reject(new Error(`Worker error: ${error.message}`));
          this.pendingRequests.delete(requestId);
        }
      };

      this.isInitialized = true;
    } catch (error) {
      this.isInitialized = false;
      this.worker = null;
    }
  }

  /**
   * Clean up worker
   */
  destroy(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }

    // Clear all pending requests
    for (const { timeout } of this.pendingRequests.values()) {
      clearTimeout(timeout);
    }
    this.pendingRequests.clear();

    this.isInitialized = false;
  }

  /**
   * Transform candles: validate, deduplicate, sort
   */
  transformCandles(candles: any[]): Promise<any[]> {
    return this.sendWorkerMessage('TRANSFORM_CANDLES', { candles });
  }

  /**
   * Deduplicate candles by timestamp
   */
  deduplicateCandles(candles: any[]): Promise<any[]> {
    return this.sendWorkerMessage('DEDUPLICATE', { candles });
  }

  /**
   * Filter candles by time range
   */
  filterByTimeRange(candles: any[], startTime: number, endTime: number): Promise<any[]> {
    return this.sendWorkerMessage('FILTER_TIME_RANGE', { candles, start: startTime, end: endTime });
  }

  /**
   * Validate candles
   */
  validateCandles(candles: any[]): Promise<any[]> {
    return this.sendWorkerMessage('VALIDATE_CANDLES', { candles });
  }

  /**
   * Calculate volume statistics
   */
  calculateVolumeStats(candles: any[]): Promise<{
    totalVolume: number;
    avgVolume: number;
    maxVolume: number;
    minVolume: number;
  }> {
    return this.sendWorkerMessage('CALCULATE_VOLUME_STATS', { candles });
  }

  /**
   * Send message to worker and wait for response
   */
  private sendWorkerMessage(type: string, payload: any): Promise<any> {
    // Ensure worker is initialized
    if (!this.worker) {
      this.initialize();
    }

    if (!this.worker) {
      return Promise.reject(new Error('Worker failed to initialize'));
    }

    return new Promise((resolve, reject) => {
      const requestId = String(this.requestId++);

      // Set up timeout
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error(`Worker request ${type} timed out after ${this.WORKER_TIMEOUT_MS}ms`));
      }, this.WORKER_TIMEOUT_MS);

      // Store pending request
      this.pendingRequests.set(requestId, { resolve, reject, timeout });

      // Send message to worker
      try {
        this.worker!.postMessage({ type, payload, requestId });
      } catch (error) {
        clearTimeout(timeout);
        this.pendingRequests.delete(requestId);
        reject(new Error(`Failed to send message to worker: ${error}`));
      }
    });
  }

  /**
   * Handle message from worker
   */
  private handleWorkerMessage(message: any): void {
    const { type, requestId, data, error } = message;

    const pending = this.pendingRequests.get(requestId);
    if (!pending) {
      return;
    }

    clearTimeout(pending.timeout);
    this.pendingRequests.delete(requestId);

    if (type === 'ERROR') {
      pending.reject(new Error(error));
    } else {
      pending.resolve(data);
    }
  }

  /**
   * Check if worker is ready
   */
  isReady(): boolean {
    return this.isInitialized && this.worker !== null;
  }

  /**
   * Get pending request count
   */
  getPendingRequestCount(): number {
    return this.pendingRequests.size;
  }
}

/**
 * Global instance for chart data processing
 */
export const chartDataProcessingService = new ChartDataProcessingService();

/**
 * Initialize service on app load
 */
export function initializeChartDataProcessing(): void {
  chartDataProcessingService.initialize();
}

/**
 * Example usage:
 *
 * // Initialize on app start
 * initializeChartDataProcessing();
 *
 * // Use in data transformations
 * const transformed = await chartDataProcessingService.transformCandles(rawCandles);
 *
 * // Use in chart operations
 * const filtered = await chartDataProcessingService.filterByTimeRange(
 *   candles,
 *   startTime,
 *   endTime
 * );
 *
 * // Clean up on app exit
 * chartDataProcessingService.destroy();
 */
