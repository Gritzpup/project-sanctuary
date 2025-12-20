/**
 * SubscriptionManager - Chart subscription tracking and management
 *
 * Phase 5C: Backend Monolith Split
 * Extracted from index.js to centralize subscription management logic
 * Tracks client subscriptions to chart data feeds and manages cleanup
 */

export class SubscriptionManager {
  constructor() {
    // Track chart subscriptions: clientId -> Set of "pair:granularity" strings
    this.chartSubscriptions = new Map();

    // Track active subscriptions: "pair" -> Set of granularities
    this.activeSubscriptions = new Map();

    // Track granularity mappings: "pair:granularitySeconds" -> "granularityString"
    this.granularityMappings = new Map();

    // Track mapping creation times for TTL cleanup
    this.granularityMappingTimes = new Map();

    // Track last emission times to throttle duplicate candle updates
    this.lastEmissionTimes = new Map();

    // Configuration
    this.EMISSION_THROTTLE_MS = 50; // Throttle candle updates to 50ms minimum
    this.MAPPING_TTL_MS = 60 * 60 * 1000; // 1 hour
  }

  /**
   * Add a subscription for a client
   */
  addSubscription(clientId, pair, granularity) {
    if (!this.chartSubscriptions.has(clientId)) {
      this.chartSubscriptions.set(clientId, new Set());
    }
    this.chartSubscriptions.get(clientId).add(`${pair}:${granularity}`);

    // Track active subscriptions
    if (!this.activeSubscriptions.has(pair)) {
      this.activeSubscriptions.set(pair, new Set());
    }
    this.activeSubscriptions.get(pair).add(granularity);
  }

  /**
   * Remove a subscription for a client
   */
  removeSubscription(clientId, pair, granularity) {
    if (this.chartSubscriptions.has(clientId)) {
      this.chartSubscriptions.get(clientId).delete(`${pair}:${granularity}`);
      if (this.chartSubscriptions.get(clientId).size === 0) {
        this.chartSubscriptions.delete(clientId);
      }
    }

    // Clean up active subscriptions if no clients are subscribed
    if (this.activeSubscriptions.has(pair)) {
      this.activeSubscriptions.get(pair).delete(granularity);
      if (this.activeSubscriptions.get(pair).size === 0) {
        this.activeSubscriptions.delete(pair);
      }
    }
  }

  /**
   * Remove all subscriptions for a client (when client disconnects)
   */
  removeClientSubscriptions(clientId) {
    if (this.chartSubscriptions.has(clientId)) {
      this.chartSubscriptions.delete(clientId);
    }
  }

  /**
   * Register a granularity mapping
   */
  setGranularityMapping(pair, granularitySeconds, granularityString) {
    const key = `${pair}:${granularitySeconds}`;
    this.granularityMappings.set(key, granularityString);
    this.granularityMappingTimes.set(key, Date.now());
  }

  /**
   * Get a granularity mapping
   */
  getGranularityMapping(pair, granularitySeconds) {
    return this.granularityMappings.get(`${pair}:${granularitySeconds}`);
  }

  /**
   * Clean up old granularity mappings (TTL: 1 hour)
   */
  cleanupOldMappings() {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [key, timestamp] of this.granularityMappingTimes.entries()) {
      if (now - timestamp > this.MAPPING_TTL_MS) {
        this.granularityMappings.delete(key);
        this.granularityMappingTimes.delete(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(`🧹 Cleaned up ${cleanedCount} old granularity mappings`);
    }
  }

  /**
   * Check if emission should be throttled to prevent duplicate updates
   */
  shouldThrottleEmission(clientId, pair, granularity) {
    const key = `${clientId}:${pair}:${granularity}`;
    const lastTime = this.lastEmissionTimes.get(key) || 0;
    const now = Date.now();

    if (now - lastTime >= this.EMISSION_THROTTLE_MS) {
      this.lastEmissionTimes.set(key, now);
      return false;
    }

    return true;
  }

  /**
   * Get all subscriptions
   */
  getChartSubscriptions() {
    return this.chartSubscriptions;
  }

  /**
   * Get active subscriptions for a specific pair
   */
  getActiveSubscriptionsForPair(pair) {
    return this.activeSubscriptions.get(pair) || new Set();
  }

  /**
   * Get stats about current subscriptions
   */
  getStats() {
    return {
      totalClients: this.chartSubscriptions.size,
      activePairs: this.activeSubscriptions.size,
      totalMappings: this.granularityMappings.size
    };
  }

  /**
   * Get granularity mapping times (for TTL cleanup)
   */
  getGranularityMappingTimes() {
    return this.granularityMappingTimes;
  }

  /**
   * Get last emission times (for throttling)
   */
  getLastEmissionTimes() {
    return this.lastEmissionTimes;
  }
}
