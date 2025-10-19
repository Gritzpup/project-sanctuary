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

    console.log('🔊 BroadcastService initialized - 5 broadcast types active');
  }

  /**
   * Setup database activity broadcast
   * Triggered by continuousCandleUpdater 'database_activity' events
   */
  setupDatabaseActivityBroadcast() {
    this.continuousCandleUpdater.on('database_activity', (activity) => {
      this.broadcast({
        type: 'database_activity',
        data: activity
      });
      this.broadcastStats.databaseActivity++;
    });
  }

  /**
   * Setup level2 orderbook broadcast
   * Triggered by coinbaseWebSocket 'level2' events
   * Caches snapshot for new clients
   */
  setupLevel2Broadcast() {
    this.coinbaseWebSocket.on('level2', (data) => {
      // Update cached snapshot for new clients
      if (data && data.bids && data.asks) {
        this.cachedLevel2Snapshot = data;
      }

      this.broadcast({
        type: 'level2',
        data: data
      });
      this.broadcastStats.level2++;
    });
  }

  /**
   * Setup orderbook delta broadcast
   * Triggered by Redis Pub/Sub on 'orderbook:*:delta' channel
   */
  setupOrderbookDeltaBroadcast() {
    if (this.deltaSubscriber) {
      this.deltaSubscriber.on('message', (channel, message) => {
        try {
          const delta = JSON.parse(message);

          this.broadcast({
            type: 'orderbook-delta',
            channel: channel,
            data: delta
          });
          this.broadcastStats.orderbookDelta++;
        } catch (error) {
          console.error('Error parsing orderbook delta:', error);
        }
      });
    }
  }

  /**
   * Setup candle data broadcast
   * Triggered by coinbaseWebSocket 'candle' events
   * Includes subscription filtering and throttling (100ms minimum)
   */
  setupCandleBroadcast() {
    this.coinbaseWebSocket.on('candle', (candleData) => {
      const now = Date.now();

      this.wss.clients.forEach((client) => {
        if (client.readyState === client.OPEN) {
          // Get client's chart subscriptions
          const clientSubs = this.chartSubscriptions.get(client._clientId);

          if (clientSubs) {
            // Check if client is subscribed to this pair/granularity
            const mappingKey = `${candleData.product_id}:${candleData.granularitySeconds}`;
            const granularityStr = this.granularityMappings.get(mappingKey);

            if (granularityStr) {
              const subscriptionKey = `${candleData.product_id}:${granularityStr}`;

              // Only send to subscribed clients
              if (clientSubs.has(subscriptionKey)) {
                // 🔥 THROTTLE: Only emit complete candles or throttle intermediate updates (100ms)
                const emissionKey = `${client._clientId}:${subscriptionKey}`;
                const lastEmitTime = this.lastEmissionTimes.get(emissionKey) || 0;

                const shouldEmit = candleData.type === 'complete' || (now - lastEmitTime >= 100);

                if (shouldEmit) {
                  this.lastEmissionTimes.set(emissionKey, now);

                  try {
                    client.send(JSON.stringify({
                      type: 'candle',
                      data: candleData
                    }));
                    this.broadcastStats.candle++;
                  } catch (error) {
                    console.error('Error sending candle to client:', error);
                  }
                }
              }
            }
          }
        }
      });
    });
  }

  /**
   * Setup ticker data broadcast
   * Triggered by coinbaseWebSocket 'ticker' events
   * Includes subscription filtering, NO throttling (real-time)
   */
  setupTickerBroadcast() {
    this.coinbaseWebSocket.on('ticker', (tickerData) => {
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
                console.error('Error sending ticker to client:', error);
              }
            }
          }
        }
      });
    });
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
          console.error('Error broadcasting message:', error);
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
}
