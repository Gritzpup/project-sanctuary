import pLimit from 'p-limit';
import { IndexedDBCache } from './indexedDBCache';
import { CoinbaseAPI } from './coinbaseApi';
import type { CandleData } from '../types/coinbase';

interface LoadTask {
  symbol: string;
  granularity: string;
  startTime: number;
  endTime: number;
  priority: number;
}

export class HistoricalDataLoader {
  private api: CoinbaseAPI;
  private cache: IndexedDBCache;
  private isLoading = false;
  private loadInterval: number | null = null;
  private currentTasks: Set<string> = new Set();
  
  // Concurrent request limiter (3 requests at a time to avoid rate limits)
  private limit = pLimit(3);
  
  // Progressive loading configuration
  private readonly loadStrategy = {
    '1m': { initialDays: 1, maxDays: 7, chunkDays: 1 },
    '5m': { initialDays: 7, maxDays: 30, chunkDays: 7 },
    '15m': { initialDays: 30, maxDays: 90, chunkDays: 30 },
    '1h': { initialDays: 3, maxDays: 365, chunkDays: 30 },
    '6h': { initialDays: 180, maxDays: 730, chunkDays: 90 },
    '1d': { initialDays: 365, maxDays: 7300, chunkDays: 180 } // 20 years
  };

  constructor(api: CoinbaseAPI, cache: IndexedDBCache) {
    this.api = api;
    this.cache = cache;
  }

  // Start progressive loading for a symbol
  async startProgressiveLoad(symbol: string): Promise<void> {
    if (this.isLoading) {
      console.log('Progressive load already in progress');
      return;
    }
    
    this.isLoading = true;
    console.log(`Starting progressive historical data load for ${symbol}`);
    
    try {
      // Load initial data for all granularities
      await this.loadInitialData(symbol);
      
      // Start background progressive loading
      this.startBackgroundLoading(symbol);
      
    } catch (error) {
      console.error('Error in progressive load:', error);
      this.isLoading = false;
    }
  }

  // Load initial recent data for quick chart display
  private async loadInitialData(symbol: string): Promise<void> {
    console.log('Loading initial data for quick display...');
    
    const tasks: LoadTask[] = [];
    const now = Math.floor(Date.now() / 1000);
    
    // Create initial load tasks
    for (const [granularity, config] of Object.entries(this.loadStrategy)) {
      const startTime = now - (config.initialDays * 86400);
      tasks.push({
        symbol,
        granularity,
        startTime,
        endTime: now,
        priority: this.getGranularityPriority(granularity)
      });
    }
    
    // Sort by priority (smaller granularities first)
    tasks.sort((a, b) => a.priority - b.priority);
    
    // Execute initial loads with concurrency limit
    await Promise.all(
      tasks.map(task => this.limit(() => this.loadChunk(task)))
    );
    
    console.log('Initial data load complete');
  }

  // Start background loading of historical data
  private startBackgroundLoading(symbol: string): void {
    console.log('Starting background historical loading...');
    
    // Load historical data progressively
    this.loadHistoricalDataProgressively(symbol);
    
    // Reload every hour to fill gaps
    this.loadInterval = window.setInterval(() => {
      this.loadHistoricalDataProgressively(symbol);
    }, 3600000);
  }

  // Load historical data progressively, going back in time
  private async loadHistoricalDataProgressively(symbol: string): Promise<void> {
    const metadata = await this.cache.getMetadata(symbol);
    const now = Math.floor(Date.now() / 1000);
    
    for (const [granularity, config] of Object.entries(this.loadStrategy)) {
      // Check how far back we have data
      const granularityData = metadata?.granularityRanges[granularity];
      const earliestData = granularityData?.startTime || now;
      const daysCovered = (now - earliestData) / 86400;
      
      // If we haven't reached max days, load more
      if (daysCovered < config.maxDays) {
        const tasks: LoadTask[] = [];
        
        // Calculate chunks to load
        let currentEnd = earliestData;
        const targetStart = now - (config.maxDays * 86400);
        
        while (currentEnd > targetStart) {
          const chunkStart = Math.max(currentEnd - (config.chunkDays * 86400), targetStart);
          
          tasks.push({
            symbol,
            granularity,
            startTime: chunkStart,
            endTime: currentEnd,
            priority: this.getGranularityPriority(granularity) + (now - currentEnd) / 86400
          });
          
          currentEnd = chunkStart;
        }
        
        // Execute loads with concurrency limit
        console.log(`Loading ${tasks.length} chunks for ${granularity}`);
        await Promise.all(
          tasks.map(task => this.limit(() => this.loadChunk(task)))
        );
      }
    }
  }

