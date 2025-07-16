import type { CandleData } from '../types/coinbase';
import { CoinbaseAPI } from './coinbaseApi';
import { CoinbaseWebSocket } from './coinbaseWebSocket';
import { IndexedDBCache } from './indexedDBCache';
import { HistoricalDataLoader } from './historicalDataLoader';

interface DataRequest {
  symbol: string;
  granularity: string;
  startTime: number;
  endTime: number;
}

export class ChartDataFeed {
  private api: CoinbaseAPI;
  public ws: CoinbaseWebSocket;
  private cache: IndexedDBCache;
  private loader: HistoricalDataLoader;
  private subscribers: Map<string, (data: CandleData, isNew?: boolean) => void> = new Map();
  
  // Current state
  private symbol = 'BTC-USD';
  private currentGranularity = '1m';
  private visibleRange: { start: number; end: number } | null = null;
  private currentData: CandleData[] = [];
  
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
    this.ws = new CoinbaseWebSocket();
    this.cache = new IndexedDBCache();
    this.loader = new HistoricalDataLoader(this.api, this.cache);
    
    this.setupWebSocket();
    this.startBackgroundLoading();
  }

  private async startBackgroundLoading() {
    // Start loading historical data in the background
    
    // Only load minimal data on startup to avoid rate limits
    const priorityLoads = [
      { granularity: '1m', days: 0.25 },    // 6 hours of 1m data (360 candles) - covers 1H and 4H views
      { granularity: '5m', days: 0.5 },     // 12 hours of 5m data (144 candles)
      { granularity: '1h', days: 7 },       // 7 days of 1h data (168 candles) - covers 1D and 1W views
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
    this.ws.onPrice(async (price) => {
      if (!this.wsConnected) return;
      
      const now = Math.floor(Date.now() / 1000);
      
      // Update real-time candle for current granularity
      await this.updateRealtimeCandle(price, now);
    });
    
    this.ws.onStatus((status) => {
      this.wsConnected = status === 'connected';
      // Only log status changes, not every status update
      if (status !== 'connected' || !this.wsConnected) {
        console.log(`WebSocket status: ${status}`);
      }
    });
  }

  private async updateRealtimeCandle(price: number, timestamp: number) {
    const granularitySeconds = this.getGranularitySeconds(this.currentGranularity);
    const candleTime = Math.floor(timestamp / granularitySeconds) * granularitySeconds;
    
    // Get the current candle from data
    const currentIndex = this.currentData.findIndex(c => c.time === candleTime);
    
    if (currentIndex >= 0) {
      // Update existing candle
      const candle = this.currentData[currentIndex];
      const updated = {
        ...candle,
        high: Math.max(candle.high, price),
        low: Math.min(candle.low, price),
        close: price,
        volume: candle.volume // Volume updates come from API
      };
      
      this.currentData[currentIndex] = updated;
      
      // Update cache
      await this.cache.updateLatestCandle(this.symbol, this.currentGranularity, updated);
      
      // Notify subscribers
      this.subscribers.forEach(callback => callback(updated, false));
    } else if (this.currentData.length > 0) {
      // Check if this is a new candle
      const lastCandle = this.currentData[this.currentData.length - 1];
      if (candleTime > lastCandle.time) {
        // Create new candle
        const newCandle: CandleData = {
          time: candleTime,
          open: price,
          high: price,
          low: price,
          close: price,
          volume: 0
        };
        
        this.currentData.push(newCandle);
        
        // Update cache
        await this.cache.updateLatestCandle(this.symbol, this.currentGranularity, newCandle);
        
        // Notify subscribers about new candle
        this.subscribers.forEach(callback => callback(newCandle, true));
      }
    }
  }

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
    
    console.log(`Transitioning from ${this.activeGranularity} to ${newGranularity}`);
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
    console.log(`Requested range: ${new Date(startTime * 1000).toISOString()} to ${new Date(endTime * 1000).toISOString()}`);
    
    // Validate time range
    const validatedRange = this.validateTimeRange(startTime, endTime);
    
    console.log(`Validated range: ${new Date(validatedRange.start * 1000).toISOString()} to ${new Date(validatedRange.end * 1000).toISOString()}, isValid: ${validatedRange.isValid}`);
    
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
    
    console.log(`Cache returned ${cacheResult.candles.length} candles, ${cacheResult.gaps.length} gaps`);
    
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
    console.log(`Filling ${gaps.length} gaps for ${granularity}`);
    
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
    const batchSize = 5; // Process 5 gaps at a time
    
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
        await new Promise(resolve => setTimeout(resolve, 500));
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
      
      let currentStart = gapStart;
      
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
          
          // If we got fewer candles than expected, data might not exist that far back
          const expectedCandles = Math.floor((currentEnd - currentStart) / granularitySeconds);
          if (candles.length < expectedCandles * 0.8) { // Allow 20% missing for weekends/holidays
            console.warn(`Got ${candles.length} candles but expected ~${expectedCandles}. Data may not exist before ${new Date(candles[0].time * 1000).toISOString()}`);
            break; // Stop trying to fetch older data
          }
        } else {
          console.warn(`No candles returned for range ${new Date(currentStart * 1000).toISOString()} to ${new Date(currentEnd * 1000).toISOString()}`);
          break; // No point continuing if we get empty results
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
    const startTime = endTime - (days * 86400);
    
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

  // Get total available candle count
  async getTotalCandleCount(): Promise<number> {
    const metadata = await this.cache.getMetadata(this.symbol);
    return metadata?.totalCandles || 0;
  }

  // Subscribe to updates
  subscribe(id: string, callback: (data: CandleData, isNew?: boolean) => void) {
    this.subscribers.set(id, callback);
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
      await this.cache.setCachedData(this.symbol, this.currentGranularity, this.currentData);
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
    return map[granularity] || 60;
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
    this.ws.disconnect();
    this.loader.stop();
  }
}