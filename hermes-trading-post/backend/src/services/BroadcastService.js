/**
 * BroadcastService - Centralized WebSocket message broadcasting
 *
 * Phase 5C: Backend Monolith Split
 * Extracted from index.js to centralize all broadcast operations
 * Handles 5 different broadcast types with filtering and throttling
 */

export class BroadcastService {
  constructor(wss, dependencies) {
    this.wss = wss;
    this.continuousCandleUpdater = dependencies.continuousCandleUpdater;
    this.coinbaseWebSocket = dependencies.coinbaseWebSocket;
    this.subscriptionManager = dependencies.subscriptionManager;
    this.getGranularitySeconds = dependencies.getGranularitySeconds;

    // Get references to maps
    this.chartSubscriptions = dependencies.chartSubscriptions;
    this.granularityMappings = dependencies.granularityMappings;
    this.lastEmissionTimes = dependencies.lastEmissionTimes;

    // Get references to state
    this.cachedLevel2Snapshot = dependencies.cachedLevel2Snapshot;
    this.deltaSubscriber = dependencies.deltaSubscriber;

    // ⚡ PERF: Store handler references for cleanup
    this._handlers = {
      databaseActivity: null,
      level2: null,
      candle: null,
      ticker: null,
      deltaMessage: null
    };

    // Broadcast statistics for monitoring
    this.broadcastStats = {
      databaseActivity: 0,
      level2: 0,
      orderbookDelta: 0,
      candle: 0,
      ticker: 0,
      totalMessages: 0
    };
  }

  /**
   * Initialize all broadcast event listeners
   */
  initialize() {
    this.setupDatabaseActivityBroadcast();
    this.setupLevel2Broadcast();
    this.setupOrderbookDeltaBroadcast();
    this.setupCandleBroadcast();
    this.setupTickerBroadcast();

  }

  /**
   * Setup database activity broadcast
   * Triggered by continuousCandleUpdater 'database_activity' events
   */
  setupDatabaseActivityBroadcast() {
    // ⚡ PERF: Store handler reference for cleanup
    this._handlers.databaseActivity = (activity) => {
      this.broadcast({
        type: 'database_activity',
        data: activity
      });
      this.broadcastStats.databaseActivity++;
    };
    this.continuousCandleUpdater.on('database_activity', this._handlers.databaseActivity);
  }

  /**
   * Setup level2 orderbook broadcast
   * Triggered by coinbaseWebSocket 'level2' events
   * Caches snapshot for new clients
   */
  setupLevel2Broadcast() {
    // ⚡ PERF: Store handler reference for cleanup
    this._handlers.level2 = (data) => {
      // Update cached snapshot for new clients
      if (data && data.bids && data.asks) {
        this.cachedLevel2Snapshot = data;
      }

      this.broadcast({
        type: 'level2',
        data: data
      });
      this.broadcastStats.level2++;
    };
    this.coinbaseWebSocket.on('level2', this._handlers.level2);
  }

  /**
   * Setup orderbook delta broadcast
   * Triggered by Redis Pub/Sub on 'orderbook:*:delta' channel
   */
  setupOrderbookDeltaBroadcast() {
    if (this.deltaSubscriber) {
      // ⚡ PERF: Store handler reference for cleanup
      this._handlers.deltaMessage = (channel, message) => {
        try {
          const delta = JSON.parse(message);

          this.broadcast({
            type: 'orderbook-delta',
            channel: channel,
            data: delta
          });
          this.broadcastStats.orderbookDelta++;
        } catch (error) {
        }
      };
      this.deltaSubscriber.on('message', this._handlers.deltaMessage);
    }
  }

