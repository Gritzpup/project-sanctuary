/**
 * IndexedDB Persistent Cache for Chart Data
 *
 * Provides instant page load by storing chart data in browser's IndexedDB.
 * Supports delta sync (only fetch new candles since last session).
 *
 * Storage Strategy:
 * - Last 5 pair/granularity combinations (e.g., BTC-USD:1m, BTC-USD:15m, ETH-USD:1m)
 * - Up to 50MB of storage (vs 5-10MB for localStorage)
 * - 5-minute freshness window for intelligent cache invalidation
 */

import type { CandlestickData } from 'lightweight-charts';
import { ChartDebug } from '../utils/debug';

export interface CachedChartData {
  key?: string; // IndexedDB key
  pair: string;
  granularity: string;
  candles: CandlestickData[];
  timestamp: number; // When this was cached
  lastCandleTime: number; // Timestamp of last candle (for delta sync)
  totalCandles: number;
}

export interface CacheMetadata {
  pair: string;
  granularity: string;
  timestamp: number;
  lastCandleTime: number;
  candleCount: number;
  sizeBytes: number;
}

export class ChartIndexedDBCache {
  private dbName = 'HermesTradingChartCache';
  private version = 1;
  private storeName = 'chartData';
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;
  private maxEntries = 5; // Store last 5 pair/granularity combinations
  private freshnessMs = 5 * 60 * 1000; // 5 minutes

  /**
   * Initialize IndexedDB
   */
  async initialize(): Promise<void> {
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => {
        ChartDebug.error('IndexedDB initialization failed:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        ChartDebug.log('✅ IndexedDB initialized successfully');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create object store if it doesn't exist
        if (!db.objectStoreNames.contains(this.storeName)) {
          const objectStore = db.createObjectStore(this.storeName, { keyPath: 'key' });

          // Create indices for efficient querying
          objectStore.createIndex('pair', 'pair', { unique: false });
          objectStore.createIndex('granularity', 'granularity', { unique: false });
          objectStore.createIndex('timestamp', 'timestamp', { unique: false });

          ChartDebug.log('📦 Created IndexedDB object store with indices');
        }
      };
    });

