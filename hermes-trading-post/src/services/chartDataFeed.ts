import type { CandleData } from '../types/coinbase';
import { CoinbaseAPI } from './coinbaseApi';
import { CoinbaseWebSocket } from './coinbaseWebSocket';
import { getIndexedDBCache } from './indexedDBCache';
import { getHistoricalDataLoader } from './historicalDataLoader';

export class ChartDataFeed {
  private api: CoinbaseAPI;
  public ws: CoinbaseWebSocket;
  private cache = getIndexedDBCache();
  public loader = getHistoricalDataLoader();
  private historicalData: CandleData[] = [];
  private subscribers: Map<string, (data: CandleData, isNew?: boolean) => void> = new Map();
  private currentCandles: Map<number, CandleData> = new Map(); // Per-granularity current candles
  private activeGranularity: number = 60; // Default to 1m
  private loaderStarted = false;
  private fetchIntervals: Map<number, NodeJS.Timeout> = new Map(); // Per-granularity fetch intervals

  constructor() {
    this.api = new CoinbaseAPI();
    this.ws = new CoinbaseWebSocket();
    this.setupWebSocket();
    this.startHistoricalLoader();
  }

  private async startHistoricalLoader() {
    if (!this.loaderStarted) {
      this.loaderStarted = true;
      console.log('Starting historical data loader...');
      // Start loader after a short delay to ensure chart is ready
      setTimeout(() => {
        this.loader.start();
      }, 1000);
    }
  }

  private setupWebSocket() {
    // Coinbase WebSocket only provides ticker data, not candles
    // We'll use price updates to update the current candle's close price
    this.ws.onPrice((price) => {
      // Calculate what the current candle time should be
      const now = Math.floor(Date.now() / 1000);
      const expectedCandleTime = Math.floor(now / this.activeGranularity) * this.activeGranularity;
      
      const currentCandle = this.currentCandles.get(this.activeGranularity);
      
      // Check if we need to create a new candle
      if (!currentCandle || currentCandle.time < expectedCandleTime) {
        // Move old candle to historical if it exists
        if (currentCandle) {
          this.historicalData.push(currentCandle);
          if (this.historicalData.length > 10000) {
            this.historicalData.shift();
          }
          console.log(`New candle period started: ${new Date(expectedCandleTime * 1000).toISOString()}`);
        }
        
        // Create new candle
        const newCandle: CandleData = {
          time: expectedCandleTime,
          open: price,
          high: price,
          low: price,
          close: price,
          volume: 0
        };
        
        this.currentCandles.set(this.activeGranularity, newCandle);
        
        // Cache the new candle
        this.cache.updateLatestCandle(this.activeGranularity, newCandle);
        
        // Notify subscribers about the new candle
        console.log(`New candle created: ${new Date(newCandle.time * 1000).toISOString()}`);
        this.subscribers.forEach(callback => {
          callback(newCandle, true); // Pass true to indicate this is a new candle
        });
      } else if (currentCandle.time === expectedCandleTime) {
        // Update current candle with latest price
        const updatedCandle = {
          ...currentCandle,
          high: Math.max(currentCandle.high, price),
          low: Math.min(currentCandle.low, price),
          close: price
        };
        this.currentCandles.set(this.activeGranularity, updatedCandle);
        
        // Notify all subscribers
        this.subscribers.forEach(callback => {
          callback(updatedCandle, false); // Pass false for price updates (not a new candle)
        });
      }
    });

    // Fetch initial candle immediately
    this.fetchLatestCandle();
    
    // Set up interval for the default granularity
    this.setupFetchInterval(this.activeGranularity);
  }
  
  private setupFetchInterval(granularity: number) {
    // Clear existing interval for this granularity if any
    const existingInterval = this.fetchIntervals.get(granularity);
    if (existingInterval) {
      clearInterval(existingInterval);
    }
    
    // Set up new interval based on granularity
    // For smaller granularities, poll more frequently
    let intervalMs: number;
    if (granularity <= 300) { // 1m, 5m
      intervalMs = 30000; // 30 seconds
    } else if (granularity <= 900) { // 15m
      intervalMs = 60000; // 1 minute
    } else if (granularity <= 3600) { // 30m, 1h
      intervalMs = 120000; // 2 minutes
    } else {
      intervalMs = 300000; // 5 minutes for larger granularities
    }
    
    console.log(`Setting up fetch interval for ${granularity}s granularity: polling every ${intervalMs/1000}s`);
    
    const interval = setInterval(async () => {
      // Only fetch if this is still the active granularity
      if (this.activeGranularity === granularity) {
        console.log(`Fetch interval triggered for ${granularity}s granularity`);
        await this.fetchLatestCandle(granularity);
      }
    }, intervalMs);
    
    this.fetchIntervals.set(granularity, interval);
  }

