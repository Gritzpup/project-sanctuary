/**
 * @file chartCacheService.ts
 * @description Unified Redis cache and data fetching service for chart data
 * Part of Phase 5D: Chart Services Consolidation
 * Replaces RedisChartService with enhanced unified approach
 * 🚀 PHASE 17: Added LRU cache for bounded memory with automatic eviction
 */

import type { CandleData } from '../../types/coinbase';
import { LRUCache, createCacheKey } from '../../utils/LRUCache';

interface DataRequest {
  pair: string;
  granularity: string;
  start?: number;
  end?: number;
  limit?: number;
}

interface RedisChartDataResponse {
  success: boolean;
  data: {
    candles: CandleData[];
    metadata: {
      pair: string;
      granularity: string;
      totalCandles: number;
      firstTimestamp: number;
      lastTimestamp: number;
      source: string;
      cacheHitRatio: number;
      storageMetadata?: any;
    };
  };
  error?: string;
}

/**
 * Chart Cache Service - unified Redis caching and data fetching
 * Combines cache operations, historical data fetching, and metadata retrieval
 * ⚡ PHASE 8A: Added timeout handling for network requests (prevents chart freeze)
 */
export class ChartCacheService {
  private backendUrl: string = `http://${this.getBackendHost()}:4828`;
  // 🔧 FIX: Increased from 5s to 15s for historical data requests (loading 1000 candles can take time)
  private readonly FETCH_TIMEOUT_MS = 15000; // 15 second timeout for chart data (was 5s causing timeouts)
  private readonly HEALTH_CHECK_TIMEOUT_MS = 2000; // 2 second timeout for health checks

  // 🚀 PHASE 17: LRU cache for chart data with bounded memory
  // Stores fetched candles with max 500 entries (each entry ~50KB = 25MB max)
  private memoryCache = new LRUCache<string, { candles: CandleData[]; timestamp: number }>({
    maxSize: 500,
    onEvict: (key, value) => {
      // Log when old cache entries are evicted (optional debugging)
    }
  });

  // 🚀 PHASE 17b: Cache TTL for real-time update validation
  // Invalidate cache after 5 seconds to ensure fresh real-time data
  private readonly CACHE_TTL_MS = 5000;

  // 🚀 PHASE 5F: Request coalescing - deduplicate concurrent identical requests
  // Prevents multiple components from making duplicate API calls for same data
  // Maps from cache key to in-flight request Promise
  private inFlightRequests = new Map<string, Promise<CandleData[]>>();

  private getBackendHost(): string {
    const envHost = (import.meta as any)?.env?.VITE_BACKEND_HOST;
    if (envHost) return envHost;
    if (typeof window !== 'undefined' && window.location) {
      return window.location.hostname || 'localhost';
    }
    return 'localhost';
  }

