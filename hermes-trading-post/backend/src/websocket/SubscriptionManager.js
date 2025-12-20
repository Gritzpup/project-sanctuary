/**
 * @file SubscriptionManager.js
 * @description Manages WebSocket chart subscriptions and client tracking
 */

export class SubscriptionManager {
  constructor() {
    // Track chart subscriptions: clientId -> Set of "pair:granularity"
    this.chartSubscriptions = new Map();
    // Track active subscriptions: "pair" -> Set of granularities
    this.activeSubscriptions = new Map();
    // Track granularity mappings: "pair:granularitySeconds" -> "granularityString"
    this.granularityMappings = new Map();
    // Track mapping creation times for TTL cleanup
    this.granularityMappingTimes = new Map();
    // Track last emission times to throttle duplicate candle updates
    this.lastEmissionTimes = new Map();
  }

  /**
   * Register a client connection
   */
  registerClient(clientId) {
    if (!this.chartSubscriptions.has(clientId)) {
      this.chartSubscriptions.set(clientId, new Set());
    }
  }

  /**
   * Unregister a client connection
   */
  unregisterClient(clientId) {
    this.chartSubscriptions.delete(clientId);
  }

  /**
   * Add a subscription for a client
   */
  subscribe(clientId, pair, granularity) {
    const subscriptionKey = `${pair}:${granularity}`;
    const clientSubs = this.chartSubscriptions.get(clientId);

    if (clientSubs) {
      clientSubs.add(subscriptionKey);
    }

    // Track active subscriptions
    if (!this.activeSubscriptions.has(pair)) {
      this.activeSubscriptions.set(pair, new Set());
    }
    this.activeSubscriptions.get(pair).add(granularity);
  }

  /**
   * Remove a subscription for a client
   */
  unsubscribe(clientId, pair, granularity) {
    const subscriptionKey = `${pair}:${granularity}`;
    const clientSubs = this.chartSubscriptions.get(clientId);

    if (clientSubs) {
      clientSubs.delete(subscriptionKey);
    }
  }

  /**
   * Get all clients subscribed to a pair:granularity
   */
  getSubscribedClients(pair, granularity) {
    const subscriptionKey = `${pair}:${granularity}`;
    const clients = [];

    this.chartSubscriptions.forEach((subs, clientId) => {
      if (subs.has(subscriptionKey)) {
        clients.push(clientId);
      }
    });

    return clients;
  }

  /**
   * Get all subscriptions for a client
   */
  getClientSubscriptions(clientId) {
    return this.chartSubscriptions.get(clientId) || new Set();
  }

  /**
   * Get stats
   */
  getStats() {
    return {
      totalClients: this.chartSubscriptions.size,
      totalSubscriptions: Array.from(this.chartSubscriptions.values())
        .reduce((sum, subs) => sum + subs.size, 0),
      activePairs: this.activeSubscriptions.size
    };
  }

  /**
   * Clean up old mappings (TTL: 1 hour)
   */
  cleanupOldMappings() {
    const TTL = 60 * 60 * 1000; // 1 hour
    const now = Date.now();
    let cleanedCount = 0;

    for (const [key, timestamp] of this.granularityMappingTimes.entries()) {
      if (now - timestamp > TTL) {
        this.granularityMappings.delete(key);
        this.granularityMappingTimes.delete(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
    }

    return cleanedCount;
  }
}

export const subscriptionManager = new SubscriptionManager();
