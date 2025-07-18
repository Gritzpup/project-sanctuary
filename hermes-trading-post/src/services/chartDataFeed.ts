import type { CandleData } from '../types/coinbase';
import { CoinbaseAPI } from './coinbaseApi';
import { IndexedDBCache } from './indexedDBCache';
import { HistoricalDataLoader } from './historicalDataLoader';
import { realtimeCandleAggregator } from './realtimeCandleAggregator';

interface DataRequest {
  symbol: string;
  granularity: string;
  startTime: number;
  endTime: number;
}

export class ChartDataFeed {
  private api: CoinbaseAPI;
  private cache: IndexedDBCache;
  private loader: HistoricalDataLoader;
  private subscribers: Map<string, (data: CandleData, isNew?: boolean) => void> = new Map();
  private realtimeUnsubscribe: (() => void) | null = null;
  
  // Current state
  private symbol = 'BTC-USD';
  private currentGranularity = '1m';
  private visibleRange: { start: number; end: number } | null = null;
  private currentData: CandleData[] = [];
  private autoUpdateRange = true; // Auto-scroll with new candles
  private maxCandles = 60; // Maximum candles to keep for 1m view
  
  // Loading state
  private loadingPromises = new Map<string, Promise<void>>();
  private wsConnected = false;
  
  // Multi-granularity state management
  private granularityChangeCallback: ((granularity: string) => void) | null = null;
  private granularityDebounceTimer: any = null;
  private pendingGranularity: string | null = null;
  private isTransitioning = false;
  private isManualMode = false;
  private manualModeTimer: any = null;
  
  // Preloaded data for smooth transitions
  private dataByGranularity: Map<string, CandleData[]> = new Map();
  private activeGranularity: string = '1m';
  private targetGranularity: string = '1m';
  
  // Smart granularity thresholds with overlap
  private granularityThresholds = [
    { granularity: '1m', minHours: 0, maxHours: 6, preloadNext: '5m' },
    { granularity: '5m', minHours: 2, maxHours: 48, preloadNext: '15m' },
    { granularity: '15m', minHours: 12, maxHours: 168, preloadNext: '1h' },
    { granularity: '1h', minHours: 48, maxHours: 720, preloadNext: '6h' },
    { granularity: '6h', minHours: 360, maxHours: 4380, preloadNext: '1D' },
    { granularity: '1D', minHours: 2160, maxHours: Infinity, preloadNext: null }
  ];

  constructor() {
    this.api = new CoinbaseAPI();
    this.cache = new IndexedDBCache();
    this.loader = new HistoricalDataLoader(this.api, this.cache);
    
    console.log(`ChartDataFeed: Initialized with granularity ${this.currentGranularity}`);
    
    // Setup WebSocket but don't start aggregation yet
    this.setupWebSocket();
    
    this.startBackgroundLoading();
  }

  private async startBackgroundLoading() {
    // Start loading historical data in the background
    
    // Only load minimal data on startup to avoid rate limits
    const priorityLoads = [
      { granularity: '1m', days: 0.042 },    // 1 hour of 1m data (60 candles) - covers 1H view exactly
      { granularity: '5m', days: 0.5 },     // 12 hours of 5m data (144 candles)
      { granularity: '1h', days: 2.5 },     // 2.5 days of 1h data (60 candles) - covers 1H view exactly
      { granularity: '1D', days: 90 }       // 90 days of daily data (90 candles) - covers 1M and 3M views
    ];
    
    // Load priority data sequentially to avoid rate limits
    const loadSequentially = async () => {
      for (const load of priorityLoads) {
        try {
          await this.loadHistoricalData(load.granularity, load.days);
          // Small delay between different granularities
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
          console.error(`Failed to load ${load.days} days of ${load.granularity} data:`, error);
        }
      }
      
      // Don't start progressive loader - only load on demand
      // this.loader.startProgressiveLoad(this.symbol);
      console.log('Priority data loading complete');
    };
    
    // Start loading in background (don't await)
    loadSequentially().catch(console.error);
  }

