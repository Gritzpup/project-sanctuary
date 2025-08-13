/**
 * @file indexedDBCache.ts
 * @description Browser-based persistent storage for market data
 */

import type { CandleData } from '../types/coinbase';

const DB_NAME = 'TradingDataCache';
const DB_VERSION = 4; // Increment to force schema upgrade
const CHUNKS_STORE = 'chunks';
const METADATA_STORE = 'metadata';

interface DataChunk {
  chunkId: string;
  symbol: string;
  granularity: string;
  startTime: number;
  endTime: number;
  candles: CandleData[];
  lastUpdated: number;
  isComplete: boolean;
}

interface DataMetadata {
  symbol: string;
  earliestData: number;
  latestData: number;
  totalCandles: number;
  lastSync: number;
  granularityRanges: {
    [granularity: string]: {
      startTime: number;
      endTime: number;
      candleCount: number;
    };
  };
}

export class IndexedDBCache {
  private db: IDBDatabase | null = null;
  private readonly TTL_RECENT = 3600000; // 1 hour in ms
  private readonly TTL_OLD = 86400000; // 24 hours in ms
  private dbPromise: Promise<void>;
  
  // Cache limits to prevent excessive storage - AGGRESSIVE LIMITS
  private readonly MAX_CANDLES_PER_GRANULARITY = {
    '1m': 2880,     // 2 days of 1-minute candles (was 7 days)
    '5m': 2016,     // 7 days of 5-minute candles (was 30 days)
    '15m': 2880,    // 30 days of 15-minute candles (was 120 days)
    '1h': 2160,     // 90 days of hourly candles (was 365 days)
    '6h': 1460,     // 1 year of 6-hour candles (was 5 years)
    '1d': 2200,     // 6 years of daily candles (supports 5Y chart)
    '1D': 2200      // 6 years of daily candles (supports 5Y chart)
  };

  constructor() {
    this.dbPromise = this.initDB();
  }
  
