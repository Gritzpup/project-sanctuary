/**
 * @file oneMinuteCache.ts
 * @description Caches 1-minute candles for performance
 */

import type { CandleData } from '../types/coinbase';

const DB_NAME = 'TradingDataCache';
const DB_VERSION = 3; // New version for schema change
const CANDLES_STORE = 'oneMinuteCandles';
const METADATA_STORE = 'metadata';

interface CandleRecord {
  id: string; // "symbol-timestamp" e.g. "BTC-USD-1704409200"
  symbol: string;
  time: number;
  candle: CandleData;
}

interface Metadata {
  symbol: string;
  oldestCandle: number;
  newestCandle: number;
  totalCandles: number;
  lastUpdate: number;
}

export class OneMinuteCache {
  private db: IDBDatabase | null = null;
  private updateCallbacks: Map<string, () => void> = new Map();

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
        console.log('OneMinuteCache initialized successfully');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Clean up old stores
        const oldStores = ['candles', 'chunks'];
        for (const store of oldStores) {
          if (db.objectStoreNames.contains(store)) {
            db.deleteObjectStore(store);
          }
        }
        
        // Create new 1-minute candles store
        if (!db.objectStoreNames.contains(CANDLES_STORE)) {
          const store = db.createObjectStore(CANDLES_STORE, { keyPath: 'id' });
          store.createIndex('symbol', 'symbol', { unique: false });
          store.createIndex('time', 'time', { unique: false });
          store.createIndex('symbol-time', ['symbol', 'time'], { unique: true });
        }
        
