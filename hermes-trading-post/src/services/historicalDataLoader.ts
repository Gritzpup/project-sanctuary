import pLimit from 'p-limit';
import { getIndexedDBCache } from './indexedDBCache';
import { CoinbaseAPI } from './coinbaseApi';
import type { CandleData } from '../types/coinbase';

interface LoadConfig {
  granularity: number;
  days: number;
  priority: number;
}

export class HistoricalDataLoader {
  private api: CoinbaseAPI;
  private cache = getIndexedDBCache();
  private isLoading = false;
  private loadInterval: number | null = null;
  private updateInterval: number | null = null;
  
  // Concurrent request limiter (3 requests at a time to avoid rate limits)
  private limit = pLimit(3);
  
  // Loading configuration for different granularities
  private readonly loadConfigs: LoadConfig[] = [
    { granularity: 60, days: 7, priority: 1 },      // 1m - last week
    { granularity: 300, days: 30, priority: 2 },    // 5m - last month
    { granularity: 900, days: 90, priority: 3 },    // 15m - last 3 months
    { granularity: 3600, days: 365, priority: 4 },  // 1h - last year
    { granularity: 21600, days: 730, priority: 5 }, // 6h - last 2 years
    { granularity: 86400, days: 1825, priority: 6 } // 1D - last 5 years
  ];

  constructor() {
    this.api = new CoinbaseAPI();
  }

  // Start the background loader
  async start(): Promise<void> {
    console.log('Starting historical data loader...');
    
    // Initial load
    await this.loadAllHistoricalData();
    
    // Update latest candles every minute
    this.updateInterval = window.setInterval(() => {
      this.updateLatestCandles();
    }, 60000);
    
    // Reload historical data every hour to fill any gaps
    this.loadInterval = window.setInterval(() => {
      this.loadAllHistoricalData();
    }, 3600000);
    
    // Clean expired cache entries every 30 minutes
    window.setInterval(() => {
      this.cache.cleanExpired();
    }, 1800000);
  }