  private async waitForDB(): Promise<void> {
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
        // console.log('IndexedDB initialized successfully');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        const oldVersion = event.oldVersion;
        const newVersion = event.newVersion;
        
        // console.log(`Upgrading IndexedDB from version ${oldVersion} to ${newVersion}`);
        // console.log('Existing stores:', Array.from(db.objectStoreNames));
        
        // Delete old store if it exists (for migration)
        if (db.objectStoreNames.contains('candles')) {
          // console.log('Deleting old candles store');
          db.deleteObjectStore('candles');
        }
        
        // Create chunks store
        if (!db.objectStoreNames.contains(CHUNKS_STORE)) {
          // console.log('Creating chunks store');
          const chunksStore = db.createObjectStore(CHUNKS_STORE, { keyPath: 'chunkId' });
          chunksStore.createIndex('symbol', 'symbol', { unique: false });
          chunksStore.createIndex('granularity', 'granularity', { unique: false });
          chunksStore.createIndex('startTime', 'startTime', { unique: false });
          chunksStore.createIndex('endTime', 'endTime', { unique: false });
          chunksStore.createIndex('symbol-granularity', ['symbol', 'granularity'], { unique: false });
        }
        
        // Create metadata store
        if (!db.objectStoreNames.contains(METADATA_STORE)) {
          // console.log('Creating metadata store');
          db.createObjectStore(METADATA_STORE, { keyPath: 'symbol' });
        }
        
        // console.log('Upgrade complete. Stores:', Array.from(db.objectStoreNames));
      };
    });
  }

  // Ensure DB is ready
  private async ensureDB(): Promise<IDBDatabase> {
    await this.waitForDB();
    if (!this.db) {
      await this.initDB();
    }
    if (!this.db) {
      throw new Error('Failed to initialize IndexedDB');
    }
    return this.db;
  }

  // Generate chunk ID
  private getChunkId(symbol: string, granularity: string, startTime: number): string {
    const date = new Date(startTime * 1000);
    const dateStr = date.toISOString().split('T')[0];
    return `${symbol}-${granularity}-${dateStr}`;
  }

  // Get chunk time boundaries based on granularity
  private getChunkBoundaries(timestamp: number, granularity: string): { start: number; end: number } {
    const date = new Date(timestamp * 1000);
    date.setUTCHours(0, 0, 0, 0);
    
    let start: number;
    let end: number;
    
    switch (granularity) {
      case '1m':
      case '5m':
        // Daily chunks for minute data
        start = Math.floor(date.getTime() / 1000);
        end = start + 86400 - 1;
        break;
      case '15m':
      case '1h':
        // Weekly chunks for hourly data
        const dayOfWeek = date.getUTCDay();
        date.setUTCDate(date.getUTCDate() - dayOfWeek);
        start = Math.floor(date.getTime() / 1000);
        end = start + (7 * 86400) - 1;
        break;
      case '6h':
        // Monthly chunks for 6h data
        date.setUTCDate(1);
        start = Math.floor(date.getTime() / 1000);
        date.setUTCMonth(date.getUTCMonth() + 1);
        end = Math.floor(date.getTime() / 1000) - 1;
        break;
      case '1d':
      case '1D':
      default:
        // Yearly chunks for daily data
        date.setUTCMonth(0, 1);
        start = Math.floor(date.getTime() / 1000);
        date.setUTCFullYear(date.getUTCFullYear() + 1);
        end = Math.floor(date.getTime() / 1000) - 1;
        break;
    }
    
    // Cap end time to current time to prevent future chunks
    const now = Math.floor(Date.now() / 1000);
    end = Math.min(end, now);
    
    return { start, end };
  }

  // Get all chunks that overlap with the requested time range
  async getChunksForTimeRange(
    symbol: string,
    granularity: string,
    startTime: number,
    endTime: number
  ): Promise<DataChunk[]> {
    try {
      const db = await this.ensureDB();
      const transaction = db.transaction([CHUNKS_STORE], 'readonly');
      const store = transaction.objectStore(CHUNKS_STORE);
      const index = store.index('symbol-granularity');
      
      const chunks: DataChunk[] = [];
      const range = IDBKeyRange.only([symbol, granularity]);
      
      return new Promise((resolve, reject) => {
        const request = index.openCursor(range);
        
        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest).result;
          if (cursor) {
            const chunk = cursor.value as DataChunk;
            // Check if chunk overlaps with requested range
            if (chunk.endTime >= startTime && chunk.startTime <= endTime) {
              chunks.push(chunk);
            }
            cursor.continue();
          } else {
            // Sort chunks by start time
            chunks.sort((a, b) => a.startTime - b.startTime);
            resolve(chunks);
          }
        };
        
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Error getting chunks:', error);
      return [];
    }
  }

  // Store a chunk of candle data
  async storeChunk(
    symbol: string,
    granularity: string,
    candles: CandleData[]
  ): Promise<void> {
    if (!candles || candles.length === 0) return;
    
    try {
      const db = await this.ensureDB();
      
      // Group candles into chunks
      const candlesByChunk = new Map<string, CandleData[]>();
      
      for (const candle of candles) {
        const boundaries = this.getChunkBoundaries(candle.time, granularity);
        const chunkId = this.getChunkId(symbol, granularity, boundaries.start);
        
        if (!candlesByChunk.has(chunkId)) {
          candlesByChunk.set(chunkId, []);
        }
        candlesByChunk.get(chunkId)!.push(candle);
      }
      
      // Store each chunk
      const transaction = db.transaction([CHUNKS_STORE, METADATA_STORE], 'readwrite');
      const chunksStore = transaction.objectStore(CHUNKS_STORE);
      const metadataStore = transaction.objectStore(METADATA_STORE);
      
      for (const [chunkId, chunkCandles] of candlesByChunk) {
        // Sort candles by time
        chunkCandles.sort((a, b) => a.time - b.time);
        
        const boundaries = this.getChunkBoundaries(chunkCandles[0].time, granularity);
        
        // Get existing chunk to merge data
        const existingRequest = chunksStore.get(chunkId);
        const existing = await new Promise<DataChunk | undefined>((resolve) => {
          existingRequest.onsuccess = () => resolve(existingRequest.result);
          existingRequest.onerror = () => resolve(undefined);
        });
        
        let mergedCandles = chunkCandles;
        let duplicatesFound = 0;
        
        if (existing) {
          // Merge with existing candles using Map for deduplication
          const candleMap = new Map<number, CandleData>();
          
          // Add existing candles
          for (const candle of existing.candles) {
            candleMap.set(candle.time, candle);
          }
          
          // Add/update new candles, tracking duplicates
          for (const candle of chunkCandles) {
            if (candleMap.has(candle.time)) {
              duplicatesFound++;
            }
            candleMap.set(candle.time, candle);
          }
          
          // Convert back to array and sort
          mergedCandles = Array.from(candleMap.values()).sort((a, b) => a.time - b.time);
          
          // Log if many duplicates found
          if (duplicatesFound > 10) {
            console.warn(`Found ${duplicatesFound} duplicate candles in chunk ${chunkId}`);
          }
        }
        
        // Safety check - prevent storing chunks with excessive candles
        const maxCandlesPerChunk = this.getMaxCandlesPerChunk(granularity);
        if (mergedCandles.length > maxCandlesPerChunk) {
          console.error(`Chunk ${chunkId} has ${mergedCandles.length} candles, exceeding limit of ${maxCandlesPerChunk}. Truncating.`);
          // Keep only the most recent candles
          mergedCandles = mergedCandles.slice(-maxCandlesPerChunk);
        }
        
        const chunk: DataChunk = {
          chunkId,
          symbol,
          granularity,
          startTime: boundaries.start,
          endTime: boundaries.end,
          candles: mergedCandles,
          lastUpdated: Date.now(),
          isComplete: this.isChunkComplete(mergedCandles, granularity, boundaries)
        };
        
        await chunksStore.put(chunk);
      }
      
      // After storing chunks, prune old data if needed
      await this.pruneOldData(symbol, granularity, transaction);
      
      // Update metadata ranges only (not counts)
      await this.updateMetadata(symbol, candles, granularity, metadataStore);
      
      // Wait for transaction to complete
      await new Promise<void>((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      });
      
      // Now recalculate metadata with accurate counts from stored data
      await this.recalculateMetadataFromScratch(symbol);
    } catch (error) {
      console.error('Error storing chunk:', error);
    }
  }

  // Check if a chunk has all expected candles
  private isChunkComplete(candles: CandleData[], granularity: string, boundaries: { start: number; end: number }): boolean {
    // Simply mark as complete if we have any candles
    // The gap detection in getCachedCandles will handle missing data
    return candles.length > 0;
  }

  // Get granularity in seconds
  private getGranularitySeconds(granularity: string): number {
    const map: { [key: string]: number } = {
      '1m': 60,
      '5m': 300,
      '15m': 900,
      '1h': 3600,
      '6h': 21600,
      '1d': 86400,
      '1D': 86400  // Support uppercase
    };
    return map[granularity] || 60;
  }
  
  // Get maximum candles allowed per chunk based on granularity
  private getMaxCandlesPerChunk(granularity: string): number {
    const limits: { [key: string]: number } = {
      '1m': 1440,    // 1 day of 1-minute candles
      '5m': 2016,    // 1 week of 5-minute candles  
      '15m': 2016,   // 3 weeks of 15-minute candles
      '1h': 1000,    // ~42 days of hourly candles
      '6h': 600,     // ~150 days of 6-hour candles
      '1d': 500,     // ~1.3 years of daily candles (increased for 5Y support)
      '1D': 500      // ~1.3 years of daily candles (increased for 5Y support)
    };
    return limits[granularity] || 1000;
  }

  // Update metadata for a symbol
  private async updateMetadata(
    symbol: string,
    candles: CandleData[],
    granularity: string,
    metadataStore: IDBObjectStore
  ): Promise<void> {
    // Get existing metadata
    const existingRequest = metadataStore.get(symbol);
    const existing = await new Promise<DataMetadata | undefined>((resolve) => {
      existingRequest.onsuccess = () => resolve(existingRequest.result);
      existingRequest.onerror = () => resolve(undefined);
    });
    
    const earliestCandle = candles.reduce((min, c) => c.time < min.time ? c : min, candles[0]);
    const latestCandle = candles.reduce((max, c) => c.time > max.time ? c : max, candles[0]);
    
    const metadata: DataMetadata = existing || {
      symbol,
      earliestData: earliestCandle.time,
      latestData: latestCandle.time,
      totalCandles: 0,
      lastSync: Date.now(),
      granularityRanges: {}
    };
    
    // Update overall range
    metadata.earliestData = Math.min(metadata.earliestData, earliestCandle.time);
    metadata.latestData = Math.max(metadata.latestData, latestCandle.time);
    metadata.lastSync = Date.now();
    
    // Update granularity-specific range
    if (!metadata.granularityRanges[granularity]) {
      metadata.granularityRanges[granularity] = {
        startTime: earliestCandle.time,
        endTime: latestCandle.time,
        candleCount: 0 // Will be recalculated from actual data
      };
    } else {
      const range = metadata.granularityRanges[granularity];
      range.startTime = Math.min(range.startTime, earliestCandle.time);
      range.endTime = Math.max(range.endTime, latestCandle.time);
    }
    
    // Save metadata with temporary counts - will be recalculated after transaction
    metadata.totalCandles = -1; // Temporary marker
    await metadataStore.put(metadata);
  }
  
  // Recalculate metadata from scratch - completely rebuild metadata from stored chunks
  private async recalculateMetadataFromScratch(symbol: string): Promise<void> {
    try {
      const db = await this.ensureDB();
      const transaction = db.transaction([CHUNKS_STORE, METADATA_STORE], 'readwrite');
      const chunksStore = transaction.objectStore(CHUNKS_STORE);
      const metadataStore = transaction.objectStore(METADATA_STORE);
      const index = chunksStore.index('symbol');
      
      // Track data for new metadata
      let earliestTime = Infinity;
      let latestTime = 0;
      const granularityData = new Map<string, { 
        startTime: number; 
        endTime: number; 
        candleCount: number 
      }>();
      
      // Scan all chunks for this symbol
      const request = index.openCursor(IDBKeyRange.only(symbol));
      
      await new Promise<void>((resolve, reject) => {
        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest).result;
          if (cursor) {
            const chunk = cursor.value as DataChunk;
            
            // Update overall time range
            if (chunk.candles.length > 0) {
              const chunkEarliest = chunk.candles[0].time;
              const chunkLatest = chunk.candles[chunk.candles.length - 1].time;
              earliestTime = Math.min(earliestTime, chunkEarliest);
              latestTime = Math.max(latestTime, chunkLatest);
              
              // Update granularity-specific data
              const existing = granularityData.get(chunk.granularity);
              if (!existing) {
                granularityData.set(chunk.granularity, {
                  startTime: chunkEarliest,
                  endTime: chunkLatest,
                  candleCount: chunk.candles.length
                });
              } else {
                existing.startTime = Math.min(existing.startTime, chunkEarliest);
                existing.endTime = Math.max(existing.endTime, chunkLatest);
                existing.candleCount += chunk.candles.length;
              }
            }
            
            cursor.continue();
          } else {
            // No more chunks, create new metadata
            resolve();
          }
        };
        
        request.onerror = () => reject(request.error);
      });
      
      // Build new metadata object
      const metadata: DataMetadata = {
        symbol,
        earliestData: earliestTime === Infinity ? 0 : earliestTime,
        latestData: latestTime,
        totalCandles: 0,
        lastSync: Date.now(),
        granularityRanges: {}
      };
      
      // Add granularity ranges
      for (const [gran, data] of granularityData) {
        metadata.granularityRanges[gran] = data;
      }
      
      // Calculate total candles properly
      // Use daily count if available as base truth
      const dailyCount = metadata.granularityRanges['1D']?.candleCount || 
                        metadata.granularityRanges['1d']?.candleCount || 0;
      
      if (dailyCount > 0) {
        metadata.totalCandles = dailyCount;
      } else {
        // Otherwise use the highest granularity available
        const sortedGranularities = ['1D', '1d', '6h', '1h', '15m', '5m', '1m'];
        for (const gran of sortedGranularities) {
          if (metadata.granularityRanges[gran]) {
            metadata.totalCandles = metadata.granularityRanges[gran].candleCount;
            break;
          }
        }
      }
      
      // Save the new metadata
      await metadataStore.put(metadata);
      
      // Log for debugging
      // console.log('Metadata recalculated from scratch:', {
      //   symbol,
      //   totalCandles: metadata.totalCandles,
      //   granularities: Object.entries(metadata.granularityRanges).map(([g, d]) => 
      //     `${g}: ${d.candleCount} candles`
      //   )
      // });
      
    } catch (error) {
      console.error('Error recalculating metadata:', error);
    }
  }

  // Get cached candles for a time range
  async getCachedCandles(
    symbol: string,
    granularity: string,
    startTime: number,
    endTime: number
  ): Promise<{ candles: CandleData[]; gaps: Array<{ start: number; end: number }> }> {
    
    try {
      // Ensure DB is initialized
      if (!this.db) {
        console.log('DB not initialized, waiting...');
        await this.waitForDB();
      }
      
      // Cap endTime to current time to prevent future data requests
      const now = Math.floor(Date.now() / 1000);
      endTime = Math.min(endTime, now);
      
      // If the entire range is in the future, return empty
      if (startTime > now) {
        return { candles: [], gaps: [] };
      }
      
      const chunks = await this.getChunksForTimeRange(symbol, granularity, startTime, endTime);
      
      if (chunks.length === 0) {
        return {
          candles: [],
          gaps: [{ start: startTime, end: endTime }]
        };
      }
      
      // Merge all candles from chunks
      const allCandles: CandleData[] = [];
      const candleMap = new Map<number, CandleData>();
      
      for (const chunk of chunks) {
        for (const candle of chunk.candles) {
          if (candle.time >= startTime && candle.time <= endTime) {
            candleMap.set(candle.time, candle);
          }
        }
      }
      
      // Convert to sorted array
      const candles = Array.from(candleMap.values()).sort((a, b) => a.time - b.time);
      
      // Find gaps
      const gaps = this.findGaps(candles, startTime, endTime, granularity);
      
      return { candles, gaps };
    } catch (error) {
      console.error('Error getting cached candles:', error);
      return { candles: [], gaps: [{ start: startTime, end: endTime }] };
    }
  }

  // Find gaps in candle data
  private findGaps(
    candles: CandleData[],
    startTime: number,
    endTime: number,
    granularity: string
  ): Array<{ start: number; end: number }> {
    const gaps: Array<{ start: number; end: number }> = [];
    const granularitySeconds = this.getGranularitySeconds(granularity);
    
    // Don't identify gaps in the future
    const now = Math.floor(Date.now() / 1000);
    endTime = Math.min(endTime, now);
    
    // If the entire range is in the future, return no gaps
    if (startTime > now) {
      return [];
    }
    
    // Cap startTime to now as well
    startTime = Math.min(startTime, now);
    
    if (candles.length === 0) {
      return [{ start: startTime, end: endTime }];
    }
    
    // For large granularities (1D), merge consecutive gaps to reduce API calls
    const shouldMergeGaps = granularitySeconds >= 86400; // 1 day or more
    const maxGapSize = 300 * granularitySeconds; // Max 300 candles per API request
    
    // Helper function to add or merge gaps
    const addGap = (gapStart: number, gapEnd: number) => {
      if (shouldMergeGaps && gaps.length > 0) {
        const lastGap = gaps[gaps.length - 1];
        // If this gap is consecutive with the last one and combined size is reasonable
        const isConsecutive = gapStart - lastGap.end <= granularitySeconds * 2;
        const combinedSize = gapEnd - lastGap.start;
        
        if (isConsecutive && combinedSize <= maxGapSize) {
          // Merge with the last gap
          lastGap.end = gapEnd;
          return;
        }
      }
      gaps.push({ start: gapStart, end: gapEnd });
    };
    
    // Check gap at the beginning
    if (candles[0].time - startTime > granularitySeconds) {
      addGap(startTime, candles[0].time - granularitySeconds);
    }
    
    // Check gaps between candles
    for (let i = 1; i < candles.length; i++) {
      const expectedNext = candles[i - 1].time + granularitySeconds;
      if (candles[i].time - expectedNext > granularitySeconds) {
        addGap(expectedNext, candles[i].time - granularitySeconds);
      }
    }
    
    // Check gap at the end
    const lastCandle = candles[candles.length - 1];
    if (endTime - lastCandle.time > granularitySeconds) {
      addGap(lastCandle.time + granularitySeconds, endTime);
    }
    
    // Log gap optimization for debugging
    if (shouldMergeGaps) {
      console.log(`[GAP DETECTION] ${granularity} gaps:`, {
        totalGaps: gaps.length,
        shouldMerge: shouldMergeGaps,
        gaps: gaps.map(g => ({
          start: new Date(g.start * 1000).toISOString(),
          end: new Date(g.end * 1000).toISOString(),
          days: Math.round((g.end - g.start) / 86400)
        }))
      });
    }
    
    return gaps;
  }

  // Get metadata for a symbol
  async getMetadata(symbol: string): Promise<DataMetadata | null> {
    try {
      const db = await this.ensureDB();
      const transaction = db.transaction([METADATA_STORE], 'readonly');
      const store = transaction.objectStore(METADATA_STORE);
      
      return new Promise((resolve) => {
        const request = store.get(symbol);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => resolve(null);
      });
    } catch (error) {
      console.error('Error getting metadata:', error);
      return null;
    }
  }

  // Update latest candle
  async updateLatestCandle(symbol: string, granularity: string, candle: CandleData): Promise<void> {
    await this.storeChunk(symbol, granularity, [candle]);
  }

  // Set cached candles (for backward compatibility)
  async setCachedCandles(symbol: string, granularity: string, candles: CandleData[]): Promise<void> {
    await this.storeChunk(symbol, granularity, candles);
  }

  // Clear all data
  async clearAll(): Promise<void> {
    try {
      const db = await this.ensureDB();
      const transaction = db.transaction([CHUNKS_STORE, METADATA_STORE], 'readwrite');
      
      await transaction.objectStore(CHUNKS_STORE).clear();
      await transaction.objectStore(METADATA_STORE).clear();
      
      console.log('All cache data cleared');
    } catch (error) {
      console.error('Error clearing cache:', error);
    }
  }

  // Get database for direct access
  async getDB(): Promise<IDBDatabase> {
    return this.ensureDB();
  }
  
  // Delete entire database - nuclear option for corrupted data
  async deleteDatabase(): Promise<void> {
    try {
      // First close existing connection
      if (this.db) {
        this.db.close();
        this.db = null;
      }
      
      // Delete the database
      const deleteReq = indexedDB.deleteDatabase(DB_NAME);
      
      await new Promise<void>((resolve, reject) => {
        deleteReq.onsuccess = () => {
          console.log(`Database ${DB_NAME} deleted successfully`);
          resolve();
        };
        
        deleteReq.onerror = () => {
          console.error('Failed to delete database:', deleteReq.error);
          reject(deleteReq.error);
        };
        
        deleteReq.onblocked = () => {
          console.warn('Database deletion blocked - close all other tabs using this app');
          // Still resolve after a timeout
          setTimeout(resolve, 1000);
        };
      });
      
      // Reinitialize the database
      this.dbPromise = this.initDB();
      await this.dbPromise;
      
      console.log('Database recreated successfully');
    } catch (error) {
      console.error('Error deleting database:', error);
      throw error;
    }
  }
  
  // Prune old data to prevent excessive storage
  private async pruneOldData(
    symbol: string,
    granularity: string,
    transaction: IDBTransaction
  ): Promise<void> {
    const maxCandles = this.MAX_CANDLES_PER_GRANULARITY[granularity] || 
                      this.MAX_CANDLES_PER_GRANULARITY['1d'];
    
    if (!maxCandles) return;
    
    const store = transaction.objectStore(CHUNKS_STORE);
    const index = store.index('symbol-granularity');
    const range = IDBKeyRange.only([symbol, granularity]);
    
    // Get all chunks for this symbol/granularity
    const chunks: DataChunk[] = [];
    const request = index.openCursor(range);
    
    await new Promise<void>((resolve, reject) => {
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          chunks.push(cursor.value);
          cursor.continue();
        } else {
          resolve();
        }
      };
      request.onerror = () => reject(request.error);
    });
    
    // Count total candles
    const totalCandles = chunks.reduce((sum, chunk) => sum + chunk.candles.length, 0);
    
    // Log current state
    // console.log(`Pruning check for ${symbol} ${granularity}: ${totalCandles} candles, limit: ${maxCandles}`);
    
    if (totalCandles <= maxCandles) {
      return; // No pruning needed
    }
    
    // console.warn(`PRUNING REQUIRED: ${totalCandles} candles exceeds limit of ${maxCandles} for ${symbol} ${granularity}`);
    
    // Sort chunks by start time (oldest first)
    chunks.sort((a, b) => a.startTime - b.startTime);
    
    // Remove oldest chunks until we're well under the limit (80% to avoid frequent pruning)
    const targetCandles = Math.floor(maxCandles * 0.8);
    let candlesToRemove = totalCandles - targetCandles;
    let chunksRemoved = 0;
    let candlesRemoved = 0;
    
    for (const chunk of chunks) {
      if (candlesToRemove <= 0) break;
      
      if (chunk.candles.length <= candlesToRemove) {
        // Remove entire chunk
        await store.delete(chunk.chunkId);
        candlesToRemove -= chunk.candles.length;
        candlesRemoved += chunk.candles.length;
        chunksRemoved++;
        // console.log(`Pruned entire chunk ${chunk.chunkId} with ${chunk.candles.length} candles`);
      } else {
        // Partially remove candles from this chunk
        const keepCount = chunk.candles.length - candlesToRemove;
        const removedCount = candlesToRemove;
        chunk.candles = chunk.candles.slice(-keepCount); // Keep the most recent
        chunk.startTime = chunk.candles[0].time;
        await store.put(chunk);
        candlesRemoved += removedCount;
        // console.log(`Pruned ${removedCount} candles from chunk ${chunk.chunkId}`);
        candlesToRemove = 0;
      }
    }
    
    // console.log(`Pruning complete: removed ${candlesRemoved} candles from ${chunksRemoved} chunks`);
  }

  // Get all cache entries (for compatibility)
  async getAllCacheEntries(symbol: string, granularity: string): Promise<any[]> {
    const chunks = await this.getChunksForTimeRange(
      symbol,
      granularity,
      0,
      Math.floor(Date.now() / 1000)
    );
    
    return chunks.map(chunk => ({
      symbol: chunk.symbol,
      granularity: chunk.granularity,
      candles: chunk.candles,
      metadata: {
        ttl: chunk.isComplete ? this.TTL_OLD : this.TTL_RECENT,
        lastModified: chunk.lastUpdated
      }
    }));
  }

  // Get cache stats (for compatibility)
  async getCacheStats(): Promise<{ size: number; count: number }> {
    try {
      const db = await this.ensureDB();
      const transaction = db.transaction([CHUNKS_STORE], 'readonly');
      const store = transaction.objectStore(CHUNKS_STORE);
      
      return new Promise((resolve) => {
        const countRequest = store.count();
        countRequest.onsuccess = () => {
          resolve({
            size: 1000000, // Approximate 1MB
            count: countRequest.result
          });
        };
        countRequest.onerror = () => resolve({ size: 0, count: 0 });
      });
    } catch (error) {
      return { size: 0, count: 0 };
    }
  }
  
  // Run diagnostic checks on the database
  async runDiagnostics(): Promise<{
    totalChunks: number;
    totalCandles: number;
    candlesByGranularity: Map<string, number>;
    issues: string[];
    metadata: DataMetadata | null;
  }> {
    const issues: string[] = [];
    const candlesByGranularity = new Map<string, number>();
    let totalChunks = 0;
    let totalCandles = 0;
    
    try {
      const db = await this.ensureDB();
      const transaction = db.transaction([CHUNKS_STORE, METADATA_STORE], 'readonly');
      const chunksStore = transaction.objectStore(CHUNKS_STORE);
      const metadataStore = transaction.objectStore(METADATA_STORE);
      
      // Get metadata
      const metadata = await new Promise<DataMetadata | null>((resolve) => {
        const request = metadataStore.get('BTC-USD');
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => resolve(null);
      });
      
      // Scan all chunks
      const allChunks: DataChunk[] = [];
      await new Promise<void>((resolve, reject) => {
        const request = chunksStore.openCursor();
        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest).result;
          if (cursor) {
            const chunk = cursor.value as DataChunk;
            allChunks.push(chunk);
            cursor.continue();
          } else {
            resolve();
          }
        };
        request.onerror = () => reject(request.error);
      });
      
      // Analyze chunks
      for (const chunk of allChunks) {
        totalChunks++;
        totalCandles += chunk.candles.length;
        
        const existing = candlesByGranularity.get(chunk.granularity) || 0;
        candlesByGranularity.set(chunk.granularity, existing + chunk.candles.length);
        
        // Check for issues
        if (chunk.candles.length > this.getMaxCandlesPerChunk(chunk.granularity)) {
          issues.push(`Chunk ${chunk.chunkId} has ${chunk.candles.length} candles, exceeding limit`);
        }
        
        // Check for time consistency
        if (chunk.candles.length > 0) {
          const firstTime = chunk.candles[0].time;
          const lastTime = chunk.candles[chunk.candles.length - 1].time;
          if (firstTime < chunk.startTime || lastTime > chunk.endTime) {
            issues.push(`Chunk ${chunk.chunkId} has candles outside its time boundaries`);
          }
        }
      }
      
      // Check against limits
      for (const [gran, count] of candlesByGranularity) {
        const limit = this.MAX_CANDLES_PER_GRANULARITY[gran];
        if (limit && count > limit) {
          issues.push(`Granularity ${gran} has ${count} candles, exceeding limit of ${limit}`);
        }
      }
      
      // Check metadata consistency
      if (metadata) {
        const metadataTotal = metadata.totalCandles;
        if (metadataTotal > totalCandles * 2) {
          issues.push(`Metadata shows ${metadataTotal} total candles but only ${totalCandles} found in chunks`);
        }
      }
      
      // Log results
      console.log('Database Diagnostics:', {
        totalChunks,
        totalCandles,
        candlesByGranularity: Object.fromEntries(candlesByGranularity),
        issueCount: issues.length,
        metadata: metadata ? {
          totalCandles: metadata.totalCandles,
          granularities: Object.keys(metadata.granularityRanges)
        } : null
      });
      
      if (issues.length > 0) {
        console.warn('Database issues found:', issues);
      }
      
      return {
        totalChunks,
        totalCandles,
        candlesByGranularity,
        issues,
        metadata
      };
      
    } catch (error) {
      console.error('Error running diagnostics:', error);
      issues.push(`Diagnostic error: ${error}`);
      return {
        totalChunks: 0,
        totalCandles: 0,
        candlesByGranularity,
        issues,
        metadata: null
      };
    }
  }
}

export const indexedDBCache = new IndexedDBCache();