  private setupWebSocket() {
    // Use realtimeCandleAggregator for 1-minute candles
    this.realtimeUnsubscribe = realtimeCandleAggregator.subscribe(async (update) => {
      console.log(`ChartDataFeed: Received update from aggregator`, {
        symbol: update.symbol,
        currentGranularity: this.currentGranularity,
        isNewCandle: update.isNewCandle,
        time: new Date((update.candle.time as number) * 1000).toISOString()
      });
      
      // Always process updates for real-time price display
      if (update.symbol === this.symbol) {
        // Convert CandlestickData to CandleData
        const candleData: CandleData = {
          time: update.candle.time as number,
          open: update.candle.open,
          high: update.candle.high,
          low: update.candle.low,
          close: update.candle.close,
          volume: 0 // Real-time ticker doesn't provide volume
        };
        
        // For 1m granularity, handle new candles directly
        if (this.currentGranularity === '1m') {
          if (update.isNewCandle) {
            console.log(`ChartDataFeed: Received new 1m candle at ${new Date(candleData.time * 1000).toISOString()}`);
            // Add new candle to current data
            this.currentData.push(candleData);
            
            // Implement sliding window for 1m candles
            if (this.visibleRange) {
            // Calculate expected candles based on visible range
            const visibleMinutes = Math.floor((this.visibleRange.end - this.visibleRange.start) / 60);
            // Add buffer to keep some extra candles for smooth scrolling
            const buffer = 10; // Keep 10 extra candles
            const maxCandlesToKeep = Math.min(visibleMinutes + buffer, this.maxCandles);
            
            // Keep only the required number of most recent candles
            if (this.currentData.length > maxCandlesToKeep) {
              console.log(`Sliding window: removing ${this.currentData.length - maxCandlesToKeep} old candles`);
              this.currentData = this.currentData.slice(-maxCandlesToKeep);
            }
            
            // Don't auto-update range for now - let the chart handle scrolling
            // if (this.autoUpdateRange) {
            //   const latestTime = candleData.time;
            //   const rangeSeconds = this.visibleRange.end - this.visibleRange.start;
            //   this.visibleRange = {
            //     start: latestTime - rangeSeconds,
            //     end: latestTime
            //   };
            //   console.log(`Updated visible range: ${new Date(this.visibleRange.start * 1000).toISOString()} to ${new Date(this.visibleRange.end * 1000).toISOString()}`);
            // }
          }
          
          console.log(`ChartDataFeed: Total candles after sliding window: ${this.currentData.length}`);
          } else {
            // Update existing candle
            const lastIndex = this.currentData.length - 1;
            if (lastIndex >= 0 && this.currentData[lastIndex].time === candleData.time) {
              console.log(`ChartDataFeed: Updating existing 1m candle at index ${lastIndex}, time: ${new Date(candleData.time * 1000).toISOString()}`);
              this.currentData[lastIndex] = candleData;
            } else {
              console.log(`ChartDataFeed: Could not find 1m candle to update. Last candle time: ${lastIndex >= 0 ? new Date(this.currentData[lastIndex].time * 1000).toISOString() : 'none'}, update time: ${new Date(candleData.time * 1000).toISOString()}`);
            }
          }
          
          // Notify subscribers with the candle update
          console.log(`ChartDataFeed: Notifying ${this.subscribers.size} subscribers for 1m update`);
          this.subscribers.forEach(callback => {
            try {
              callback(candleData, update.isNewCandle);
            } catch (error) {
              console.error('ChartDataFeed: Error in subscriber callback:', error);
            }
          });
        } else {
          // For other granularities, update the current candle with real-time price
          const granularitySeconds = this.getGranularitySeconds(this.currentGranularity);
          const currentCandleTime = Math.floor(candleData.time / granularitySeconds) * granularitySeconds;
          
          // Find and update the current candle for this granularity
          const currentIndex = this.currentData.findIndex(c => c.time === currentCandleTime);
          if (currentIndex >= 0) {
            const currentCandle = this.currentData[currentIndex];
            // Update the current candle with new price data
            const updatedCandle = {
              ...currentCandle,
              high: Math.max(currentCandle.high, candleData.close),
              low: Math.min(currentCandle.low, candleData.close),
              close: candleData.close
            };
            
            console.log(`ChartDataFeed: Updating ${this.currentGranularity} candle at ${new Date(currentCandleTime * 1000).toISOString()} with price ${candleData.close}`);
            this.currentData[currentIndex] = updatedCandle;
            
            // Notify subscribers with the updated candle
            console.log(`ChartDataFeed: Notifying ${this.subscribers.size} subscribers for ${this.currentGranularity} update`);
            this.subscribers.forEach(callback => {
              try {
                callback(updatedCandle, false);
              } catch (error) {
                console.error('ChartDataFeed: Error in subscriber callback:', error);
              }
            });
          }
        }
      }
    });
    
    // WebSocket status is now managed through realtimeCandleAggregator
    this.wsConnected = true; // Always consider connected when using aggregator
  }

