import type { CandleData } from '../types/coinbase';

const DB_NAME = 'CandleCache';
const DB_VERSION = 1;
const STORE_NAME = 'candles';

export class IndexedDBCache {
  private db: IDBDatabase | null = null;
  private readonly TTL_RECENT = 3600000; // 1 hour in ms
  private readonly TTL_OLD = 86400000; // 24 hours in ms
  private readonly MAX_CANDLES_PER_KEY = 1000;

  constructor() {
    this.initDB();
  }

  private async initDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('Failed to open IndexedDB:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('IndexedDB initialized successfully');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Create object store if it doesn't exist
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'key' });
          store.createIndex('expiry', 'expiry', { unique: false });
          store.createIndex('granularity', 'granularity', { unique: false });
        }
      };
    });
  }

  // Ensure DB is ready
  private async ensureDB(): Promise<IDBDatabase> {
    if (!this.db) {
      await this.initDB();
    }
    if (!this.db) {
      throw new Error('Failed to initialize IndexedDB');
    }
    return this.db;
  }

  // Generate cache key for candle data
  private getCandleKey(granularity: number, timeGroup: string): string {
    return `btc:candles:${granularity}:${timeGroup}`;
  }

  // Generate cache key for latest candle
  private getLatestKey(granularity: number): string {
    return `btc:latest:${granularity}`;
  }

  // Get time group for a timestamp based on granularity
  private getTimeGroup(timestamp: number, granularity: number): string {
    const date = new Date(timestamp * 1000);
    
    if (granularity <= 300) { // 1m, 5m - group by day
      return date.toISOString().split('T')[0];
    } else if (granularity <= 3600) { // 15m, 1h - group by week
      const weekNum = Math.floor(date.getTime() / (7 * 24 * 60 * 60 * 1000));
      return `w${weekNum}`;
    } else if (granularity <= 21600) { // 6h - group by month
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    } else { // 1D - group by year
      return `${date.getFullYear()}`;
    }
  }

  // Get cached candles for a time range
  async getCachedCandles(
    granularity: number,
    startTime: number,
    endTime: number
  ): Promise<CandleData[]> {
    try {
      const db = await this.ensureDB();
      const timeGroups = this.getTimeGroupsInRange(startTime, endTime, granularity);
      const allCandles: CandleData[] = [];
      
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      
      // Fetch all relevant time groups
      const promises = timeGroups.map(group => {
        const key = this.getCandleKey(granularity, group);
        return new Promise<CandleData[]>((resolve) => {
          const request = store.get(key);
          request.onsuccess = () => {
            const result = request.result;
            if (result && result.expiry > Date.now()) {
              resolve(result.candles || []);
            } else {
              resolve([]);
            }
          };
          request.onerror = () => resolve([]);
        });
      });
      
      const results = await Promise.all(promises);
      for (const candles of results) {
        allCandles.push(...candles);
      }
      
      // Filter to requested time range and sort
      return allCandles
        .filter(c => c.time >= startTime && c.time <= endTime)
        .sort((a, b) => a.time - b.time);
    } catch (error) {
      console.error('Error getting cached candles:', error);
      return [];
    }
  }

  // Set cached candles
  async setCachedCandles(granularity: number, candles: CandleData[]): Promise<void> {
    if (candles.length === 0) return;
    
    try {
      const db = await this.ensureDB();
      
      // Group candles by time group
      const groups = new Map<string, CandleData[]>();
      
      for (const candle of candles) {
        const group = this.getTimeGroup(candle.time, granularity);
        if (!groups.has(group)) {
          groups.set(group, []);
        }
        groups.get(group)!.push(candle);
      }
      
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      
      for (const [group, groupCandles] of groups) {
        const key = this.getCandleKey(granularity, group);
        
        // Get existing candles
        const getRequest = store.get(key);
        
        await new Promise<void>((resolve, reject) => {
          getRequest.onsuccess = async () => {
            const existing = getRequest.result;
            let existingCandles: CandleData[] = existing?.candles || [];
            
            // Merge with new candles, avoiding duplicates
            const candleMap = new Map<number, CandleData>();
            
            // Add existing candles
            for (const candle of existingCandles) {
              candleMap.set(candle.time, candle);
            }
            
            // Add/update new candles
            for (const candle of groupCandles) {
              candleMap.set(candle.time, candle);
            }
            
            // Sort and limit size
            const mergedCandles = Array.from(candleMap.values())
              .sort((a, b) => a.time - b.time)
              .slice(-this.MAX_CANDLES_PER_KEY);
            
            // Determine TTL based on how recent the data is
            const now = Date.now() / 1000;
            const mostRecent = mergedCandles[mergedCandles.length - 1]?.time || 0;
            const ttl = (now - mostRecent) < 86400 ? this.TTL_RECENT : this.TTL_OLD;
            
            // Store the data
            const putRequest = store.put({
              key,
              granularity,
              candles: mergedCandles,
              expiry: Date.now() + ttl
            });
            
            putRequest.onsuccess = () => resolve();
            putRequest.onerror = () => reject(putRequest.error);
          };
          
          getRequest.onerror = () => reject(getRequest.error);
        });
      }
      
      await new Promise<void>((resolve) => {
        transaction.oncomplete = () => resolve();
      });
    } catch (error) {
      console.error('Error setting cached candles:', error);
    }
  }

  // Update the latest candle
  async updateLatestCandle(granularity: number, candle: CandleData): Promise<void> {
    try {
      const db = await this.ensureDB();
      const key = this.getLatestKey(granularity);
      
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      
      await new Promise<void>((resolve, reject) => {
        const request = store.put({
          key,
          granularity,
          candles: [candle],
          expiry: Date.now() + 60000 // 1 minute TTL for latest
        });
        
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
      
      // Also update in the main cache
      await this.setCachedCandles(granularity, [candle]);
    } catch (error) {
      console.error('Error updating latest candle:', error);
    }
  }

  // Get the latest candle
  async getLatestCandle(granularity: number): Promise<CandleData | null> {
    try {
      const db = await this.ensureDB();
      const key = this.getLatestKey(granularity);
      
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      
      return new Promise((resolve) => {
        const request = store.get(key);
        
        request.onsuccess = () => {
          const result = request.result;
          if (result && result.expiry > Date.now() && result.candles?.length > 0) {
            resolve(result.candles[0]);
          } else {
            resolve(null);
          }
        };
        
        request.onerror = () => resolve(null);
      });
    } catch (error) {
      console.error('Error getting latest candle:', error);
      return null;
    }
  }

  // Get time groups in a range
  private getTimeGroupsInRange(startTime: number, endTime: number, granularity: number): string[] {
    const groups = new Set<string>();
    let current = startTime;
    
    while (current <= endTime) {
      groups.add(this.getTimeGroup(current, granularity));
      
      // Increment based on granularity
      if (granularity <= 300) {
        current += 86400; // 1 day
      } else if (granularity <= 3600) {
        current += 7 * 86400; // 1 week
      } else if (granularity <= 21600) {
        current += 30 * 86400; // ~1 month
      } else {
        current += 365 * 86400; // 1 year
      }
    }
    
    return Array.from(groups);
  }

  // Clear all cached data (for debugging)
  async clearCache(): Promise<void> {
    try {
      const db = await this.ensureDB();
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      
      await new Promise<void>((resolve, reject) => {
        const request = store.clear();
        request.onsuccess = () => {
          console.log('Cache cleared');
          resolve();
        };
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Error clearing cache:', error);
    }
  }

  // Clean expired entries
  async cleanExpired(): Promise<void> {
    try {
      const db = await this.ensureDB();
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('expiry');
      
      const now = Date.now();
      const range = IDBKeyRange.upperBound(now);
      
      const request = index.openCursor(range);
      
      await new Promise<void>((resolve) => {
        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest).result;
          if (cursor) {
            store.delete(cursor.primaryKey);
            cursor.continue();
          } else {
            resolve();
          }
        };
        
        request.onerror = () => resolve();
      });
    } catch (error) {
      console.error('Error cleaning expired entries:', error);
    }
  }

  // Check if cache is available
  isAvailable(): boolean {
    return 'indexedDB' in window;
  }

  // Close the database connection
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

// Singleton instance
let cacheInstance: IndexedDBCache | null = null;

export function getIndexedDBCache(): IndexedDBCache {
  if (!cacheInstance) {
    cacheInstance = new IndexedDBCache();
  }
  return cacheInstance;
}