    return this.initPromise;
  }

  /**
   * Generate cache key
   */
  private generateKey(pair: string, granularity: string): string {
    return `${pair}:${granularity}`;
  }

  /**
   * Get cached chart data
   */
  async get(pair: string, granularity: string): Promise<CachedChartData | null> {
    await this.initialize();

    if (!this.db) {
      return null;
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const key = this.generateKey(pair, granularity);
      const request = store.get(key);

      request.onsuccess = () => {
        const result = request.result as CachedChartData | undefined;

        if (!result) {
          ChartDebug.log(`❌ Cache miss for ${key}`);
          resolve(null);
          return;
        }

        const age = Date.now() - result.timestamp;
        const isFresh = age < this.freshnessMs;

        ChartDebug.log(`✅ Cache hit for ${key}`, {
          candles: result.candles.length,
          age: `${Math.floor(age / 1000)}s`,
          fresh: isFresh,
          lastCandleTime: new Date(result.lastCandleTime * 1000).toISOString()
        });

        resolve(result);
      };

      request.onerror = () => {
        ChartDebug.error('IndexedDB get error:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Set cached chart data
   */
  async set(pair: string, granularity: string, candles: CandlestickData[]): Promise<void> {
    await this.initialize();

    if (!this.db || candles.length === 0) {
      return;
    }

    const key = this.generateKey(pair, granularity);
    const lastCandle = candles[candles.length - 1];
    const lastCandleTime = lastCandle.time as number;

    const data: CachedChartData = {
      key,
      pair,
      granularity,
      candles,
      timestamp: Date.now(),
      lastCandleTime,
      totalCandles: candles.length
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.put(data);

      request.onsuccess = () => {
        ChartDebug.log(`💾 Cached ${candles.length} candles for ${key}`);

        // Cleanup old entries if we exceed max
        this.cleanupOldEntries().catch(err => {
          ChartDebug.error('Cleanup error:', err);
        });

        resolve();
      };

      request.onerror = () => {
        ChartDebug.error('IndexedDB set error:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Append new candles to existing cache (delta sync)
   */
  async appendCandles(
    pair: string,
    granularity: string,
    newCandles: CandlestickData[]
  ): Promise<void> {
    if (newCandles.length === 0) {
      return;
    }

    // Get existing cache
    const existing = await this.get(pair, granularity);

    if (!existing) {
      // No existing cache, just set the new candles
      await this.set(pair, granularity, newCandles);
      return;
    }

    // Merge and deduplicate
    const candleMap = new Map<number, CandlestickData>();

    // Add existing candles
    existing.candles.forEach(candle => {
      candleMap.set(candle.time as number, candle);
    });

    // Add new candles (overwrites if duplicate timestamp)
    newCandles.forEach(candle => {
      candleMap.set(candle.time as number, candle);
    });

    // Sort by time
    const mergedCandles = Array.from(candleMap.values()).sort(
      (a, b) => (a.time as number) - (b.time as number)
    );

    // Store merged data
    await this.set(pair, granularity, mergedCandles);

    ChartDebug.log(`🔄 Appended ${newCandles.length} candles to cache`, {
      previous: existing.candles.length,
      new: newCandles.length,
      merged: mergedCandles.length
    });
  }

  /**
   * Check if cache exists and return last candle time for delta sync
   */
  async getLastCandleTime(pair: string, granularity: string): Promise<number | null> {
    const cached = await this.get(pair, granularity);
    return cached ? cached.lastCandleTime : null;
  }

  /**
   * Check if cached data is fresh (within freshness window)
   */
  async isFresh(pair: string, granularity: string): Promise<boolean> {
    const cached = await this.get(pair, granularity);

    if (!cached) {
      return false;
    }

    const age = Date.now() - cached.timestamp;
    return age < this.freshnessMs;
  }

  /**
   * Get all cached entries metadata
   */
  async getAllMetadata(): Promise<CacheMetadata[]> {
    await this.initialize();

    if (!this.db) {
      return [];
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.getAll();

      request.onsuccess = () => {
        const entries = request.result as CachedChartData[];

        const metadata: CacheMetadata[] = entries.map(entry => ({
          pair: entry.pair,
          granularity: entry.granularity,
          timestamp: entry.timestamp,
          lastCandleTime: entry.lastCandleTime,
          candleCount: entry.totalCandles,
          sizeBytes: this.estimateSize(entry)
        }));

        resolve(metadata);
      };

      request.onerror = () => {
        ChartDebug.error('IndexedDB getAllMetadata error:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Clear cache for specific pair/granularity
   */
  async clear(pair: string, granularity: string): Promise<void> {
    await this.initialize();

    if (!this.db) {
      return;
    }

    const key = this.generateKey(pair, granularity);

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.delete(key);

      request.onsuccess = () => {
        ChartDebug.log(`🗑️ Cleared cache for ${key}`);
        resolve();
      };

      request.onerror = () => {
        ChartDebug.error('IndexedDB clear error:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Clear all cached data
   */
  async clearAll(): Promise<void> {
    await this.initialize();

    if (!this.db) {
      return;
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.clear();

      request.onsuccess = () => {
        ChartDebug.log('🗑️ Cleared all cache entries');
        resolve();
      };

      request.onerror = () => {
        ChartDebug.error('IndexedDB clearAll error:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Cleanup old entries (LRU eviction)
   */
  private async cleanupOldEntries(): Promise<void> {
    const metadata = await this.getAllMetadata();

    if (metadata.length <= this.maxEntries) {
      return; // No cleanup needed
    }

    // Sort by timestamp (oldest first)
    metadata.sort((a, b) => a.timestamp - b.timestamp);

    // Delete oldest entries
    const toDelete = metadata.slice(0, metadata.length - this.maxEntries);

    for (const entry of toDelete) {
      await this.clear(entry.pair, entry.granularity);
    }

    ChartDebug.log(`🧹 Cleaned up ${toDelete.length} old cache entries`);
  }

  /**
   * Estimate size of cached entry in bytes
   */
  private estimateSize(data: CachedChartData): number {
    // Rough estimate: each candle is ~48 bytes (6 numbers * 8 bytes)
    return data.candles.length * 48;
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    totalEntries: number;
    totalCandles: number;
    totalSizeBytes: number;
    entries: CacheMetadata[];
  }> {
    const metadata = await this.getAllMetadata();

    return {
      totalEntries: metadata.length,
      totalCandles: metadata.reduce((sum, m) => sum + m.candleCount, 0),
      totalSizeBytes: metadata.reduce((sum, m) => sum + m.sizeBytes, 0),
      entries: metadata
    };
  }

  /**
   * Close database connection
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
      ChartDebug.log('IndexedDB connection closed');
    }
  }
}

// Export singleton instance
export const chartIndexedDBCache = new ChartIndexedDBCache();
