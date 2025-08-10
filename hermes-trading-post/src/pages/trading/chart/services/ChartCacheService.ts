import type { Candle, DataCache } from '../types/data.types';
import { ChartDebug } from '../utils/debug';

export class ChartCacheService {
  private cache: Map<string, DataCache> = new Map();
  private maxCacheSize: number = 100; // Maximum number of cache entries
  private cacheExpiryMs: number = 5 * 60 * 1000; // 5 minutes
  private lastCleanup: number = Date.now();
  private cleanupInterval: number = 60 * 1000; // Clean every minute

  generateKey(
    pair: string, 
    granularity: string, 
    startTime: number, 
    endTime: number
  ): string {
    return `${pair}:${granularity}:${startTime}:${endTime}`;
  }

  async get(key: string): Promise<Candle[] | null> {
    this.cleanupIfNeeded();

    const cached = this.cache.get(key);
    if (!cached) {
      return null;
    }

    // Check if expired
    if (Date.now() > cached.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    ChartDebug.log(`Cache hit for ${key}`);
    return cached.data;
  }

  async set(key: string, data: Candle[]): Promise<void> {
    this.cleanupIfNeeded();

    // Implement LRU eviction if cache is full
    if (this.cache.size >= this.maxCacheSize) {
      const oldestKey = this.findOldestEntry();
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    const cacheEntry: DataCache = {
      key,
      data,
      timestamp: Date.now(),
      expiresAt: Date.now() + this.cacheExpiryMs
    };

    this.cache.set(key, cacheEntry);
    ChartDebug.log(`Cached ${data.length} candles for ${key}`);
  }

  async clearForPair(pair: string): Promise<void> {
    const keysToDelete: string[] = [];
    
    for (const [key] of this.cache) {
      if (key.startsWith(`${pair}:`)) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.cache.delete(key));
    ChartDebug.log(`Cleared ${keysToDelete.length} entries for ${pair}`);
  }

  async clearAll(): Promise<void> {
    const size = this.cache.size;
    this.cache.clear();
    ChartDebug.log(`Cleared all ${size} cache entries`);
  }

  getStatus(): {
    size: number;
    maxSize: number;
    utilization: number;
    oldestEntry: number | null;
  } {
    let oldestTimestamp: number | null = null;

    for (const [, entry] of this.cache) {
      if (!oldestTimestamp || entry.timestamp < oldestTimestamp) {
        oldestTimestamp = entry.timestamp;
      }
    }

    return {
      size: this.cache.size,
      maxSize: this.maxCacheSize,
      utilization: (this.cache.size / this.maxCacheSize) * 100,
      oldestEntry: oldestTimestamp
    };
  }

  private cleanupIfNeeded(): void {
    const now = Date.now();
    if (now - this.lastCleanup < this.cleanupInterval) {
      return;
    }

    this.lastCleanup = now;
    this.cleanupExpired();
  }

  private cleanupExpired(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cache) {
      if (now > entry.expiresAt) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.cache.delete(key));
    
    if (keysToDelete.length > 0) {
      ChartDebug.log(`Cleaned up ${keysToDelete.length} expired entries`);
    }
  }

  private findOldestEntry(): string | null {
    let oldestKey: string | null = null;
    let oldestTimestamp = Date.now();

    for (const [key, entry] of this.cache) {
      if (entry.timestamp < oldestTimestamp) {
        oldestTimestamp = entry.timestamp;
        oldestKey = key;
      }
    }

    return oldestKey;
  }

  updateCacheExpiry(minutes: number): void {
    this.cacheExpiryMs = minutes * 60 * 1000;
  }

  updateMaxCacheSize(size: number): void {
    this.maxCacheSize = size;
    
    // Evict entries if new size is smaller
    while (this.cache.size > this.maxCacheSize) {
      const oldestKey = this.findOldestEntry();
      if (oldestKey) {
        this.cache.delete(oldestKey);
      } else {
        break;
      }
    }
  }
}