  /**
   * ⚡ PHASE 8A: Fetch with timeout to prevent indefinite hanging
   * Returns null if timeout occurs, allowing fallback mechanisms
   */
  private async fetchWithTimeout(url: string, timeoutMs: number = this.FETCH_TIMEOUT_MS): Promise<Response | null> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      return response;
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        return null;
      }
      throw error;
    }
  }

  /**
   * Initialize service and test backend connectivity with timeout
   * ⚡ PHASE 8A: Non-blocking initialization - doesn't block chart loading
   */
  async initialize(): Promise<void> {
    try {
      const response = await this.fetchWithTimeout(`${this.backendUrl}/health`, this.HEALTH_CHECK_TIMEOUT_MS);
      if (!response?.ok) {
      }
    } catch (error) {
    }
  }

  /**
   * Fetch historical candles with timeout and fallback support
   * ⚡ PHASE 8A: Prevents chart freeze on backend unavailability
   * 🚀 PHASE 5F: Added request coalescing to deduplicate concurrent requests
   */
  async fetchCandles(request: DataRequest): Promise<CandleData[]> {
    const { pair, granularity, start, end, limit = 1000 } = request;

    // 🚀 PHASE 17b: Create cache key that includes time range
    // ⚠️ CRITICAL FIX: Include start/end times in cache key to prevent
    // different time ranges (e.g., 1D vs 5Y) from getting mixed up
    // This affects both LRU cache AND request coalescing
    const simpleKey = createCacheKey(pair, granularity);
    const cacheKey = (start && end)
      ? `${simpleKey}_${start}_${end}`  // Time-aware key for historical requests
      : simpleKey;                       // Simple key for current data requests

    // 🚀 PHASE 17b: Check LRU memory cache with TTL validation
    // Only use cache for requests that don't have time ranges (simple current data requests)
    if (!start && !end) {
      const cachedEntry = this.memoryCache.get(cacheKey);

      if (cachedEntry) {
        const now = Date.now();
        const cacheAge = now - cachedEntry.timestamp;

        if (cacheAge < this.CACHE_TTL_MS) {
          const cachedCandles = cachedEntry.candles;
          // Return up to limit candles
          return cachedCandles.slice(-limit);
        }
        // Cache is stale, delete it
        this.memoryCache.delete(cacheKey);
      }
    }

    // 🚀 PHASE 5F: Request coalescing - check for in-flight requests
    // If another component is already fetching this EXACT same data, return that Promise
    // ⚠️ CRITICAL: cacheKey now includes time range, so different timeframes won't coalesce
    if (this.inFlightRequests.has(cacheKey)) {
      const inFlightPromise = this.inFlightRequests.get(cacheKey);
      if (inFlightPromise) {
        return inFlightPromise;
      }
    }

    // 🚀 PHASE 5F: Wrap the entire fetch in a Promise for request coalescing
    // This way we can track and deduplicate this specific request
    const fetchPromise = this.performFetch(pair, granularity, start, end, limit, cacheKey);

    // Store the in-flight request
    this.inFlightRequests.set(cacheKey, fetchPromise);

    try {
      const result = await fetchPromise;
      return result;
    } finally {
      // Clean up the in-flight request tracker when done
      this.inFlightRequests.delete(cacheKey);
    }
  }

  /**
   * 🚀 PHASE 5F: Actual fetch implementation (separated for request coalescing)
   * This is called by fetchCandles and wrapped in Promise deduplication
   */
  private async performFetch(
    pair: string,
    granularity: string,
    start: number | undefined,
    end: number | undefined,
    limit: number,
    cacheKey: string
  ): Promise<CandleData[]> {
    try {
      const params = new URLSearchParams({
        pair: pair || 'BTC-USD',
        granularity: granularity || '1m',
        maxCandles: (limit || 10000).toString(),
        format: 'json' // Start with JSON format for simplicity
      });

      if (start) params.append('startTime', start.toString());
      if (end) params.append('endTime', end.toString());

      const url = `${this.backendUrl}/api/trading/chart-data?${params}`;

      // ⚡ PHASE 8A: Use timeout-protected fetch
      const response = await this.fetchWithTimeout(url);

      if (!response) {
        // Timeout occurred - return empty and let caller handle fallback
        return [];
      }

      if (!response.ok) {
        return [];
      }

      const result: RedisChartDataResponse = await response.json();

      if (!result.success) {
        return [];
      }

      const candles = result.data.candles || [];

      // 🚀 PHASE 17: Store in LRU cache for future requests
      // ⚠️ CRITICAL FIX: Only cache responses without start/end times
      // Time-range responses are only valid for that specific range, so caching them
      // causes wrong results when a different time range is requested for the same granularity
      if (candles.length > 0 && !start && !end) {
        // 🚀 PHASE 17b: Wrap with timestamp for TTL validation
        this.memoryCache.set(cacheKey, {
          candles,
          timestamp: Date.now()
        });
      }

      return candles;
    } catch (error) {
      return [];
    }
  }

  /**
   * Fetch candles with metadata including totalCandles count
   */
  async fetchCandlesWithMetadata(
    request: DataRequest
  ): Promise<{ candles: CandleData[]; metadata: any }> {
    const { pair, granularity, start, end, limit = 1000 } = request;

    try {
      const params = new URLSearchParams({
        pair: pair || 'BTC-USD',
        granularity: granularity || '1m',
        maxCandles: (limit || 10000).toString()
      });

      if (start) params.append('startTime', start.toString());
      if (end) params.append('endTime', end.toString());

      const url = `${this.backendUrl}/api/trading/chart-data?${params}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result: RedisChartDataResponse = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Fetch failed');
      }

      const { candles, metadata } = result.data;
      return { candles, metadata };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get Redis storage statistics
   */
  async getStorageStats(): Promise<any> {
    try {
      const response = await fetch(`${this.backendUrl}/api/trading/storage-stats`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Storage stats fetch failed');
      }

      return result.data;
    } catch (error) {
      return null;
    }
  }

  /**
   * Store candles in cache with TTL
   */
  async storeCandlesInCache(
    pair: string,
    granularity: string,
    candles: CandleData[],
    ttlSeconds: number = 3600
  ): Promise<void> {
    try {
      const startTime = candles[0]?.time || 0;
      const endTime = candles[candles.length - 1]?.time || 0;

      await fetch('/api/cache-candles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pair,
          granularity,
          startTime,
          endTime,
          data: candles,
          ttl: ttlSeconds
        })
      });
    } catch (error) {
    }
  }

  /**
   * Retrieve candles from cache
   */
  async getCandlesFromCache(
    pair: string,
    granularity: string,
    startTime: number,
    endTime: number
  ): Promise<CandleData[] | null> {
    try {
      const response = await fetch(
        `/api/candles/${pair}/${granularity}?startTime=${startTime}&endTime=${endTime}`
      );

      if (response.ok) {
        const data = await response.json();
        return data.success ? data.data : null;
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Clear cache for a specific pair and granularity
   */
  async clearCache(pair: string, granularity?: string): Promise<void> {
    try {
      const url = granularity
        ? `/api/cache-clear?pair=${pair}&granularity=${granularity}`
        : `/api/cache-clear?pair=${pair}`;

      await fetch(url, { method: 'DELETE' });
    } catch (error) {
    }
  }

  /**
   * Get cache stats
   */
  async getCacheStats(): Promise<{
    size: number;
    entries: number;
    lastUpdate: number;
  } | null> {
    try {
      const response = await fetch('/api/cache-stats');
      if (response.ok) {
        return await response.json();
      }
      return null;
    } catch (error) {
      return null;
    }
  }
}

/**
 * Export singleton instance
 */
export const chartCacheService = new ChartCacheService();
