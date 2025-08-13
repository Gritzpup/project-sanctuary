/**
 * @file chartDataFeed.ts
 * @description Provides real-time and historical data to charts
 */

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
  private static instance: ChartDataFeed | null = null;
  
  private api: CoinbaseAPI;
  private cache: IndexedDBCache;
  private loader: HistoricalDataLoader;
  private subscribers: Map<string, (data: CandleData, isNew?: boolean, metadata?: any) => void> = new Map();
  private realtimeUnsubscribe: (() => void) | null = null;
  
  // Instance tracking for preventing cross-contamination
  private activeInstanceId: string | null = null;
  private pendingLoadOperations: Map<string, AbortController> = new Map();
  private instanceLoadCounts: Map<string, number> = new Map();
  
  // Current state
  private symbol = 'BTC-USD';
  private currentGranularity = '1m';
  private visibleRange: { start: number; end: number } | null = null;
  private currentData: CandleData[] = [];
  private autoUpdateRange = true; // Auto-scroll with new candles
  private maxCandles = 1440; // Maximum candles to keep for 1m view (24 hours)
  
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

  private constructor() {
    this.api = new CoinbaseAPI();
    this.cache = new IndexedDBCache();
    this.loader = new HistoricalDataLoader(this.api, this.cache);
    
    // console.log(`ChartDataFeed: Initialized with granularity ${this.currentGranularity}`);
    
    // Don't clear data on initialization - preserve across navigation
    // this.clearInMemoryData();
    
    // Setup WebSocket but don't start aggregation yet
    this.setupWebSocket();
    
    this.startBackgroundLoading();
    
    // Start background cache pruning (non-blocking)
    this.startBackgroundCachePruning();
  }

  // Instance management methods
  setActiveInstance(instanceId: string) {
    if (this.activeInstanceId && this.activeInstanceId !== instanceId) {
      console.log(`ChartDataFeed: Switching from instance ${this.activeInstanceId} to ${instanceId}`);
      // Abort any pending operations for the old instance
      this.abortPendingOperations();
    }
    this.activeInstanceId = instanceId;
    
    // Track load count for this instance
    const currentCount = this.instanceLoadCounts.get(instanceId) || 0;
    this.instanceLoadCounts.set(instanceId, currentCount + 1);
    
    // console.log(`ChartDataFeed: Active instance set to ${instanceId} (load count: ${currentCount + 1})`);
  }

  clearActiveInstance() {
    if (this.activeInstanceId) {
      console.log(`ChartDataFeed: Clearing active instance ${this.activeInstanceId}`);
      this.abortPendingOperations();
      this.activeInstanceId = null;
    }
  }

  private abortPendingOperations() {
    console.log(`ChartDataFeed: Aborting ${this.pendingLoadOperations.size} pending operations`);
    this.pendingLoadOperations.forEach((controller, key) => {
      controller.abort();
    });
    this.pendingLoadOperations.clear();
  }

  private isCurrentInstance(instanceId: string): boolean {
    return this.activeInstanceId === instanceId;
  }

  public static getInstance(): ChartDataFeed {
    if (!ChartDataFeed.instance) {
      // console.log('ChartDataFeed: Creating singleton instance');
      ChartDataFeed.instance = new ChartDataFeed();
    } else {
      // console.log('ChartDataFeed: Returning existing singleton instance');
    }
    return ChartDataFeed.instance;
  }

  // Helper to log current data state
  private logDataState(operation: string, details?: any) {
    // console.log(`📊 CANDLE TRACKER [${operation}]`, {
    //   currentDataLength: this.currentData.length,
    //   granularity: this.currentGranularity,
    //   firstCandle: this.currentData[0] ? new Date(this.currentData[0].time * 1000).toISOString() : 'none',
    //   lastCandle: this.currentData[this.currentData.length - 1] ? new Date(this.currentData[this.currentData.length - 1].time * 1000).toISOString() : 'none',
    //   ...details
    // });
  }

  private async startBackgroundLoading() {
    // Skip background loading - load data on demand to optimize initial load time
    // console.log('ChartDataFeed: Background loading disabled for faster initial load');
  }

  // Background cache pruning to keep cache size manageable
  private startBackgroundCachePruning() {
    // Cache pruning is now handled automatically by storeChunk method
    // No need for separate background pruning
  }

  // Progressive data loading for fast initial render
  async loadProgressiveData(startTime: number, endTime: number, granularity: string, instanceId: string): Promise<CandleData[]> {
    // console.log(`ChartDataFeed: Progressive load for ${granularity} - instance ${instanceId}`);
    
    // Check if this is still the active instance
    if (!this.isCurrentInstance(instanceId)) {
      console.log(`ChartDataFeed: Aborting progressive load - instance ${instanceId} is no longer active`);
      return [];
    }
    
    // On initial load, refresh data for visible range to ensure data integrity
    const isInitialLoad = this.currentData.length === 0;
    if (isInitialLoad) {
      console.log('ChartDataFeed: Initial load detected, refreshing visible range data...');
      // For 1m granularity, limit initial refresh to avoid exceeding API limits
      const granularitySeconds = this.getGranularitySeconds(granularity);
      const maxCandlesPerRequest = 300;
      const maxRefreshSeconds = maxCandlesPerRequest * granularitySeconds;
      
      const visibleRangeSeconds = Math.min(endTime - startTime, maxRefreshSeconds); // Respect API limit
      const refreshStartTime = Math.max(startTime, endTime - visibleRangeSeconds);
      
      try {
        const freshData = await this.refreshDataForRange(refreshStartTime, endTime, granularity);
        if (freshData.length > 0) {
          this.currentData = freshData;
          console.log(`ChartDataFeed: Initial refresh loaded ${freshData.length} candles`);
          return freshData;
        }
      } catch (error) {
        console.error('ChartDataFeed: Error refreshing initial data, falling back to cache:', error);
      }
    }
    
    // For 1m granularity, prioritize loading the visible range first
    if (granularity === '1m') {
      // Load visible range first (last 60-240 candles)
      const visibleRangeSeconds = endTime - startTime;
      const recentStartTime = Math.max(startTime, endTime - Math.min(visibleRangeSeconds, 14400)); // Max 4 hours
      
      // console.log(`ChartDataFeed: Loading recent ${granularity} data first...`);
      const recentData = await this.cache.getCachedCandles(
        this.symbol,
        granularity,
        recentStartTime,
        endTime
      );
      
      // If we have recent data, return it immediately
      if (recentData.candles.length > 0) {
        // console.log(`ChartDataFeed: Returning ${recentData.candles.length} recent candles immediately`);
        this.currentData = recentData.candles;
        
        // Load the rest in background (skip during Paper Test)
        if (startTime < recentStartTime && instanceId !== 'paper-test') {
          setTimeout(async () => {
            if (this.isCurrentInstance(instanceId)) {
              // console.log(`ChartDataFeed: Loading historical data in background...`);
              await this.loadHistoricalData(granularity, Math.ceil((endTime - startTime) / 86400), instanceId);
            }
          }, 100);
        }
        
        return recentData.candles;
      }
    }
    
    // Fall back to regular loading
    return this.getCurrentDataForRange(startTime, endTime, instanceId);
  }

  private setupWebSocket() {
    // Use realtimeCandleAggregator for 1-minute candles
    this.realtimeUnsubscribe = realtimeCandleAggregator.subscribe((update) => {
      // console.log(`ChartDataFeed: Received update from aggregator`, {
      //   symbol: update.symbol,
      //   currentGranularity: this.currentGranularity,
      //   isNewCandle: update.isNewCandle,
      //   time: new Date(Number(update.candle.time) * 1000).toISOString()
      // });
      
      // Always process updates for real-time price display
      if (update.symbol === this.symbol) {
        // Skip updates if we don't have an active instance
        if (!this.activeInstanceId) {
          return;
        }
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
            // console.log(`ChartDataFeed: Received new 1m candle at ${new Date(candleData.time * 1000).toISOString()}`);
            
            // Check if we already have this candle (prevent duplicates)
            const existingIndex = this.currentData.findIndex(c => c.time === candleData.time);
            if (existingIndex >= 0) {
              console.log(`ChartDataFeed: Candle already exists at index ${existingIndex}, updating instead of adding`);
              this.currentData[existingIndex] = candleData;
            } else {
              // Add new candle to current data
              this.logDataState('BEFORE_ADD_NEW_CANDLE');
              this.currentData.push(candleData);
              this.logDataState('AFTER_ADD_NEW_CANDLE', { addedCandle: new Date(candleData.time * 1000).toISOString() });
            }
            
            // DON'T remove candles - just notify chart to update viewport
            // Check if we should trigger a viewport adjustment
            if (this.currentData.length > 60) {
              // console.log(`ChartDataFeed: Total candles: ${this.currentData.length}, sending viewport update`);
              
              // Notify chart to adjust viewport to show recent candles
              // The chart will slide its view window, not remove data
              this.subscribers.forEach((callback, subscriberId) => {
                try {
                  // Only notify if subscriber ID matches active instance
                  if (subscriberId.startsWith(this.activeInstanceId!)) {
                    callback(candleData, update.isNewCandle, {
                      viewportUpdate: true,
                      totalCandles: this.currentData.length,
                      latestTime: candleData.time
                    });
                  }
                } catch (error) {
                  console.error('ChartDataFeed: Error in subscriber callback (viewport update):', error);
                }
              });
            }
          } else {
            // Update existing candle
            const lastIndex = this.currentData.length - 1;
            if (lastIndex >= 0 && this.currentData[lastIndex].time === candleData.time) {
              // console.log(`ChartDataFeed: Updating existing 1m candle at index ${lastIndex}, time: ${new Date(candleData.time * 1000).toISOString()}`);
              this.currentData[lastIndex] = candleData;
            } else {
              // Check if this is actually a new candle that should be added
              if (lastIndex < 0 || candleData.time > this.currentData[lastIndex].time) {
                console.log(`ChartDataFeed: Adding new 1m candle at ${new Date(candleData.time * 1000).toISOString()}`);
                this.logDataState('BEFORE_ADD_NEW_CANDLE_UPDATE_BRANCH');
                this.currentData.push(candleData);
                this.logDataState('AFTER_ADD_NEW_CANDLE_UPDATE_BRANCH');
                
                // DON'T apply sliding window - keep all candles for paper trading
                console.log(`ChartDataFeed: Total candles: ${this.currentData.length}`);
                
                // Mark this as a new candle for the notification
                update.isNewCandle = true;
              } else {
                console.log(`ChartDataFeed: Could not find 1m candle to update. Last candle time: ${lastIndex >= 0 ? new Date(this.currentData[lastIndex].time * 1000).toISOString() : 'none'}, update time: ${new Date(candleData.time * 1000).toISOString()}`);
              }
            }
          }
          
          // Notify subscribers with the candle update
          // console.log(`ChartDataFeed: Notifying ${this.subscribers.size} subscribers for 1m update`);
          this.subscribers.forEach((callback, subscriberId) => {
            try {
              // Only notify if subscriber ID matches active instance
              if (subscriberId.startsWith(this.activeInstanceId!)) {
                callback(candleData, update.isNewCandle);
              }
            } catch (error) {
              console.error('ChartDataFeed: Error in subscriber callback:', error);
            }
          });
          
          // console.log(`ChartDataFeed: Total candles after sliding window: ${this.currentData.length}`);
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
            this.subscribers.forEach((callback, subscriberId) => {
              try {
                // Only notify if subscriber ID matches active instance
                if (subscriberId.startsWith(this.activeInstanceId!)) {
                  callback(updatedCandle, false);
                }
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
  async getDataForVisibleRange(startTime: number, endTime: number, instanceId?: string): Promise<CandleData[]> {
    // Check if this is still the active instance
    if (instanceId && !this.isCurrentInstance(instanceId)) {
      console.log(`ChartDataFeed: Skipping visible range fetch - instance ${instanceId} is no longer active`);
      return [];
    }
    
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
    const data = await this.getCurrentDataForRange(startTime, endTime, instanceId);
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
  
  // Force refresh data for a range (used on page load)
  async refreshDataForRange(startTime: number, endTime: number, granularity: string): Promise<CandleData[]> {
    console.log(`ChartDataFeed: Force refreshing data for ${granularity} from ${new Date(startTime * 1000).toISOString()} to ${new Date(endTime * 1000).toISOString()}`);
    
    // Clear the cache for this range first
    await this.cache.clearRange(this.symbol, granularity, startTime, endTime);
    
    // Fetch fresh data from API
    const granularitySeconds = this.getGranularitySeconds(granularity);
    const maxCandlesPerRequest = 300; // Coinbase limit
    const maxTimeRange = maxCandlesPerRequest * granularitySeconds;
    
    const allCandles: CandleData[] = [];
    let currentStart = startTime;
    
    // If the time range exceeds the limit, split into chunks
    while (currentStart < endTime) {
      const currentEnd = Math.min(currentStart + maxTimeRange, endTime);
      
      console.log(`ChartDataFeed: Fetching chunk from ${new Date(currentStart * 1000).toISOString()} to ${new Date(currentEnd * 1000).toISOString()}`);
      
      try {
        const candles = await this.api.getCandles(
          this.symbol,
          granularitySeconds,
          currentStart.toString(),
          currentEnd.toString()
        );
        
        if (candles.length > 0) {
          allCandles.push(...candles);
          console.log(`ChartDataFeed: Fetched ${candles.length} candles for chunk`);
        }
      } catch (error) {
        console.error(`ChartDataFeed: Error fetching chunk:`, error);
        // Continue with next chunk even if one fails
      }
      
      currentStart = currentEnd;
      
      // Add small delay between chunks to be nice to the API
      if (currentStart < endTime) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    // Store all the fresh data
    if (allCandles.length > 0) {
      await this.cache.storeChunk(this.symbol, granularity, allCandles);
      console.log(`ChartDataFeed: Stored ${allCandles.length} fresh candles total`);
    }
    
    return allCandles;
  }

  // Get current data for the visible range
  private async getCurrentDataForRange(startTime: number, endTime: number, instanceId?: string): Promise<CandleData[]> {
    // Check if this is still the active instance
    if (instanceId && !this.isCurrentInstance(instanceId)) {
      console.log(`ChartDataFeed: Skipping data range fetch - instance ${instanceId} is no longer active`);
      return [];
    }
    
    // In 1m mode with real-time data, return existing data if we have it
    if (this.currentGranularity === '1m' && this.currentData.length > 0) {
      console.log(`ChartDataFeed: In 1m mode with ${this.currentData.length} real-time candles, returning ALL candles (not filtering by time range)`);
      // Return ALL candles for paper trading - don't filter by time range
      return this.currentData;
    }
    
    // Validate time range
    const validatedRange = this.validateTimeRange(startTime, endTime);
    
    if (!validatedRange.isValid) {
      return [];
    }
    
    // Log for debugging
    console.log(`ChartDataFeed: Getting data for range ${new Date(startTime * 1000).toISOString()} to ${new Date(endTime * 1000).toISOString()}`);
    console.log(`ChartDataFeed: Current data length: ${this.currentData.length}, Active granularity: ${this.activeGranularity}`);
    
    // If we have no data yet, ensure we try to fetch it
    if (this.currentData.length === 0) {
      console.log('ChartDataFeed: No cached data, will fetch fresh data...');
    }
    
    startTime = validatedRange.start;
    endTime = validatedRange.end;
    
    // For very long time ranges (1Y, 5Y), ensure we have the data loaded
    const rangeInDays = (endTime - startTime) / 86400;
    if (rangeInDays > 180 && this.activeGranularity === '1D') {
      await this.loadHistoricalData('1D', Math.ceil(rangeInDays), instanceId);
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
      console.log(`ChartDataFeed: Found ${cacheResult.gaps.length} gaps, filling...`);
      await this.fillGaps(cacheResult.gaps, this.activeGranularity, instanceId);
      
      // Re-fetch from cache after filling gaps
      const updatedResult = await this.cache.getCachedCandles(
        this.symbol,
        this.activeGranularity,
        startTime,
        endTime
      );
      
      this.logDataState('BEFORE_REPLACE_WITH_UPDATED_CACHE');
      this.currentData = updatedResult.candles;
      this.logDataState('AFTER_REPLACE_WITH_UPDATED_CACHE', { source: 'gap-filled cache' });
      console.log(`ChartDataFeed: After filling gaps, have ${this.currentData.length} candles`);
    } else {
      this.logDataState('BEFORE_REPLACE_WITH_CACHE');
      this.currentData = cacheResult.candles;
      this.logDataState('AFTER_REPLACE_WITH_CACHE', { source: 'direct cache' });
      console.log(`ChartDataFeed: Using cached data, have ${this.currentData.length} candles`);
    }
    
    // If still no data, force load it
    if (this.currentData.length === 0) {
      console.log('ChartDataFeed: No data after cache check, forcing load...');
      const days = Math.ceil((endTime - startTime) / 86400) + 1;
      await this.loadHistoricalData(this.activeGranularity, days, instanceId);
      
      // Try cache again
      const finalResult = await this.cache.getCachedCandles(
        this.symbol,
        this.activeGranularity,
        startTime,
        endTime
      );
      this.logDataState('BEFORE_REPLACE_WITH_FINAL_RESULT');
      this.currentData = finalResult.candles;
      this.logDataState('AFTER_REPLACE_WITH_FINAL_RESULT', { source: 'forced load' });
    }
    
    console.log(`ChartDataFeed: getCurrentDataForRange returning ${this.currentData.length} candles`);
    return this.currentData;
  }
  
  // Preload adjacent granularities for smooth transitions
  private async preloadAdjacentGranularities(currentGranularity: string) {
    // Skip preloading during Paper Test to improve performance
    if (this.activeInstanceId === 'paper-test') {
      console.log('ChartDataFeed: Skipping granularity preload during Paper Test');
      return;
    }
    
    const threshold = this.granularityThresholds.find(t => t.granularity === currentGranularity);
    
    if (!threshold?.preloadNext || !this.visibleRange) return;
    
    // Preload next coarser granularity in background
    setTimeout(() => {
      this.loadHistoricalData(threshold.preloadNext!, 7, this.activeInstanceId || undefined);
    }, 1000);
    
    // Also preload previous finer granularity
    const currentIndex = this.granularityThresholds.findIndex(t => t.granularity === currentGranularity);
    
    if (currentIndex > 0) {
      const prevGranularity = this.granularityThresholds[currentIndex - 1].granularity;
      setTimeout(() => {
        this.loadHistoricalData(prevGranularity, 7, this.activeInstanceId || undefined);
      }, 1500);
    }
  }

  // Fill gaps in data
  private async fillGaps(gaps: Array<{ start: number; end: number }>, granularity: string, instanceId?: string): Promise<void> {
    // Check if this is still the active instance
    if (instanceId && !this.isCurrentInstance(instanceId)) {
      console.log(`ChartDataFeed: Skipping gap fill - instance ${instanceId} is no longer active`);
      return;
    }
    // console.log(`[FILL GAPS] Received ${gaps.length} gaps for ${granularity}:`, {
    //   gaps: gaps.slice(0, 5).map(g => ({
    //     start: new Date(g.start * 1000).toISOString(),
    //     end: new Date(g.end * 1000).toISOString(),
    //     days: Math.round((g.end - g.start) / 86400)
    //   })),
    //   totalGaps: gaps.length,
    //   ...(gaps.length > 5 ? { note: `... and ${gaps.length - 5} more gaps` } : {})
    // });
    
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
        
        const promise = this.fetchGapData(gap, granularity, instanceId);
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

  private async fetchGapData(gap: { start: number; end: number }, granularity: string, instanceId?: string): Promise<void> {
    // Check if this is still the active instance
    if (instanceId && !this.isCurrentInstance(instanceId)) {
      console.log(`ChartDataFeed: Skipping gap data fetch - instance ${instanceId} is no longer active`);
      return;
    }
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
      
      // console.log(`[FETCH GAP] Processing gap for ${granularity}:`, {
      //   start: new Date(gapStart * 1000).toISOString(),
      //   end: new Date(gapEnd * 1000).toISOString(),
      //   totalDays: Math.round((gapEnd - gapStart) / 86400),
      //   maxTimeRange: maxTimeRange / 86400 + ' days',
      //   granularitySeconds
      // });
      
      // Note: Coinbase provides several years of daily data, so we don't need to limit how far back we fetch
      
      let currentStart = gapStart;
      let consecutiveEmptyResponses = 0;
      
      // If the gap is too large, split it into smaller requests
      while (currentStart < gapEnd) {
        const currentEnd = Math.min(currentStart + maxTimeRange, gapEnd);
        
        // console.log(`Fetching data chunk: ${new Date(currentStart * 1000).toISOString()} to ${new Date(currentEnd * 1000).toISOString()}`);
        
        const candles = await this.api.getCandles(
          this.symbol,
          granularitySeconds,
          currentStart.toString(),
          currentEnd.toString()
        );
        
        if (candles.length > 0) {
          // console.log(`Fetched ${candles.length} candles for chunk`);
          
          // Check again before storing data
          if (instanceId && !this.isCurrentInstance(instanceId)) {
            console.log(`ChartDataFeed: Aborting gap data store - instance ${instanceId} is no longer active`);
            return;
          }
          
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
  async loadHistoricalData(granularity: string, days: number, instanceId?: string): Promise<void> {
    // Create abort controller for this operation
    const operationKey = `load-${granularity}-${days}-${Date.now()}`;
    const abortController = new AbortController();
    
    if (instanceId) {
      this.pendingLoadOperations.set(operationKey, abortController);
    }

    try {
      const endTime = Math.floor(Date.now() / 1000);
      const startTime = Math.floor(endTime - Math.floor(days * 86400));
      
      // console.log(`Loading ${days} days of ${granularity} data`);
      
      // Check if operation was aborted
      if (abortController.signal.aborted) {
        console.log(`ChartDataFeed: Load operation aborted for ${granularity}`);
        return;
      }
      
      // Check if this is still the active instance
      if (instanceId && !this.isCurrentInstance(instanceId)) {
        console.log(`ChartDataFeed: Skipping historical data load - instance ${instanceId} is no longer active`);
        return;
      }
    
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
    
    // console.log(`Cache coverage: ${(100 - gapPercentage).toFixed(1)}% (${cacheResult.candles.length} candles, ${cacheResult.gaps.length} gaps)`);
    
      // Only fetch if we're missing more than 10% of data
      if (cacheResult.gaps.length > 0 && gapPercentage > 10) {
        // Check again before filling gaps
        if (instanceId && !this.isCurrentInstance(instanceId)) {
          console.log(`ChartDataFeed: Skipping gap fill - instance ${instanceId} is no longer active`);
          return;
        }
        await this.fillGaps(cacheResult.gaps, granularity, instanceId);
      }
    } finally {
      // Clean up abort controller
      if (instanceId) {
        this.pendingLoadOperations.delete(operationKey);
      }
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
  subscribe(id: string, callback: (data: CandleData, isNew?: boolean, metadata?: any) => void) {
    const wasEmpty = this.subscribers.size === 0;
    this.subscribers.set(id, callback);
    this.logDataState('SUBSCRIBE', { 
      subscriberId: id,
      totalSubscribers: this.subscribers.size,
      wasEmpty
    });
    
    // Start WebSocket aggregation when first subscriber is added and granularity is 1m
    if (wasEmpty && this.subscribers.size === 1 && this.currentGranularity === '1m') {
      // console.log('ChartDataFeed: First subscriber added with 1m granularity, starting real-time aggregation');
      realtimeCandleAggregator.startAggregating(this.symbol);
    }
  }

  unsubscribe(id: string) {
    this.subscribers.delete(id);
    this.logDataState('UNSUBSCRIBE', { 
      subscriberId: id,
      remainingSubscribers: this.subscribers.size
    });
  }
  
  // Get current candle data for strategies
  getCurrentCandles(): CandleData[] {
    return [...this.currentData];
  }
  
  // Get current granularity
  getCurrentGranularity(): string {
    return this.currentGranularity;
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
    this.logDataState('BEFORE_SET_MANUAL_GRANULARITY', { 
      newGranularity: granularity,
      oldGranularity: this.currentGranularity,
      caller: new Error().stack?.split('\n').slice(2,4).join(' -> ')
    });
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
    this.logDataState('BEFORE_DISCONNECT', { 
      caller: new Error().stack?.split('\n').slice(2,4).join(' -> ')
    });
    this.loader.stop();
    realtimeCandleAggregator.stopAggregating(this.symbol);
    if (this.realtimeUnsubscribe) {
      this.realtimeUnsubscribe();
      this.realtimeUnsubscribe = null;
    }
    // Don't clear data on disconnect - preserve across navigation
    // this.clearInMemoryData();
    console.log('ChartDataFeed: Disconnected - data preserved');
  }
  
  // Clear all in-memory data to prevent stale data when switching views
  private clearInMemoryData() {
    console.log('ChartDataFeed: Clearing in-memory data');
    this.logDataState('BEFORE_CLEAR_IN_MEMORY');
    this.currentData = [];
    this.logDataState('AFTER_CLEAR_IN_MEMORY', { caller: new Error().stack?.split('\n')[2] });
    this.dataByGranularity.clear();
    this.loadingPromises.clear();
  }

  // Public method to explicitly reset data (e.g., when changing symbols)
  public reset() {
    console.log('ChartDataFeed: Explicitly resetting data');
    this.clearInMemoryData();
    // Restart WebSocket for new data
    this.setupWebSocket();
  }
}