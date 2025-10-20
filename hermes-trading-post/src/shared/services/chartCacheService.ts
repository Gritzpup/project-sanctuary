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
  private readonly FETCH_TIMEOUT_MS = 5000; // 5 second timeout to prevent freezes
  private readonly HEALTH_CHECK_TIMEOUT_MS = 2000; // 2 second timeout for health checks

  // 🚀 PHASE 17: LRU cache for chart data with bounded memory
  // Stores fetched candles with max 500 entries (each entry ~50KB = 25MB max)
  private memoryCache = new LRUCache<string, CandleData[]>({
    maxSize: 500,
    onEvict: (key, value) => {
      // Log when old cache entries are evicted (optional debugging)
      // console.log(`[LRUCache] Evicting ${key} (${value.length} candles)`);
    }
  });

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
        console.warn(`⏱️ Network request timeout after ${timeoutMs}ms: ${url}`);
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
        console.warn('⚠️ Chart cache service: Backend connectivity test failed');
      }
    } catch (error) {
      console.warn('⚠️ Chart cache service initialization failed:', error);
    }
  }

  /**
   * Fetch historical candles with timeout and fallback support
   * ⚡ PHASE 8A: Prevents chart freeze on backend unavailability
   */
  async fetchCandles(request: DataRequest): Promise<CandleData[]> {
    const { pair, granularity, start, end, limit = 1000 } = request;

    // 🚀 PHASE 17: Check LRU memory cache first (eliminates network call)
    // Cache key includes pair and granularity (most common request pattern)
    const cacheKey = createCacheKey(pair, granularity);
    const cachedCandles = this.memoryCache.get(cacheKey);

    if (cachedCandles) {
      // Filter to requested time range if needed
      if (start && end) {
        return cachedCandles.filter(c => {
          const time = typeof c.time === 'number' ? c.time : parseInt(c.time as any);
          return time >= start && time <= end;
        });
      }

      // Return up to limit candles
      return cachedCandles.slice(-limit);
    }

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
        console.warn(`⏱️ Chart data fetch timed out for ${pair}:${granularity}`);
        return [];
      }

      if (!response.ok) {
        console.warn(`Failed to fetch candles: HTTP ${response.status}`);
        return [];
      }

      const result: RedisChartDataResponse = await response.json();

      if (!result.success) {
        console.warn(`Failed to fetch candles: ${result.error}`);
        return [];
      }

      const candles = result.data.candles || [];

      // 🚀 PHASE 17: Store in LRU cache for future requests
      if (candles.length > 0) {
        this.memoryCache.set(cacheKey, candles);
      }

      return candles;
    } catch (error) {
      console.warn('Failed to fetch candles:', error);
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
      console.warn('Failed to fetch candles with metadata:', error);
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
      console.warn('Failed to get storage stats:', error);
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
      console.warn('Failed to store candles in cache:', error);
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
      console.warn('Cache retrieval failed:', error);
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
      console.warn('Cache clear failed:', error);
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
      console.warn('Failed to get cache stats:', error);
      return null;
    }
  }
}

/**
 * Export singleton instance
 */
export const chartCacheService = new ChartCacheService();