  async loadHistoricalDataWithGranularity(granularitySeconds: number, days: number): Promise<CandleData[]> {
    try {
      const endTime = Math.floor(Date.now() / 1000);
      const startTime = endTime - (days * 24 * 60 * 60);
      
      console.log(`Loading ${days} days of data with ${granularitySeconds}s candles from cache...`);
      
      // First try to get from cache
      const cachedCandles = await this.cache.getCachedCandles(
        granularitySeconds,
        startTime,
        endTime
      );
      
      if (cachedCandles.length > 0) {
        console.log(`Found ${cachedCandles.length} candles in cache`);
        this.historicalData = cachedCandles;
        
        // Set current candle for this granularity
        if (cachedCandles.length > 0) {
          this.currentCandles.set(granularitySeconds, cachedCandles[cachedCandles.length - 1]);
        }
        
        return this.historicalData;
      }
      
      // If no cache, fall back to API (this should rarely happen with background loader)
      console.log('No cached data found, loading from API...');
      
      const endTimeDate = new Date(endTime * 1000);
      const totalSeconds = days * 24 * 60 * 60;
      const candlesNeeded = Math.ceil(totalSeconds / granularitySeconds);
      const batchSize = 300;
      const batches = Math.ceil(candlesNeeded / batchSize);
      
      let allCandles: CandleData[] = [];
      
      for (let i = 0; i < batches; i++) {
        const batchEndTime = new Date(endTimeDate.getTime() - (i * batchSize * granularitySeconds * 1000));
        const batchStartTime = new Date(batchEndTime.getTime() - (Math.min(batchSize, candlesNeeded - (i * batchSize)) * granularitySeconds * 1000));
        
        try {
          const candles = await this.api.getCandles(
            'BTC-USD',
            granularitySeconds,
            batchStartTime.toISOString(),
            batchEndTime.toISOString()
          );
          
          if (candles.length > 0) {
            allCandles = [...candles, ...allCandles];
            // Cache the data as we load it
            await this.cache.setCachedCandles(granularitySeconds, candles);
          }
          
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
          console.error(`Error loading batch ${i + 1}:`, error);
        }
      }
      
      const uniqueCandles = Array.from(new Map(allCandles.map(c => [c.time, c])).values())
        .sort((a, b) => a.time - b.time);
      
      this.historicalData = uniqueCandles;
      
      if (uniqueCandles.length > 0) {
        this.currentCandles.set(granularitySeconds, uniqueCandles[uniqueCandles.length - 1]);
      }
      
      console.log(`Loaded ${uniqueCandles.length} unique candles`);
      return this.historicalData;
    } catch (error) {
      console.error('Error loading historical data:', error);
      throw error;
    }
  }

  async loadHistoricalData(interval: string = '1d', days: number = 1825): Promise<CandleData[]> {
    try {
      // Calculate appropriate granularity based on requested time range
      let granularity: number;
      let actualDays = days;
      
      // Coinbase granularities: 60 (1m), 300 (5m), 900 (15m), 3600 (1h), 21600 (6h), 86400 (1d)
      // Max 300 candles per request
      if (days <= 0.2) { // Less than 5 hours
        granularity = 60; // 1 minute
      } else if (days <= 1) { // 1 day
        granularity = 300; // 5 minutes
      } else if (days <= 3) { // 3 days
        granularity = 900; // 15 minutes
      } else if (days <= 12) { // 12 days
        granularity = 3600; // 1 hour
      } else if (days <= 75) { // 75 days
        granularity = 21600; // 6 hours
      } else { // More than 75 days
        granularity = 86400; // 1 day
        // For 5 years, we can only get ~300 days max
        actualDays = Math.min(days, 300);
      }
      
      const endTime = new Date();
      const startTime = new Date(endTime.getTime() - (actualDays * 24 * 60 * 60 * 1000));
      
      console.log(`Loading ${actualDays} days of data with ${granularity}s candles`);
      console.log('From:', startTime.toISOString(), 'To:', endTime.toISOString());
      
      const candles = await this.api.getCandles(
        'BTC-USD',
        granularity,
        startTime.toISOString(),
        endTime.toISOString()
      );

      this.historicalData = candles;
      
      // Set current candle for the default granularity
      if (candles.length > 0) {
        this.currentCandles.set(granularity, candles[candles.length - 1]);
      }

      return this.historicalData;
    } catch (error) {
      console.error('Error loading historical data:', error);
      throw error;
    }
  }

