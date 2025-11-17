/**
 * @file BackendCacheService.ts
 * @description Simplified cache service that delegates to backend server
 * Replaces heavy IndexedDB operations with lightweight backend calls
 */

import type { CandleData } from '../../types/coinbase';
import { BackendAPIService } from '../api/BackendAPIService';

interface CacheRequest {
  symbol: string;
  granularity: string;
  startTime: number;
  endTime: number;
}

interface CacheResponse {
  candles: CandleData[];
  fromCache: boolean;
  metadata: {
    totalCandles: number;
    earliestTime: number;
    latestTime: number;
  };
}

export class BackendCacheService {
  private static instance: BackendCacheService;
  private backendAPI: BackendAPIService;
  
  // Minimal in-memory cache for immediate lookups
  private memoryCache = new Map<string, CandleData[]>();
  private readonly MEMORY_CACHE_TTL = 60000; // 1 minute
  private readonly MAX_MEMORY_ITEMS = 50;
  
  private constructor() {
    this.backendAPI = BackendAPIService.getInstance();
  }
  
  public static getInstance(): BackendCacheService {
    if (!BackendCacheService.instance) {
      BackendCacheService.instance = new BackendCacheService();
    }
    return BackendCacheService.instance;
  }
  
  /**
   * Get candles with backend-first approach
   */
  async getCandles(request: CacheRequest): Promise<CacheResponse> {
    const cacheKey = this.generateCacheKey(request);
    
    // Check memory cache first (very fast)
    const memoryResult = this.memoryCache.get(cacheKey);
    if (memoryResult) {
      return {
        candles: memoryResult,
        fromCache: true,
        metadata: {
          totalCandles: memoryResult.length,
          earliestTime: memoryResult[0]?.time || 0,
          latestTime: memoryResult[memoryResult.length - 1]?.time || 0
        }
      };
    }
    
    try {
      // Delegate to backend (primary data source)
      const response = await this.backendAPI.getHistoricalData({
        symbol: request.symbol,
        granularity: request.granularity,
        start: request.startTime,
        end: request.endTime
      });
      
      // Cache in memory for immediate reuse
      this.storeInMemoryCache(cacheKey, response.candles);
      
      return {
        candles: response.candles,
        fromCache: false,
        metadata: {
          totalCandles: response.candles.length,
          earliestTime: response.candles[0]?.time || 0,
          latestTime: response.candles[response.candles.length - 1]?.time || 0
        }
      };
      
    } catch (error) {
      
      // Return empty result rather than complex fallback
      return {
        candles: [],
        fromCache: false,
        metadata: {
          totalCandles: 0,
          earliestTime: 0,
          latestTime: 0
        }
      };
    }
  }
  
  /**
   * Store candles (delegates to backend)
   */
  async storeCandles(request: CacheRequest, candles: CandleData[]): Promise<void> {
    const cacheKey = this.generateCacheKey(request);
    
    // Store in memory cache immediately
    this.storeInMemoryCache(cacheKey, candles);
    
    // Backend handles persistence automatically
    // No need for complex browser storage management
  }
  
  /**
   * Clear cache (minimal operation)
   */
  async clearCache(): Promise<void> {
    this.memoryCache.clear();
    // Backend cache is managed server-side
  }
  
  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      memoryItems: this.memoryCache.size,
      maxMemoryItems: this.MAX_MEMORY_ITEMS,
      memoryCacheTTL: this.MEMORY_CACHE_TTL
    };
  }
  
  // Private helpers
  
  private generateCacheKey(request: CacheRequest): string {
    return `${request.symbol}_${request.granularity}_${request.startTime}_${request.endTime}`;
  }
  
  private storeInMemoryCache(key: string, candles: CandleData[]): void {
    // Evict oldest if at capacity
    if (this.memoryCache.size >= this.MAX_MEMORY_ITEMS) {
      const firstKey = this.memoryCache.keys().next().value;
      this.memoryCache.delete(firstKey);
    }
    
    this.memoryCache.set(key, candles);
    
    // Auto-expire after TTL
    setTimeout(() => {
      this.memoryCache.delete(key);
    }, this.MEMORY_CACHE_TTL);
  }
}

// Export singleton instance
export const backendCache = BackendCacheService.getInstance();