  // Stop the background loader
  stop(): void {
    if (this.loadInterval) {
      window.clearInterval(this.loadInterval);
      this.loadInterval = null;
    }
    
    if (this.updateInterval) {
      window.clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  // Load all historical data based on priority
  async loadAllHistoricalData(): Promise<void> {
    if (this.isLoading) {
      console.log('Historical data load already in progress, skipping...');
      return;
    }
    
    this.isLoading = true;
    console.log('Loading all historical data...');
    
    try {
      // Sort by priority and load
      const sortedConfigs = [...this.loadConfigs].sort((a, b) => a.priority - b.priority);
      
      for (const config of sortedConfigs) {
        await this.loadHistoricalDataForGranularity(config);
        
        // Small delay between granularities
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      console.log('Historical data load complete!');
    } catch (error) {
      console.error('Error loading historical data:', error);
    } finally {
      this.isLoading = false;
    }
  }

  // Load historical data for a specific granularity
  private async loadHistoricalDataForGranularity(config: LoadConfig): Promise<void> {
    console.log(`Loading ${config.days} days of ${config.granularity}s data...`);
    
    const endTime = new Date();
    const batchSize = 300; // Coinbase limit
    const totalSeconds = config.days * 24 * 60 * 60;
    const totalCandles = Math.ceil(totalSeconds / config.granularity);
    const batches = Math.ceil(totalCandles / batchSize);
    
    // Check what we already have in cache
    const startTime = new Date(endTime.getTime() - totalSeconds * 1000);
    const cachedCandles = await this.cache.getCachedCandles(
      config.granularity,
      Math.floor(startTime.getTime() / 1000),
      Math.floor(endTime.getTime() / 1000)
    );
    
    console.log(`Found ${cachedCandles.length} cached candles for ${config.granularity}s`);
    
    // Find gaps in the data
    const gaps = this.findDataGaps(cachedCandles, config.granularity, startTime, endTime);
    
    if (gaps.length === 0) {
      console.log(`No gaps found for ${config.granularity}s data`);
      return;
    }
    
    console.log(`Found ${gaps.length} gaps to fill for ${config.granularity}s`);
    
    // Load data for each gap with concurrency limit
    const loadPromises = gaps.map(gap => 
      this.limit(() => this.loadDataForGap(config.granularity, gap.start, gap.end))
    );
    
    await Promise.all(loadPromises);
    console.log(`Completed loading ${config.granularity}s data`);
  }

  // Find gaps in cached data
  private findDataGaps(
    candles: CandleData[], 
    granularity: number, 
    startTime: Date, 
    endTime: Date
  ): Array<{start: Date, end: Date}> {
    const gaps: Array<{start: Date, end: Date}> = [];
    
    if (candles.length === 0) {
      // No data at all
      gaps.push({ start: startTime, end: endTime });
      return gaps;
    }
    
    // Sort candles by time
    const sorted = [...candles].sort((a, b) => a.time - b.time);
    
    // Check for gap at the beginning
    if (sorted[0].time > Math.floor(startTime.getTime() / 1000) + granularity) {
      gaps.push({
        start: startTime,
        end: new Date(sorted[0].time * 1000 - granularity * 1000)
      });
    }
    
    // Check for gaps in the middle
    for (let i = 0; i < sorted.length - 1; i++) {
      const expectedNext = sorted[i].time + granularity;
      const actualNext = sorted[i + 1].time;
      
      // Allow for some wiggle room (5% of granularity)
      if (actualNext > expectedNext * 1.05) {
        gaps.push({
          start: new Date(expectedNext * 1000),
          end: new Date((actualNext - granularity) * 1000)
        });
      }
    }
    
    // Check for gap at the end
    const lastCandle = sorted[sorted.length - 1];
    if (lastCandle.time < Math.floor(endTime.getTime() / 1000) - granularity) {
      gaps.push({
        start: new Date((lastCandle.time + granularity) * 1000),
        end: endTime
      });
    }
    
    // Limit gaps to reasonable sizes (max 300 candles per gap)
    const splitGaps: Array<{start: Date, end: Date}> = [];
    
    for (const gap of gaps) {
      const gapSeconds = (gap.end.getTime() - gap.start.getTime()) / 1000;
      const gapCandles = Math.ceil(gapSeconds / granularity);
      
      if (gapCandles <= 300) {
        splitGaps.push(gap);
      } else {
        // Split large gaps
        const numSplits = Math.ceil(gapCandles / 300);
        const splitSize = gapSeconds / numSplits;
        
        for (let i = 0; i < numSplits; i++) {
          splitGaps.push({
            start: new Date(gap.start.getTime() + i * splitSize * 1000),
            end: new Date(Math.min(
              gap.start.getTime() + (i + 1) * splitSize * 1000,
              gap.end.getTime()
            ))
          });
        }
      }
    }
    
    return splitGaps;
  }

  // Load data for a specific gap
  private async loadDataForGap(granularity: number, start: Date, end: Date): Promise<void> {
    try {
      console.log(`Loading gap: ${start.toISOString()} to ${end.toISOString()} (${granularity}s)`);
      
      const candles = await this.api.getCandles(
        'BTC-USD',
        granularity,
        start.toISOString(),
        end.toISOString()
      );
      
      if (candles.length > 0) {
        await this.cache.setCachedCandles(granularity, candles);
        console.log(`Cached ${candles.length} candles for ${granularity}s`);
      }
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));
    } catch (error) {
      console.error(`Error loading gap for ${granularity}s:`, error);
      // Don't throw - continue with other gaps
    }
  }

  // Update latest candles for all granularities
  private async updateLatestCandles(): Promise<void> {
    console.log('Updating latest candles...');
    
    const updatePromises = this.loadConfigs.map(config =>
      this.limit(async () => {
        try {
          // Get the last few candles
          const candles = await this.api.getCandles(
            'BTC-USD',
            config.granularity
          );
          
          if (candles.length > 0) {
            // Update cache with latest candles
            await this.cache.setCachedCandles(config.granularity, candles.slice(-10));
            
            // Update the latest candle marker
            const latest = candles[candles.length - 1];
            await this.cache.updateLatestCandle(config.granularity, latest);
          }
        } catch (error) {
          console.error(`Error updating latest candles for ${config.granularity}s:`, error);
        }
      })
    );
    
    await Promise.all(updatePromises);
    console.log('Latest candles updated');
  }

  // Get loading status
  getStatus(): { isLoading: boolean; cacheAvailable: boolean } {
    return {
      isLoading: this.isLoading,
      cacheAvailable: this.cache.isAvailable()
    };
  }
}

// Singleton instance
let loaderInstance: HistoricalDataLoader | null = null;

export function getHistoricalDataLoader(): HistoricalDataLoader {
  if (!loaderInstance) {
    loaderInstance = new HistoricalDataLoader();
  }
  return loaderInstance;
}