import type { CandleData } from '../../../types/coinbase';
import { IndexedDBCache } from '../../cache/indexedDB';

export class CacheDataSource {
  private cache: IndexedDBCache;
  private initialized = false;

  constructor() {
    this.cache = IndexedDBCache.getInstance();
  }

  public async initialize(): Promise<void> {
    if (this.initialized) return;
    
    try {
      await this.cache.initialize();
      this.initialized = true;
      console.log('✅ CacheDataSource initialized');
    } catch (error) {
      console.error('Error initializing CacheDataSource:', error);
      throw error;
    }
  }

  public async getData(
    symbol: string,
    granularity: string,
    startTime: number,
    endTime: number
  ): Promise<CandleData[] | null> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      console.log(`💾 Checking cache for: ${symbol} ${granularity} from ${new Date(startTime * 1000).toISOString()}`);
      
      const cachedData = await this.cache.getCandles(symbol, granularity, startTime, endTime);
      
      if (cachedData && cachedData.length > 0) {
        console.log(`✅ Found ${cachedData.length} cached candles for ${symbol} ${granularity}`);
        return cachedData;
      }
      
      console.log(`ℹ️ No cached data found for ${symbol} ${granularity}`);
      return null;
      
    } catch (error) {
      console.error('Error getting cached data:', error);
      return null;
    }
  }

  public async storeData(
    symbol: string,
    granularity: string,
    data: CandleData[]
  ): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      if (data && data.length > 0) {
        await this.cache.storeCandles(symbol, granularity, data);
        console.log(`💾 Cached ${data.length} candles for ${symbol} ${granularity}`);
      }
    } catch (error) {
      console.error('Error storing data to cache:', error);
      // Don't throw - caching failures shouldn't break the app
    }
  }

  public async getDataRange(
    symbol: string,
    granularity: string
  ): Promise<{ start: number; end: number } | null> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      return await this.cache.getDataRange(symbol, granularity);
    } catch (error) {
      console.error('Error getting data range from cache:', error);
      return null;
    }
  }

  public async checkDataCoverage(
    symbol: string,
    granularity: string,
    startTime: number,
    endTime: number
  ): Promise<{ 
    covered: boolean; 
    gaps: Array<{ start: number; end: number }>;
    cachedRanges: Array<{ start: number; end: number }>;
  }> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const dataRange = await this.getDataRange(symbol, granularity);
      
      if (!dataRange) {
        return {
          covered: false,
          gaps: [{ start: startTime, end: endTime }],
          cachedRanges: []
        };
      }
      
      // Check if requested range is fully covered
      const fullyCovered = dataRange.start <= startTime && dataRange.end >= endTime;
      
      if (fullyCovered) {
        return {
          covered: true,
          gaps: [],
          cachedRanges: [dataRange]
        };
      }
      
      // Calculate gaps
      const gaps: Array<{ start: number; end: number }> = [];
      
      if (startTime < dataRange.start) {
        gaps.push({ start: startTime, end: Math.min(dataRange.start, endTime) });
      }
      
      if (endTime > dataRange.end) {
        gaps.push({ start: Math.max(dataRange.end, startTime), end: endTime });
      }
      
      return {
        covered: gaps.length === 0,
        gaps,
        cachedRanges: [dataRange]
      };
      
    } catch (error) {
      console.error('Error checking data coverage:', error);
      return {
        covered: false,
        gaps: [{ start: startTime, end: endTime }],
        cachedRanges: []
      };
    }
  }

  public async invalidateData(
    symbol?: string,
    granularity?: string,
    startTime?: number,
    endTime?: number
  ): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      if (symbol && granularity) {
        if (startTime !== undefined && endTime !== undefined) {
          // Invalidate specific range
          await this.cache.deleteCandles(symbol, granularity, startTime, endTime);
          console.log(`🗑️ Invalidated cache for ${symbol} ${granularity} range`);
        } else {
          // Invalidate all data for symbol/granularity
          await this.cache.clearSymbolGranularity(symbol, granularity);
          console.log(`🗑️ Invalidated all cache for ${symbol} ${granularity}`);
        }
      } else {
        // Clear all cache
        await this.cache.clear();
        console.log('🗑️ Cleared all cached data');
      }
    } catch (error) {
      console.error('Error invalidating cache:', error);
    }
  }

  public async getCacheStats(): Promise<{
    totalSize: number;
    symbolCount: number;
    oldestData: number;
    newestData: number;
  }> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      return await this.cache.getStats();
    } catch (error) {
      console.error('Error getting cache stats:', error);
      return {
        totalSize: 0,
        symbolCount: 0,
        oldestData: 0,
        newestData: 0
      };
    }
  }

  public async optimizeCache(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      await this.cache.optimize();
      console.log('✅ Cache optimization complete');
    } catch (error) {
      console.error('Error optimizing cache:', error);
    }
  }

  public isInitialized(): boolean {
    return this.initialized;
  }
}