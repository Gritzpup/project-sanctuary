/**
 * ServerLifecycle - Server initialization, graceful shutdown, and signal handling
 *
 * Phase 5C: Backend Monolith Split
 * Extracted from index.js to centralize server lifecycle management
 * Handles startup initialization, graceful shutdown, and signal handlers
 */

export class ServerLifecycle {
  constructor(server, wss, dependencies) {
    this.server = server;
    this.wss = wss;
    this.botManager = dependencies.botManager;
    this.continuousCandleUpdater = dependencies.continuousCandleUpdater;
    this.coinbaseWebSocket = dependencies.coinbaseWebSocket;
    this.memoryMonitor = dependencies.memoryMonitor;

    // Get references to maps
    this.chartSubscriptions = dependencies.chartSubscriptions;
    this.activeSubscriptions = dependencies.activeSubscriptions;
    this.granularityMappings = dependencies.granularityMappings;
    this.granularityMappingTimes = dependencies.granularityMappingTimes;
    this.lastEmissionTimes = dependencies.lastEmissionTimes;

    // Shutdown state
    this.isShuttingDown = false;
    this.SHUTDOWN_TIMEOUT = 5000; // 5 seconds to gracefully close

    // Process exit flag
    this.shutdownStartTime = null;
  }

  /**
   * Start the HTTP server listening on specified port/host
   */
  startServer(port, host) {
    return new Promise((resolve, reject) => {
      this.server.listen(port, host, () => {
        resolve();
      });

      this.server.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * Initialize signal handlers for graceful shutdown
   */
  initializeSignalHandlers() {
    process.on('SIGTERM', () => this.gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => this.gracefulShutdown('SIGINT'));

    // Prevent "MaxListenersExceededWarning"
    process.setMaxListeners(0);

  }

  /**
   * Graceful shutdown sequence
   */
  async gracefulShutdown(signal) {
    if (this.isShuttingDown) {
      return;
    }

    this.isShuttingDown = true;
    this.shutdownStartTime = Date.now();
    process.env.SHUTTING_DOWN = 'true';

    try {
      // 1. Stop accepting new connections
      this.server.close(() => {
      });

      // 2. Stop bot manager and trading operations
      this.botManager.cleanup();

      // 3. Stop continuous candle updater
      this.continuousCandleUpdater.stopAll();

      // 4. Stop memory monitor
      this.memoryMonitor.stop();

      // 5. Remove Coinbase WebSocket event listeners (prevent memory leak)
      if (this.coinbaseWebSocket.__level2Handler) {
        this.coinbaseWebSocket.off('level2', this.coinbaseWebSocket.__level2Handler);
      }
      if (this.coinbaseWebSocket.__errorHandler) {
        this.coinbaseWebSocket.off('error', this.coinbaseWebSocket.__errorHandler);
      }
      if (this.coinbaseWebSocket.__disconnectedHandler) {
        this.coinbaseWebSocket.off('disconnected', this.coinbaseWebSocket.__disconnectedHandler);
      }

      // 6. Close Coinbase WebSocket
      this.coinbaseWebSocket.disconnect();

      // 7. Close all client WebSocket connections
      this.wss.clients.forEach(client => {
        client.close(1001, 'Server shutting down');
      });

      // 7. Clean up memory - clear all subscription tracking Maps
      this.chartSubscriptions.clear();
      this.activeSubscriptions.clear();
      this.granularityMappings.clear();
      this.granularityMappingTimes.clear();
      this.lastEmissionTimes.clear();

      process.exit(0);
    } catch (error) {
      process.exit(1);
    }

    // Force exit if shutdown takes too long
    setTimeout(() => {
      const duration = Date.now() - this.shutdownStartTime;
      process.exit(1);
    }, this.SHUTDOWN_TIMEOUT);
  }

  /**
   * Get shutdown status
   */
  isShutdown() {
    return this.isShuttingDown;
  }

  /**
   * Get shutdown duration if in progress
   */
  getShutdownDuration() {
    if (!this.shutdownStartTime) {
      return null;
    }
    return Date.now() - this.shutdownStartTime;
  }

  /**
   * Set shutdown timeout (for testing or custom behavior)
   */
  setShutdownTimeout(ms) {
    this.SHUTDOWN_TIMEOUT = ms;
  }
}
