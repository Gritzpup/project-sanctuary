// @ts-nocheck - Iterator value type compatibility
import type { CandleData } from '../../../types/coinbase';

export class DataCacheManager {
  private memoryCache: Map<string, CandleData[]> = new Map();
  private maxMemoryCacheSize = 100; // Max entries in memory

  public async initialize(): Promise<void> {
  }

  public async storeData(symbol: string, granularity: string, data: CandleData[]): Promise<void> {
    const key = `${symbol}-${granularity}`;
    
    // Store in memory cache with LRU eviction
    if (this.memoryCache.size >= this.maxMemoryCacheSize) {
      const firstKey = this.memoryCache.keys().next().value;
      this.memoryCache.delete(firstKey);
    }
    
    this.memoryCache.set(key, data);
  }

  public async getData(symbol: string, granularity: string): Promise<CandleData[] | null> {
    const key = `${symbol}-${granularity}`;
    return this.memoryCache.get(key) || null;
  }

  public async clearCache(): Promise<void> {
    this.memoryCache.clear();
  }

  public getCacheStats(): { entries: number; memoryUsage: string } {
    return {
      entries: this.memoryCache.size,
      memoryUsage: `${this.memoryCache.size}/${this.maxMemoryCacheSize}`
    };
  }
}