/**
 * @file operations.ts
 * @description Core IndexedDB operations
 */

import { DB_NAME, DB_VERSION, CHUNKS_STORE, METADATA_STORE, type DataChunk, type DataMetadata } from './schema';

export class IndexedDBOperations {
  private db: IDBDatabase | null = null;
  private dbPromise: Promise<void>;
  
  constructor() {
    this.dbPromise = this.initDB();
  }
  
  async waitForDB(): Promise<void> {
    await this.dbPromise;
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
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Delete old store if it exists (for migration)
        if (db.objectStoreNames.contains('candles')) {
          db.deleteObjectStore('candles');
        }
        
        // Create chunks store
        if (!db.objectStoreNames.contains(CHUNKS_STORE)) {
          const chunksStore = db.createObjectStore(CHUNKS_STORE, { keyPath: 'chunkId' });
          chunksStore.createIndex('symbol', 'symbol', { unique: false });
          chunksStore.createIndex('granularity', 'granularity', { unique: false });
          chunksStore.createIndex('startTime', 'startTime', { unique: false });
          chunksStore.createIndex('endTime', 'endTime', { unique: false });
          chunksStore.createIndex('lastUpdated', 'lastUpdated', { unique: false });
        }

        // Create metadata store
        if (!db.objectStoreNames.contains(METADATA_STORE)) {
          db.createObjectStore(METADATA_STORE, { keyPath: 'symbol' });
        }
      };
    });
  }

  async getChunk(chunkId: string): Promise<DataChunk | null> {
    await this.waitForDB();
    if (!this.db) return null;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([CHUNKS_STORE], 'readonly');
      const store = transaction.objectStore(CHUNKS_STORE);
      const request = store.get(chunkId);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async putChunk(chunk: DataChunk): Promise<void> {
    await this.waitForDB();
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([CHUNKS_STORE], 'readwrite');
      const store = transaction.objectStore(CHUNKS_STORE);
      const request = store.put(chunk);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async deleteChunk(chunkId: string): Promise<void> {
    await this.waitForDB();
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([CHUNKS_STORE], 'readwrite');
      const store = transaction.objectStore(CHUNKS_STORE);
      const request = store.delete(chunkId);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getChunksBySymbolAndGranularity(symbol: string, granularity: string): Promise<DataChunk[]> {
    await this.waitForDB();
    if (!this.db) return [];

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([CHUNKS_STORE], 'readonly');
      const store = transaction.objectStore(CHUNKS_STORE);
      const index = store.index('symbol');
      const request = index.getAll(symbol);

      request.onsuccess = () => {
        const chunks = request.result.filter((chunk: DataChunk) => 
          chunk.granularity === granularity
        );
        resolve(chunks);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getMetadata(symbol: string): Promise<DataMetadata | null> {
    await this.waitForDB();
    if (!this.db) return null;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([METADATA_STORE], 'readonly');
      const store = transaction.objectStore(METADATA_STORE);
      const request = store.get(symbol);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async putMetadata(metadata: DataMetadata): Promise<void> {
    await this.waitForDB();
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([METADATA_STORE], 'readwrite');
      const store = transaction.objectStore(METADATA_STORE);
      const request = store.put(metadata);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getAllChunks(): Promise<DataChunk[]> {
    await this.waitForDB();
    if (!this.db) return [];

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([CHUNKS_STORE], 'readonly');
      const store = transaction.objectStore(CHUNKS_STORE);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async clearAll(): Promise<void> {
    await this.waitForDB();
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([CHUNKS_STORE, METADATA_STORE], 'readwrite');
      
      const clearChunks = transaction.objectStore(CHUNKS_STORE).clear();
      const clearMetadata = transaction.objectStore(METADATA_STORE).clear();

      let completed = 0;
      const complete = () => {
        completed++;
        if (completed === 2) resolve();
      };

      clearChunks.onsuccess = complete;
      clearMetadata.onsuccess = complete;
      
      clearChunks.onerror = () => reject(clearChunks.error);
      clearMetadata.onerror = () => reject(clearMetadata.error);
    });
  }

  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}