  async loadMoreHistoricalData(granularitySeconds: number, days: number = 30): Promise<CandleData[]> {
    try {
      if (this.historicalData.length === 0) {
        return this.loadHistoricalDataWithGranularity(granularitySeconds, days);
      }

      const earliestTime = this.historicalData[0].time;
      const endTime = earliestTime - 1;
      const startTime = endTime - (days * 24 * 60 * 60);
      
      console.log(`Loading more data from cache: ${new Date(startTime * 1000).toISOString()} to ${new Date(endTime * 1000).toISOString()}`);
      
      // Try cache first
      const cachedCandles = await this.cache.getCachedCandles(
        granularitySeconds,
        startTime,
        endTime
      );
      
      if (cachedCandles.length > 0) {
        console.log(`Found ${cachedCandles.length} more candles in cache`);
        
        // Merge with existing data - use Map to ensure uniqueness
        const dataMap = new Map<number, CandleData>();
        
        // Add existing data first
        this.historicalData.forEach(candle => dataMap.set(candle.time, candle));
        
        // Add new data (will overwrite if duplicate timestamps exist)
        let newCandleCount = 0;
        cachedCandles.forEach(candle => {
          if (!dataMap.has(candle.time)) {
            newCandleCount++;
          }
          dataMap.set(candle.time, candle);
        });
        
        // Convert back to sorted array
        const allData = Array.from(dataMap.values()).sort((a, b) => a.time - b.time);
        
        // Keep reasonable amount in memory
        if (allData.length > 50000) {
          this.historicalData = allData.slice(allData.length - 50000);
        } else {
          this.historicalData = allData;
        }
        
        console.log(`Added ${newCandleCount} new candles, total: ${this.historicalData.length}`);
        return cachedCandles; // Return all cached candles for the UI
      }
      
      // If no cache, try API (should be rare)
      console.log('No cached data for range, loading from API...');
      
      const totalSeconds = days * 24 * 60 * 60;
      const candlesNeeded = Math.ceil(totalSeconds / granularitySeconds);
      const batchSize = 300;
      const batches = Math.ceil(candlesNeeded / batchSize);
      
      let allNewCandles: CandleData[] = [];
      
      for (let i = 0; i < batches; i++) {
        const batchEndTime = new Date(endTime * 1000 - (i * batchSize * granularitySeconds * 1000));
        const batchStartTime = new Date(batchEndTime.getTime() - (Math.min(batchSize, candlesNeeded - (i * batchSize)) * granularitySeconds * 1000));
        
        try {
          const candles = await this.api.getCandles(
            'BTC-USD',
            granularitySeconds,
            batchStartTime.toISOString(),
            batchEndTime.toISOString()
          );
          
          if (candles.length > 0) {
            allNewCandles = [...candles, ...allNewCandles];
            // Cache the data
            await this.cache.setCachedCandles(granularitySeconds, candles);
          }
          
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
          console.error(`Error loading batch ${i + 1}:`, error);
        }
      }

      if (allNewCandles.length > 0) {
        const existingTimes = new Set(this.historicalData.map(c => c.time));
        const uniqueNewData = allNewCandles.filter(c => !existingTimes.has(c.time));
        
        const allData = [...uniqueNewData, ...this.historicalData]
          .sort((a, b) => a.time - b.time);
        
        if (allData.length > 50000) {
          this.historicalData = allData.slice(allData.length - 50000);
        } else {
          this.historicalData = allData;
        }
        
        console.log(`Added ${uniqueNewData.length} new candles, total: ${this.historicalData.length}`);
      }

      return allNewCandles;
    } catch (error) {
      console.error('Error loading more historical data:', error);
      throw error;
    }
  }