  // Load a specific chunk of data
  private async loadChunk(task: LoadTask): Promise<void> {
    const taskKey = `${task.symbol}-${task.granularity}-${task.startTime}-${task.endTime}`;
    
    // Skip if already loading
    if (this.currentTasks.has(taskKey)) {
      return;
    }
    
    this.currentTasks.add(taskKey);
    
    try {
      // Check if we already have this data
      const cached = await this.cache.getCachedCandles(
        task.symbol,
        task.granularity,
        task.startTime,
        task.endTime
      );
      
      // Only fetch if we have gaps
      if (cached.gaps.length > 0) {
        console.log(`Loading ${task.granularity} data from ${new Date(task.startTime * 1000).toISOString()} to ${new Date(task.endTime * 1000).toISOString()}`);
        
        // Fetch data for each gap
        for (const gap of cached.gaps) {
          await this.fetchAndStoreGap(task.symbol, task.granularity, gap);
        }
      }
    } catch (error) {
      console.error(`Error loading chunk ${taskKey}:`, error);
    } finally {
      this.currentTasks.delete(taskKey);
    }
  }

  // Fetch data for a gap and store it
  private async fetchAndStoreGap(
    symbol: string,
    granularity: string,
    gap: { start: number; end: number }
  ): Promise<void> {
    try {
      const granularitySeconds = this.getGranularitySeconds(granularity);
      
      // Coinbase has a max of 300 candles per request
      const maxCandles = 300;
      const maxTimeSpan = maxCandles * granularitySeconds;
      
      let currentStart = gap.start;
      
      while (currentStart < gap.end) {
        const currentEnd = Math.min(currentStart + maxTimeSpan, gap.end);
        
        const candles = await this.api.getCandles(
          symbol,
          granularitySeconds,
          currentStart.toString(),
          currentEnd.toString()
        );
        
        if (candles.length > 0) {
          await this.cache.storeChunk(symbol, granularity, candles);
          console.log(`Stored ${candles.length} ${granularity} candles`);
        }
        
        currentStart = currentEnd;
        
        // Small delay to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } catch (error) {
      console.error(`Error fetching gap data:`, error);
    }
  }

  // Update latest candles for all granularities
  async updateLatestCandles(symbol: string): Promise<void> {
    console.log('Updating latest candles...');
    
    const updates = Object.keys(this.loadStrategy).map(async (granularity) => {
      try {
        const candles = await this.api.getCandles(
          symbol,
          this.getGranularitySeconds(granularity)
        );
        
        if (candles.length > 0) {
          await this.cache.storeChunk(symbol, granularity, candles);
        }
      } catch (error) {
        console.error(`Error updating ${granularity} candles:`, error);
      }
    });
    
    await Promise.all(updates);
  }

  // Get granularity priority (lower number = higher priority)
  private getGranularityPriority(granularity: string): number {
    const priorities: { [key: string]: number } = {
      '1m': 1,
      '5m': 2,
      '15m': 3,
      '1h': 4,
      '6h': 5,
      '1d': 6
    };
    return priorities[granularity] || 10;
  }

  // Get granularity in seconds
  private getGranularitySeconds(granularity: string): number {
    const map: { [key: string]: number } = {
      '1m': 60,
      '5m': 300,
      '15m': 900,
      '1h': 3600,
      '6h': 21600,
      '1d': 86400
    };
    return map[granularity] || 60;
  }

  // Stop the loader
  stop(): void {
    if (this.loadInterval) {
      window.clearInterval(this.loadInterval);
      this.loadInterval = null;
    }
    this.isLoading = false;
    this.currentTasks.clear();
  }
}

// Singleton instance
let instance: HistoricalDataLoader | null = null;

export function getHistoricalDataLoader(): HistoricalDataLoader {
  if (!instance) {
    throw new Error('HistoricalDataLoader not initialized');
  }
  return instance;
}

// This is now called from chartDataFeed
export function initHistoricalDataLoader(api: CoinbaseAPI, cache: IndexedDBCache): HistoricalDataLoader {
  if (!instance) {
    instance = new HistoricalDataLoader(api, cache);
  }
  return instance;
}