  /**
   * Setup candle data broadcast
   * Triggered by coinbaseWebSocket 'candle' events
   * ⚡ PHASE 13c: Throttling optimized - 1000ms for incomplete, immediate for complete
   * Reduces WebSocket traffic by 90% for incomplete candles while keeping complete candles instant
   */
  setupCandleBroadcast() {
    // ⚡ PERF: Store handler reference for cleanup
    this._handlers.candle = (candleData) => {
      const now = Date.now();

      // 🔧 FIX: candleData has 'granularity' (seconds) NOT 'granularitySeconds'
      // coinbaseWebSocket.js line 1212: granularity: granularitySeconds
      const granularitySeconds = candleData.granularity;

      this.wss.clients.forEach((client) => {
        if (client.readyState === client.OPEN) {
          // Get client's chart subscriptions
          const clientSubs = this.chartSubscriptions.get(client._clientId);

          if (clientSubs) {
            // Check if client is subscribed to this pair/granularity
            const mappingKey = `${candleData.product_id}:${granularitySeconds}`;
            const granularityStr = this.granularityMappings.get(mappingKey);

            if (granularityStr) {
              const subscriptionKey = `${candleData.product_id}:${granularityStr}`;

              // Only send to subscribed clients
              if (clientSubs.has(subscriptionKey)) {
                // ⚡ PHASE 13c THROTTLE: Complete candles (type='complete') sent immediately
                // Incomplete updates throttled to 1000ms (down from 100ms) to reduce traffic 90%
                const emissionKey = `${client._clientId}:${subscriptionKey}`;
                const lastEmitTime = this.lastEmissionTimes.get(emissionKey) || 0;

                // COMPLETE: Send immediately | INCOMPLETE: Throttle to 1000ms
                const throttleWindowMs = candleData.type === 'complete' ? 0 : 1000;
                const shouldEmit = candleData.type === 'complete' || (now - lastEmitTime >= throttleWindowMs);

                if (shouldEmit) {
                  this.lastEmissionTimes.set(emissionKey, now);

                  try {
                    // 🔧 FIX: Send FLAT format expected by frontend chartRealtimeService.ts
                    // Frontend expects: {type, pair, granularity, time, open, high, low, close, volume}
                    // NOT nested: {type, data: {...}}
                    client.send(JSON.stringify({
                      type: 'candle',
                      pair: candleData.product_id,
                      granularity: granularityStr,
                      time: candleData.time,
                      open: candleData.open,
                      high: candleData.high,
                      low: candleData.low,
                      close: candleData.close,
                      volume: candleData.volume || 0,
                      candleType: candleData.type // 'complete' or 'incomplete'
                    }));
                    this.broadcastStats.candle++;
                  } catch (error) {
                  }
                }
              }
            }
          }
        }
      });
    };
    this.coinbaseWebSocket.on('candle', this._handlers.candle);
  }

  /**
   * Setup ticker data broadcast
   * Triggered by coinbaseWebSocket 'ticker' events
   * Includes subscription filtering, NO throttling (real-time)
   */
  setupTickerBroadcast() {
    // ⚡ PERF: Store handler reference for cleanup
    this._handlers.ticker = (tickerData) => {
      this.wss.clients.forEach((client) => {
        if (client.readyState === client.OPEN) {
          // Get client's chart subscriptions
          const clientSubs = this.chartSubscriptions.get(client._clientId);

          if (clientSubs) {
            // Check if client is subscribed to this pair
            // Ticker data doesn't have granularity, so we check for any subscription to the pair
            let hasSubscription = false;

            for (const subscription of clientSubs) {
              const [pair] = subscription.split(':');
              if (pair === tickerData.product_id) {
                hasSubscription = true;
                break;
              }
            }

            if (hasSubscription) {
              try {
                client.send(JSON.stringify({
                  type: 'ticker',
                  data: tickerData
                }));
                this.broadcastStats.ticker++;
              } catch (error) {
              }
            }
          }
        }
      });
    };
    this.coinbaseWebSocket.on('ticker', this._handlers.ticker);
  }

  /**
   * Generic broadcast method
   * Sends message to all connected clients
   */
  broadcast(message) {
    this.wss.clients.forEach((client) => {
      if (client.readyState === client.OPEN) {
        try {
          client.send(JSON.stringify(message));
          this.broadcastStats.totalMessages++;
        } catch (error) {
        }
      }
    });
  }

  /**
   * Update cached level2 snapshot (for external calls)
   */
  setCachedLevel2Snapshot(snapshot) {
    this.cachedLevel2Snapshot = snapshot;
  }

  /**
   * Get broadcast statistics
   */
  getStats() {
    return {
      ...this.broadcastStats,
      activeConnections: this.wss.clients.size
    };
  }

  /**
   * Reset broadcast statistics
   */
  resetStats() {
    this.broadcastStats = {
      databaseActivity: 0,
      level2: 0,
      orderbookDelta: 0,
      candle: 0,
      ticker: 0,
      totalMessages: 0
    };
  }

  /**
   * ⚡ PERF: Cleanup all event listeners to prevent memory leaks
   * Called during graceful shutdown
   */
  cleanup() {
    // Remove continuousCandleUpdater listener
    if (this._handlers.databaseActivity) {
      this.continuousCandleUpdater.off('database_activity', this._handlers.databaseActivity);
    }

    // Remove coinbaseWebSocket listeners
    if (this._handlers.level2) {
      this.coinbaseWebSocket.off('level2', this._handlers.level2);
    }
    if (this._handlers.candle) {
      this.coinbaseWebSocket.off('candle', this._handlers.candle);
    }
    if (this._handlers.ticker) {
      this.coinbaseWebSocket.off('ticker', this._handlers.ticker);
    }

    // Remove deltaSubscriber listener
    if (this.deltaSubscriber && this._handlers.deltaMessage) {
      this.deltaSubscriber.off('message', this._handlers.deltaMessage);
    }

    // Clear handler references
    this._handlers = {
      databaseActivity: null,
      level2: null,
      candle: null,
      ticker: null,
      deltaMessage: null
    };

    console.log('🧹 BroadcastService: All event listeners cleaned up');
  }
}