  private async fetchLatestCandle(granularity?: number) {
    const targetGranularity = granularity || this.activeGranularity;
    try {
      console.log(`Fetching latest candle for ${targetGranularity}s granularity...`);
      
      // Don't pass start/end times - let Coinbase give us the most recent candles
      const candles = await this.api.getCandles(
        'BTC-USD',
        targetGranularity
      );

      if (candles.length > 0) {
        const latestCandle = candles[candles.length - 1];
        const currentCandle = this.currentCandles.get(targetGranularity);
        
        // Calculate what the current candle time should be
        const now = Math.floor(Date.now() / 1000);
        const expectedCandleTime = Math.floor(now / targetGranularity) * targetGranularity;
        
        // Only update if the API candle is newer than our current candle
        // AND it's not older than the expected current candle time
        if (!currentCandle || (latestCandle.time > currentCandle.time && latestCandle.time >= expectedCandleTime - targetGranularity)) {
          if (currentCandle && latestCandle.time > currentCandle.time) {
            this.historicalData.push(currentCandle);
            if (this.historicalData.length > 10000) {
              this.historicalData.shift();
            }
          }
          
          // If the API candle is for the current period, use it
          if (latestCandle.time === expectedCandleTime) {
            this.currentCandles.set(targetGranularity, latestCandle);
            
            // Cache the new candle
            console.log(`Caching new candle for ${targetGranularity}s granularity`);
            await this.cache.updateLatestCandle(targetGranularity, latestCandle);
            
            // Notify subscribers about the new candle if it's for the active granularity
            if (targetGranularity === this.activeGranularity) {
              console.log(`New candle detected: ${new Date(latestCandle.time * 1000).toISOString()}`);
              this.subscribers.forEach(callback => {
                callback(latestCandle, true); // Pass true to indicate this is a new candle
              });
            }
          } else if (latestCandle.time === expectedCandleTime - targetGranularity) {
            // This is the previous completed candle, store it but don't overwrite current
            if (!this.historicalData.some(c => c.time === latestCandle.time)) {
              this.historicalData.push(latestCandle);
              this.historicalData.sort((a, b) => a.time - b.time);
              if (this.historicalData.length > 10000) {
                this.historicalData.shift();
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Error fetching latest candle:', error);
    }
  }

  getHistoricalData(): CandleData[] {
    return this.historicalData;
  }

  getCurrentCandle(): CandleData | null {
    return this.currentCandles.get(this.activeGranularity) || null;
  }

  getAllData(): CandleData[] {
    const all = [...this.historicalData];
    const currentCandle = this.currentCandles.get(this.activeGranularity);
    
    // Only add current candle if it's not already in historical data
    if (currentCandle && !all.some(c => c.time === currentCandle.time)) {
      all.push(currentCandle);
    }
    
    // Sort by time and remove any remaining duplicates
    const uniqueData = new Map<number, CandleData>();
    all.forEach(candle => uniqueData.set(candle.time, candle));
    
    return Array.from(uniqueData.values()).sort((a, b) => a.time - b.time);
  }

  subscribe(id: string, callback: (data: CandleData, isNew?: boolean) => void) {
    this.subscribers.set(id, callback);
  }

  unsubscribe(id: string) {
    this.subscribers.delete(id);
  }

  disconnect() {
    // Clear all fetch intervals
    this.fetchIntervals.forEach((interval, _) => {
      clearInterval(interval);
    });
    this.fetchIntervals.clear();
    
    // Disconnect WebSocket
    this.ws.disconnect();
    this.subscribers.clear();
    this.loader.stop();
  }

  // Get optimal granularity for a time range
  getOptimalGranularity(visibleRangeSeconds: number): number {
    // Adjusted to prevent too many candles on screen
    if (visibleRangeSeconds < 3600) { // < 1 hour
      return 60; // 1m
    } else if (visibleRangeSeconds < 14400) { // < 4 hours
      return 300; // 5m
    } else if (visibleRangeSeconds < 172800) { // < 2 days
      return 900; // 15m
    } else if (visibleRangeSeconds < 604800) { // < 1 week
      return 3600; // 1h
    } else if (visibleRangeSeconds < 7776000) { // < 3 months
      return 21600; // 6h
    } else {
      return 86400; // 1D
    }
  }

  // Set the active granularity for WebSocket updates
  setActiveGranularity(granularity: number) {
    console.log(`Setting active granularity to ${granularity}s`);
    
    // Clear all existing intervals before setting new granularity
    this.fetchIntervals.forEach((interval, _) => {
      clearInterval(interval);
    });
    this.fetchIntervals.clear();
    
    this.activeGranularity = granularity;
    
    // Set up fetch interval for this granularity
    this.setupFetchInterval(granularity);
    
    // If we don't have a current candle for this granularity, fetch it
    if (!this.currentCandles.has(granularity)) {
      this.fetchLatestCandle(granularity);
    }
  }

  // Get current candle for a specific granularity
  getCurrentCandleForGranularity(granularity: number): CandleData | null {
    return this.currentCandles.get(granularity) || null;
  }
}