        // Keep metadata store
        if (!db.objectStoreNames.contains(METADATA_STORE)) {
          db.createObjectStore(METADATA_STORE, { keyPath: 'symbol' });
        }
      };
    });
  }

  private async ensureDB(): Promise<IDBDatabase> {
    if (!this.db) {
      await this.initDB();
    }
    if (!this.db) {
      throw new Error('Failed to initialize OneMinuteCache');
    }
    return this.db;
  }

  /**
   * Store a batch of 1-minute candles
   */
  async storeCandles(symbol: string, candles: CandleData[]): Promise<void> {
    if (!candles || candles.length === 0) return;
    
    try {
      const db = await this.ensureDB();
      const tx = db.transaction([CANDLES_STORE, METADATA_STORE], 'readwrite');
      const candleStore = tx.objectStore(CANDLES_STORE);
      const metaStore = tx.objectStore(METADATA_STORE);

      // Prepare candle records
      for (const candle of candles) {
        const record: CandleRecord = {
          id: `${symbol}-${candle.time}`,
          symbol,
          time: candle.time,
          candle
        };
        candleStore.put(record);
      }

      // Update metadata
      const meta = await this.getMetadata(symbol);
      const times = candles.map(c => c.time);
      const newMeta: Metadata = {
        symbol,
        oldestCandle: meta ? Math.min(meta.oldestCandle, ...times) : Math.min(...times),
        newestCandle: meta ? Math.max(meta.newestCandle, ...times) : Math.max(...times),
        totalCandles: (meta?.totalCandles || 0) + candles.length,
        lastUpdate: Date.now()
      };
      metaStore.put(newMeta);

      // Wait for transaction to complete
      await new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve(undefined);
        tx.onerror = () => {
          console.error('Transaction error:', tx.error);
          reject(tx.error);
        };
      });
      
      // Notify listeners
      this.notifyUpdate(symbol);
    } catch (error) {
      console.error('Error storing candles:', error);
    }
  }

  /**
   * Get 1-minute candles for a time range
   */
  async getCandles(symbol: string, startTime: number, endTime: number): Promise<CandleData[]> {
    try {
      const db = await this.ensureDB();
      const tx = db.transaction(CANDLES_STORE, 'readonly');
      const store = tx.objectStore(CANDLES_STORE);
      const index = store.index('symbol-time');
      
      const range = IDBKeyRange.bound([symbol, startTime], [symbol, endTime]);
      const request = index.getAll(range);
      
      return new Promise((resolve, reject) => {
        request.onsuccess = () => {
          const records = request.result || [];
          if (!Array.isArray(records)) {
            console.warn('IndexedDB returned non-array:', records);
            resolve([]);
            return;
          }
          const candles = records.map(r => r.candle).sort((a, b) => a.time - b.time);
          resolve(candles);
        };
        
        request.onerror = () => {
          console.error('IndexedDB error:', request.error);
          resolve([]); // Return empty array on error
        };
      });
    } catch (error) {
      console.error('Error in getCandles:', error);
      return [];
    }
  }

  /**
   * Get the latest candle for a symbol
   */
  async getLatestCandle(symbol: string): Promise<CandleData | null> {
    const meta = await this.getMetadata(symbol);
    if (!meta) return null;
    
    const candles = await this.getCandles(symbol, meta.newestCandle, meta.newestCandle);
    return candles[0] || null;
  }

  /**
   * Update or insert a single candle (for real-time updates)
   */
  async updateCandle(symbol: string, candle: CandleData): Promise<void> {
    try {
      const db = await this.ensureDB();
      
      // Get metadata first in a separate transaction
      const meta = await this.getMetadata(symbol);
      
      const tx = db.transaction([CANDLES_STORE, METADATA_STORE], 'readwrite');
      const candleStore = tx.objectStore(CANDLES_STORE);
      const metaStore = tx.objectStore(METADATA_STORE);

      const record: CandleRecord = {
        id: `${symbol}-${candle.time}`,
        symbol,
        time: candle.time,
        candle
      };
      candleStore.put(record);

      // Update metadata if this is a new newest candle
      if (!meta || candle.time > meta.newestCandle || candle.time < meta.oldestCandle) {
        const newMeta: Metadata = {
          symbol,
          oldestCandle: meta ? Math.min(meta.oldestCandle, candle.time) : candle.time,
          newestCandle: meta ? Math.max(meta.newestCandle, candle.time) : candle.time,
          totalCandles: (meta?.totalCandles || 0) + 1,
          lastUpdate: Date.now()
        };
        metaStore.put(newMeta);
      }

      // Wait for transaction to complete
      await new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve(undefined);
        tx.onerror = () => {
          console.error('Transaction error:', tx.error);
          reject(tx.error);
        };
      });
      
      this.notifyUpdate(symbol);
    } catch (error) {
      console.error('Error updating candle:', error);
    }
  }

  /**
   * Get metadata for a symbol
   */
  async getMetadata(symbol: string): Promise<Metadata | null> {
    try {
      const db = await this.ensureDB();
      const tx = db.transaction(METADATA_STORE, 'readonly');
      const store = tx.objectStore(METADATA_STORE);
      const request = store.get(symbol);
      
      return new Promise((resolve) => {
        request.onsuccess = () => {
          resolve(request.result || null);
        };
        request.onerror = () => {
          console.error('Error getting metadata:', request.error);
          resolve(null);
        };
      });
    } catch (error) {
      console.error('Error in getMetadata:', error);
      return null;
    }
  }

  /**
   * Check what time ranges we have cached
   */
  async getMissingRanges(symbol: string, startTime: number, endTime: number): Promise<Array<{start: number, end: number}>> {
    const candles = await this.getCandles(symbol, startTime, endTime);
    const candleSet = new Set(candles.map(c => c.time));
    
    const missing: Array<{start: number, end: number}> = [];
    let missingStart: number | null = null;
    
    // Check every minute in the range
    for (let time = Math.floor(startTime / 60) * 60; time <= endTime; time += 60) {
      if (!candleSet.has(time)) {
        if (missingStart === null) {
          missingStart = time;
        }
      } else if (missingStart !== null) {
        missing.push({ start: missingStart, end: time - 60 });
        missingStart = null;
      }
    }
    
    if (missingStart !== null) {
      missing.push({ start: missingStart, end: endTime });
    }
    
    return missing;
  }

  /**
   * Subscribe to updates for a symbol
   */
  onUpdate(symbol: string, callback: () => void): () => void {
    const key = `${symbol}-${Math.random()}`;
    this.updateCallbacks.set(key, callback);
    
    // Return unsubscribe function
    return () => {
      this.updateCallbacks.delete(key);
    };
  }

  private notifyUpdate(symbol: string) {
    for (const [key, callback] of this.updateCallbacks) {
      if (key.startsWith(symbol)) {
        callback();
      }
    }
  }

  /**
   * Clear all data (for debugging)
   */
  async clear(): Promise<void> {
    try {
      const db = await this.ensureDB();
      const tx = db.transaction([CANDLES_STORE, METADATA_STORE], 'readwrite');
      tx.objectStore(CANDLES_STORE).clear();
      tx.objectStore(METADATA_STORE).clear();
      
      await new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve(undefined);
        tx.onerror = () => {
          console.error('Clear transaction error:', tx.error);
          reject(tx.error);
        };
      });
    } catch (error) {
      console.error('Error clearing data:', error);
    }
  }
}