  // Removed updateRealtimeCandle - all real-time updates now come through realtimeCandleAggregator

  // Get optimal granularity for a time range
  getOptimalGranularity(visibleRangeSeconds: number): string {
    const hours = visibleRangeSeconds / 3600;
    
    if (hours < 4) return '1m';        // < 4 hours: 1-minute
    if (hours < 24) return '5m';       // < 1 day: 5-minute
    if (hours < 168) return '1h';      // < 1 week: 1-hour
    if (hours < 2160) return '6h';     // < 3 months: 6-hour
    return '1D';                       // > 3 months: daily
  }

  // Get data for visible range with smooth transitions
  async getDataForVisibleRange(startTime: number, endTime: number): Promise<CandleData[]> {
    
    this.visibleRange = { start: startTime, end: endTime };
    
    const rangeHours = (endTime - startTime) / 3600;
    
    // Skip auto-granularity if in manual mode
    if (!this.isManualMode) {
      // Find optimal granularity with hysteresis
      const newGranularity = this.getOptimalGranularityWithHysteresis(rangeHours, this.activeGranularity);
      
      // Debounce granularity changes
      if (newGranularity !== this.activeGranularity) {
        this.scheduleGranularityChange(newGranularity);
      }
    }
    
    // Return current data immediately (no jarring transitions)
    const data = await this.getCurrentDataForRange(startTime, endTime);
    return data;
  }
  
  // Get optimal granularity with hysteresis to prevent oscillation
  private getOptimalGranularityWithHysteresis(rangeHours: number, currentGranularity: string): string {
    const current = this.granularityThresholds.find(t => t.granularity === currentGranularity);
    
    if (!current) return this.getOptimalGranularity(rangeHours * 3600);
    
    // Stay with current if within overlapping zone
    if (rangeHours >= current.minHours && rangeHours <= current.maxHours) {
      return currentGranularity;
    }
    
    // Find new optimal granularity
    for (const threshold of this.granularityThresholds) {
      if (rangeHours >= threshold.minHours && rangeHours <= threshold.maxHours) {
        return threshold.granularity;
      }
    }
    
    return '1D'; // Fallback
  }
  
  // Schedule granularity change with debouncing
  private scheduleGranularityChange(newGranularity: string) {
    clearTimeout(this.granularityDebounceTimer);
    this.pendingGranularity = newGranularity;
    
    this.granularityDebounceTimer = setTimeout(() => {
      this.performSmoothTransition(this.pendingGranularity!);
    }, 300); // Wait 300ms for zoom to stabilize
  }
  
  // Perform smooth transition to new granularity
  private async performSmoothTransition(newGranularity: string) {
    if (this.isTransitioning || this.isManualMode) return;
    
    this.isTransitioning = true;
    this.targetGranularity = newGranularity;
    
    // Update active granularity
    this.activeGranularity = newGranularity;
    this.currentGranularity = newGranularity;
    
    // Notify UI of granularity change
    this.granularityChangeCallback?.(newGranularity);
    
    // Preload adjacent granularities in background
    this.preloadAdjacentGranularities(newGranularity);
    
    this.isTransitioning = false;
  }
  
