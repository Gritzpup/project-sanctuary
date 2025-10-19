/**
 * MemoryMonitor - Memory usage monitoring and circuit breaker service
 *
 * Phase 5C: Backend Monolith Split
 * Extracted from index.js to centralize memory monitoring logic
 * Provides memory usage tracking and emergency cleanup when thresholds are exceeded
 */

export class MemoryMonitor {
  constructor(wss, chartSubscriptions, cleanupCallback) {
    this.wss = wss;
    this.chartSubscriptions = chartSubscriptions;
    this.cleanupCallback = cleanupCallback;
    this.monitoringInterval = null;
    this.HEAP_THRESHOLD = 1024 * 1024 * 1024; // 1GB
    this.MONITOR_INTERVAL = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Start memory monitoring with periodic checks
   */
  start() {
    this.monitoringInterval = setInterval(() => {
      this.checkMemoryUsage();
    }, this.MONITOR_INTERVAL);

    console.log('📊 Memory Monitor started - checking every 5 minutes');
  }

  /**
   * Check current memory usage and trigger cleanup if needed
   */
  checkMemoryUsage() {
    const memUsage = process.memoryUsage();
    const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
    const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
    const rssMB = Math.round(memUsage.rss / 1024 / 1024);

    // Log memory usage
    console.log(`📊 Memory Usage: RSS: ${rssMB}MB, Heap: ${heapUsedMB}/${heapTotalMB}MB, Clients: ${this.wss.clients.size}, Subscriptions: ${this.chartSubscriptions.size}`);

    // Circuit breaker: If memory usage exceeds 1GB, force cleanup
    if (memUsage.heapUsed > this.HEAP_THRESHOLD) {
      console.warn(`⚠️ HIGH MEMORY USAGE: ${heapUsedMB}MB - Forcing cleanup`);

      // Trigger external cleanup callback
      if (this.cleanupCallback) {
        this.cleanupCallback();
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
        console.log('🗑️ Forced garbage collection');
      }
    }
  }

  /**
   * Stop memory monitoring
   */
  stop() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      console.log('📊 Memory Monitor stopped');
    }
  }

  /**
   * Get current memory stats
   */
  getStats() {
    const memUsage = process.memoryUsage();
    return {
      heapUsedMB: Math.round(memUsage.heapUsed / 1024 / 1024),
      heapTotalMB: Math.round(memUsage.heapTotal / 1024 / 1024),
      rssMB: Math.round(memUsage.rss / 1024 / 1024),
      clients: this.wss.clients.size,
      subscriptions: this.chartSubscriptions.size
    };
  }
}