  // Get current data for the visible range
  private async getCurrentDataForRange(startTime: number, endTime: number): Promise<CandleData[]> {
    
    // Validate time range
    const validatedRange = this.validateTimeRange(startTime, endTime);
    
    if (!validatedRange.isValid) {
      return [];
    }
    
    startTime = validatedRange.start;
    endTime = validatedRange.end;
    
    // For very long time ranges (1Y, 5Y), ensure we have the data loaded
    const rangeInDays = (endTime - startTime) / 86400;
    if (rangeInDays > 180 && this.activeGranularity === '1D') {
      await this.loadHistoricalData('1D', Math.ceil(rangeInDays));
    }
    
    // Get data from cache
    console.log(`Fetching data from cache: ${new Date(startTime * 1000).toISOString()} to ${new Date(endTime * 1000).toISOString()}, granularity: ${this.activeGranularity}`);
    
    const cacheResult = await this.cache.getCachedCandles(
      this.symbol,
      this.activeGranularity,
      startTime,
      endTime
    );
    
    // Fill gaps if any
    if (cacheResult.gaps.length > 0) {
      await this.fillGaps(cacheResult.gaps, this.activeGranularity);
      
      // Re-fetch from cache after filling gaps
      const updatedResult = await this.cache.getCachedCandles(
        this.symbol,
        this.activeGranularity,
        startTime,
        endTime
      );
      
      this.currentData = updatedResult.candles;
    } else {
      this.currentData = cacheResult.candles;
    }
    
    return this.currentData;
  }
  
  // Preload adjacent granularities for smooth transitions
  private async preloadAdjacentGranularities(currentGranularity: string) {
    const threshold = this.granularityThresholds.find(t => t.granularity === currentGranularity);
    
    if (!threshold?.preloadNext || !this.visibleRange) return;
    
    // Preload next coarser granularity in background
    setTimeout(() => {
      this.loadHistoricalData(threshold.preloadNext!, 7);
    }, 1000);
    
    // Also preload previous finer granularity
    const currentIndex = this.granularityThresholds.findIndex(t => t.granularity === currentGranularity);
    
    if (currentIndex > 0) {
      const prevGranularity = this.granularityThresholds[currentIndex - 1].granularity;
      setTimeout(() => {
        this.loadHistoricalData(prevGranularity, 7);
      }, 1500);
    }
  }

  // Fill gaps in data
  private async fillGaps(gaps: Array<{ start: number; end: number }>, granularity: string): Promise<void> {
    console.log(`[FILL GAPS] Received ${gaps.length} gaps for ${granularity}:`, {
      gaps: gaps.slice(0, 5).map(g => ({
        start: new Date(g.start * 1000).toISOString(),
        end: new Date(g.end * 1000).toISOString(),
        days: Math.round((g.end - g.start) / 86400)
      })),
      totalGaps: gaps.length,
      ...(gaps.length > 5 ? { note: `... and ${gaps.length - 5} more gaps` } : {})
    });
    
    // Filter out future gaps first
    const now = Math.floor(Date.now() / 1000);
    const validGaps = gaps.filter(gap => gap.start <= now && gap.end <= now);
    
    if (validGaps.length === 0) {
      console.log('All gaps are in the future, skipping');
      return;
    }
    
    // Log if we filtered out any gaps
    if (validGaps.length < gaps.length) {
      console.log(`Filtered out ${gaps.length - validGaps.length} future gaps`);
    }
    
    // For large numbers of gaps, process in batches to avoid overwhelming the API
    // With gap merging, we should have fewer gaps, so we can process more in parallel
    const batchSize = validGaps.length <= 3 ? validGaps.length : 10; // Process all if 3 or fewer, otherwise 10 at a time
    
    for (let i = 0; i < validGaps.length; i += batchSize) {
      const batch = validGaps.slice(i, i + batchSize);
      
      const fetchPromises = batch.map(async (gap) => {
        const key = `${gap.start}-${gap.end}-${granularity}`;
        
        // Check if we're already loading this gap
        if (this.loadingPromises.has(key)) {
          return this.loadingPromises.get(key);
        }
        
        const promise = this.fetchGapData(gap, granularity);
        this.loadingPromises.set(key, promise);
        
        try {
          await promise;
        } catch (error) {
          console.error(`Failed to fetch gap data:`, error);
        } finally {
          this.loadingPromises.delete(key);
        }
      });
      
      // Wait for this batch to complete before starting the next
      await Promise.all(fetchPromises);
      
      // Add a small delay between batches to be nice to the API
      if (i + batchSize < validGaps.length) {
        await new Promise(resolve => setTimeout(resolve, 200)); // Reduced delay since we have fewer gaps
      }
    }
  }

  private async fetchGapData(gap: { start: number; end: number }, granularity: string): Promise<void> {
    try {
      // Validate time range
      const validatedRange = this.validateTimeRange(gap.start, gap.end);
      if (!validatedRange.isValid) {
        return;
      }
      
      const gapStart = validatedRange.start;
      const gapEnd = validatedRange.end;
      
      const granularitySeconds = this.getGranularitySeconds(granularity);
      const maxCandlesPerRequest = 300; // Coinbase limit
      const maxTimeRange = maxCandlesPerRequest * granularitySeconds;
      
      console.log(`[FETCH GAP] Processing gap for ${granularity}:`, {
        start: new Date(gapStart * 1000).toISOString(),
        end: new Date(gapEnd * 1000).toISOString(),
        totalDays: Math.round((gapEnd - gapStart) / 86400),
        maxTimeRange: maxTimeRange / 86400 + ' days',
        granularitySeconds
      });
      
      // For daily candles, check if we're requesting data too far in the past
      // Coinbase typically only has ~1 year of daily data
      if (granularity === '1D' || granularity === '1d') {
        const oneYearAgo = Math.floor(Date.now() / 1000) - (365 * 86400);
        if (gapEnd < oneYearAgo) {
          console.log(`Skipping gap fetch for ${granularity} - data too old (before ${new Date(oneYearAgo * 1000).toISOString()})`);
          return;
        }
      }
      
      let currentStart = gapStart;
      let consecutiveEmptyResponses = 0;
      
      // If the gap is too large, split it into smaller requests
      while (currentStart < gapEnd) {
        const currentEnd = Math.min(currentStart + maxTimeRange, gapEnd);
        
        console.log(`Fetching data chunk: ${new Date(currentStart * 1000).toISOString()} to ${new Date(currentEnd * 1000).toISOString()}`);
        
        const candles = await this.api.getCandles(
          this.symbol,
          granularitySeconds,
          currentStart.toString(),
          currentEnd.toString()
        );
        
        if (candles.length > 0) {
          console.log(`Fetched ${candles.length} candles for chunk`);
          await this.cache.storeChunk(this.symbol, granularity, candles);
          consecutiveEmptyResponses = 0; // Reset counter
          
          // If we got fewer candles than expected, data might not exist that far back
          const expectedCandles = Math.floor((currentEnd - currentStart) / granularitySeconds);
          if (candles.length < expectedCandles * 0.98) { // Allow 2% missing for API downtime or data gaps
            console.warn(`Got ${candles.length} candles but expected ~${expectedCandles}. Data may not exist before ${new Date(candles[0].time * 1000).toISOString()}`);
            break; // Stop trying to fetch older data
          }
        } else {
          console.warn(`No candles returned for range ${new Date(currentStart * 1000).toISOString()} to ${new Date(currentEnd * 1000).toISOString()}`);
          consecutiveEmptyResponses++;
          
          // If we get 3 consecutive empty responses, assume no more data exists
          if (consecutiveEmptyResponses >= 3) {
            console.log(`Stopping gap fetch after ${consecutiveEmptyResponses} consecutive empty responses - assuming no data exists`);
            break;
          }
        }
        
        currentStart = currentEnd;
        
        // Add small delay between chunks to be nice to the API
        if (currentStart < gapEnd) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
    } catch (error: any) {
      console.error('Error fetching gap data:', error);
      if (error?.response?.data?.message) {
        console.error('Coinbase API error message:', error.response.data.message);
      }
    }
  }

  // Load historical data for a specific period
  async loadHistoricalData(granularity: string, days: number): Promise<void> {
    const endTime = Math.floor(Date.now() / 1000);
    const startTime = Math.floor(endTime - Math.floor(days * 86400));
    
    console.log(`Loading ${days} days of ${granularity} data`);
    
    // Check cache first
    const cacheResult = await this.cache.getCachedCandles(
      this.symbol,
      granularity,
      startTime,
      endTime
    );
    
    // Only fetch if we have significant gaps
    const totalTimeRange = endTime - startTime;
    const gapTime = cacheResult.gaps.reduce((sum, gap) => sum + (gap.end - gap.start), 0);
    const gapPercentage = (gapTime / totalTimeRange) * 100;
    
    console.log(`Cache coverage: ${(100 - gapPercentage).toFixed(1)}% (${cacheResult.candles.length} candles, ${cacheResult.gaps.length} gaps)`);
    
    // Only fetch if we're missing more than 10% of data
    if (cacheResult.gaps.length > 0 && gapPercentage > 10) {
      await this.fillGaps(cacheResult.gaps, granularity);
    }
  }

  // Set active granularity (for compatibility)
  setActiveGranularity(seconds: number) {
    const granularityMap: { [key: number]: string } = {
      60: '1m',
      300: '5m',
      900: '15m',
      3600: '1h',
      21600: '6h',
      86400: '1D'
    };
    
    this.currentGranularity = granularityMap[seconds] || '1m';
    console.log(`Active granularity set to: ${this.currentGranularity}`);
  }

  // Get all current data
  getAllData(): CandleData[] {
    return this.currentData;
  }
  
  // Get only visible data based on current view settings
  getVisibleData(): CandleData[] {
    if (this.currentGranularity === '1m' && this.visibleRange) {
      const visibleMinutes = Math.floor((this.visibleRange.end - this.visibleRange.start) / 60);
      const maxCandles = Math.min(visibleMinutes, this.maxCandles);
      return this.currentData.slice(-maxCandles);
    }
    return this.currentData;
  }

  // Get total available candle count
  async getTotalCandleCount(): Promise<number> {
    const metadata = await this.cache.getMetadata(this.symbol);
    return metadata?.totalCandles || 0;
  }

  // Subscribe to updates
  subscribe(id: string, callback: (data: CandleData, isNew?: boolean) => void) {
    const wasEmpty = this.subscribers.size === 0;
    this.subscribers.set(id, callback);
    
    // Start WebSocket aggregation when first subscriber is added and granularity is 1m
    if (wasEmpty && this.subscribers.size === 1 && this.currentGranularity === '1m') {
      console.log('ChartDataFeed: First subscriber added with 1m granularity, starting real-time aggregation');
      realtimeCandleAggregator.startAggregating(this.symbol);
    }
  }

  unsubscribe(id: string) {
    this.subscribers.delete(id);
  }

  // Append a single candle to the current data
  async appendCandle(candle: CandleData) {
    if (!candle || !this.currentGranularity) return;
    
    // Update current data array
    const existingIndex = this.currentData.findIndex(c => c.time === candle.time);
    if (existingIndex >= 0) {
      // Update existing candle
      this.currentData[existingIndex] = candle;
    } else {
      // Add new candle and sort
      this.currentData.push(candle);
      this.currentData.sort((a, b) => a.time - b.time);
    }
    
    // Update cache
    try {
      await this.cache.setCachedCandles(this.symbol, this.currentGranularity, this.currentData);
    } catch (error) {
      console.error('Error updating cache with new candle:', error);
    }
    
    // Notify subscribers
    this.subscribers.forEach(callback => {
      callback(candle, existingIndex < 0);
    });
  }

  // Get granularity in seconds
  private getGranularitySeconds(granularity: string): number {
    const map: { [key: string]: number } = {
      '1m': 60,
      '5m': 300,
      '15m': 900,
      '1h': 3600,
      '6h': 21600,
      '1d': 86400,  // Legacy support
      '1D': 86400  // Support both lowercase and uppercase
    };
    const seconds = map[granularity] || 60;
    if (granularity === '1D' || granularity === '1d') {
      console.log(`[GRANULARITY] ${granularity} = ${seconds} seconds`);
    }
    return seconds;
  }

  // Central time range validation method
  private validateTimeRange(startTime: number, endTime: number): { start: number; end: number; isValid: boolean } {
    // For crypto data, we can't get data beyond the current time
    const currentTime = Math.floor(Date.now() / 1000);
    
    // Cap the end time to current time (no future data)
    const validEnd = Math.min(endTime, currentTime);
    
    // If the requested start time is after current time, we can't provide any data
    if (startTime > currentTime) {
      // Adjust start time to be within valid range
      const adjustedStart = currentTime - 86400; // Go back 1 day from current time
      return { start: adjustedStart, end: validEnd, isValid: true };
    }
    
    // If after capping end time, start >= end, adjust the range
    if (startTime >= validEnd) {
      // Create a valid range by going back from the valid end
      const adjustedStart = validEnd - 86400; // 1 day range
      return { start: adjustedStart, end: validEnd, isValid: true };
    }
    
    // Normal case: start is before end and within valid range
    return { start: startTime, end: validEnd, isValid: true };
  }

  // Legacy methods for compatibility
  async loadHistoricalDataWithGranularity(granularitySeconds: number, days: number): Promise<CandleData[]> {
    const granularityMap: { [key: number]: string } = {
      60: '1m',
      300: '5m',
      900: '15m',
      3600: '1h',
      21600: '6h',
      86400: '1D'  // Use uppercase to match Dashboard
    };
    
    const granularity = granularityMap[granularitySeconds] || '1m';
    await this.loadHistoricalData(granularity, days);
    
    const endTime = Math.floor(Date.now() / 1000);
    const startTime = endTime - (days * 86400);
    
    const result = await this.cache.getCachedCandles(this.symbol, granularity, startTime, endTime);
    return result.candles;
  }

  async fetchLatestCandle(): Promise<CandleData | null> {
    try {
      const candles = await this.api.getCandles(
        this.symbol,
        this.getGranularitySeconds(this.currentGranularity)
      );
      
      if (candles.length > 0) {
        await this.cache.updateLatestCandle(this.symbol, this.currentGranularity, candles[0]);
        return candles[0];
      }
      
      return null;
    } catch (error) {
      console.error('Error fetching latest candle:', error);
      return null;
    }
  }

  // Public method to set granularity change callback
  onGranularityChange(callback: (granularity: string) => void) {
    this.granularityChangeCallback = callback;
  }
  
  // Set manual granularity (disables auto for 2 seconds)
  setManualGranularity(granularity: string) {
    console.log(`Manual granularity set to: ${granularity}`);
    this.isManualMode = true;
    this.activeGranularity = granularity;
    this.currentGranularity = granularity;
    
    // Clear any pending transitions
    clearTimeout(this.granularityDebounceTimer);
    this.pendingGranularity = null;
    
    // Keep manual mode active until user changes period or zooms
    // Don't auto-disable it after 2 seconds
    clearTimeout(this.manualModeTimer);
    
    // Handle real-time aggregator for 1m candles
    if (granularity !== '1m') {
      realtimeCandleAggregator.stopAggregating(this.symbol);
    } else {
      // Restart aggregation if switching back to 1m
      realtimeCandleAggregator.startAggregating(this.symbol);
    }
  }
  
  // Re-enable auto-granularity mode
  enableAutoGranularity() {
    console.log('Auto-granularity mode enabled');
    this.isManualMode = false;
    this.pendingGranularity = null;
    clearTimeout(this.manualModeTimer);
  }
  
  // Set manual mode
  setManualMode(enabled: boolean) {
    this.isManualMode = enabled;
    if (enabled) {
      clearTimeout(this.manualModeTimer);
    }
  }
  
  // Set granularity
  setGranularity(granularity: string) {
    this.setManualGranularity(granularity);
  }
  
  disconnect() {
    this.loader.stop();
    realtimeCandleAggregator.stopAggregating(this.symbol);
    if (this.realtimeUnsubscribe) {
      this.realtimeUnsubscribe();
      this.realtimeUnsubscribe = null;
    }
  }
}