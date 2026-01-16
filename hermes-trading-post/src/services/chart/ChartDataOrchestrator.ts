// @ts-nocheck - Property initialization in initializeServices()
import type { CandleData } from '../../types/coinbase';
import { RealtimeDataSource } from './data-sources/RealtimeDataSource';
import { HistoricalDataSource } from './data-sources/HistoricalDataSource';
import { CacheDataSource } from './data-sources/CacheDataSource';
import { CandleAggregator } from './aggregation/CandleAggregator';
import { GranularityManager } from './aggregation/GranularityManager';
import { SubscriptionManager } from './subscription/SubscriptionManager';
import { DataCacheManager } from './cache/DataCacheManager';

interface DataRequest {
  symbol: string;
  granularity: string;
  startTime: number;
  endTime: number;
}

export class ChartDataOrchestrator {
  private static instance: ChartDataOrchestrator | null = null;
  
  private realtimeDataSource: RealtimeDataSource;
  private historicalDataSource: HistoricalDataSource;
  private cacheDataSource: CacheDataSource;
  private candleAggregator: CandleAggregator;
  private granularityManager: GranularityManager;
  private subscriptionManager: SubscriptionManager;
  private cacheManager: DataCacheManager;
  
  private subscribers: Map<string, (data: CandleData, isNew?: boolean, metadata?: any) => void> = new Map();
  
  // State management
  private activeInstanceId: string | null = null;
  private pendingLoadOperations: Map<string, AbortController> = new Map();
  private instanceLoadCounts: Map<string, number> = new Map();
  
  // Current state
  private symbol = 'BTC-USD';
  private currentGranularity = '1m';
  private visibleRange: { start: number; end: number } | null = null;
  private currentData: CandleData[] = [];
  private autoUpdateRange = true;
  private maxCandles = 100000; // Support large datasets for historical analysis (5 years of data)
  
  // Loading state
  private loadingPromises = new Map<string, Promise<void>>();
  private wsConnected = false;
  
  // Multi-granularity state
  private granularityChangeCallback: ((granularity: string) => void) | null = null;
  private granularityDebounceTimer: any = null;
  private pendingGranularity: string | null = null;
  private isTransitioning = false;
  private isManualMode = false;

  private constructor() {
    this.initializeServices();
  }

  private initializeServices() {
    // Initialize data sources
    this.realtimeDataSource = new RealtimeDataSource();
    this.historicalDataSource = new HistoricalDataSource();
    this.cacheDataSource = new CacheDataSource();
    
    // Initialize aggregation services
    this.candleAggregator = new CandleAggregator();
    this.granularityManager = new GranularityManager();
    
    // Initialize subscription and cache management
    this.subscriptionManager = new SubscriptionManager();
    this.cacheManager = new DataCacheManager();
    
    // Setup event handlers
    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    // Handle real-time data updates
    this.realtimeDataSource.onCandleUpdate((candle, metadata) => {
      this.handleRealtimeCandle(candle, metadata);
    });
    
    // Handle connection status changes
    this.realtimeDataSource.onConnectionChange((connected) => {
      this.wsConnected = connected;
      this.notifyConnectionStatus(connected);
    });
    
    // Handle granularity changes
    this.granularityManager.onGranularityChange((granularity) => {
      this.handleGranularityChange(granularity);
    });
  }

  public static getInstance(): ChartDataOrchestrator {
    if (!ChartDataOrchestrator.instance) {
      ChartDataOrchestrator.instance = new ChartDataOrchestrator();
    }
    return ChartDataOrchestrator.instance;
  }

  public async initialize(instanceId?: string): Promise<void> {
    
    this.activeInstanceId = instanceId || 'default';
    this.instanceLoadCounts.set(this.activeInstanceId, 0);
    
    // Initialize all services
    await this.cacheManager.initialize();
    await this.subscriptionManager.initialize();
    
  }

  public async loadData(request: DataRequest): Promise<CandleData[]> {
    const { symbol, granularity, startTime, endTime } = request;
    const cacheKey = `${symbol}-${granularity}-${startTime}-${endTime}`;
    
    // Check if already loading
    if (this.loadingPromises.has(cacheKey)) {
      return this.loadingPromises.get(cacheKey)!.then(() => this.currentData);
    }
    
    // Create loading promise
    const loadPromise = this.executeDataLoad(request);
    this.loadingPromises.set(cacheKey, loadPromise);
    
    try {
      await loadPromise;
      return this.currentData;
    } finally {
      this.loadingPromises.delete(cacheKey);
    }
  }

  private async executeDataLoad(request: DataRequest): Promise<void> {
    const { symbol, granularity, startTime, endTime } = request;
    
    
    try {
      // Try cache first
      let data = await this.cacheDataSource.getData(symbol, granularity, startTime, endTime);
      
      if (!data || data.length === 0) {
        // Load from historical source
        data = await this.historicalDataSource.getData(symbol, granularity, startTime, endTime);
        
        // Cache the data
        if (data && data.length > 0) {
          await this.cacheManager.storeData(symbol, granularity, data);
        }
      }
      
      if (data && data.length > 0) {
        this.currentData = data;
        this.symbol = symbol;
        this.currentGranularity = granularity;
        this.visibleRange = { start: startTime, end: endTime };
        
        // Notify subscribers
        this.notifySubscribers(data);
        
      } else {
      }
      
    } catch (error) {
      throw error;
    }
  }

  public subscribe(id: string, callback: (data: CandleData, isNew?: boolean, metadata?: any) => void): void {
    this.subscribers.set(id, callback);
    
    // Send current data if available
    if (this.currentData.length > 0) {
      this.currentData.forEach(candle => callback(candle, false));
    }
  }

  public unsubscribe(id: string): void {
    this.subscribers.delete(id);
  }

  public async subscribeRealtime(symbol: string, granularity: string): Promise<void> {
    await this.subscriptionManager.subscribe(symbol, granularity);
    await this.realtimeDataSource.subscribe(symbol, granularity);
  }

  public async unsubscribeRealtime(symbol: string, granularity: string): Promise<void> {
    await this.subscriptionManager.unsubscribe(symbol, granularity);
    await this.realtimeDataSource.unsubscribe(symbol, granularity);
  }

  private handleRealtimeCandle(candle: CandleData, metadata: any): void {
    if (candle.symbol !== this.symbol) return;
    
    // Process through aggregator
    const processedCandle = this.candleAggregator.processCandle(candle, this.currentGranularity);
    
    if (processedCandle) {
      // Update current data
      this.updateCurrentData(processedCandle, true);
      
      // Notify subscribers
      this.notifySubscribers([processedCandle], true, metadata);
    }
  }

  private updateCurrentData(newCandle: CandleData, isRealtime: boolean): void {
    if (!this.currentData || this.currentData.length === 0) {
      this.currentData = [newCandle];
      return;
    }
    
    const lastCandle = this.currentData[this.currentData.length - 1];
    
    if (newCandle.time === lastCandle.time) {
      // Update existing candle
      this.currentData[this.currentData.length - 1] = newCandle;
    } else if (newCandle.time > lastCandle.time) {
      // Add new candle
      this.currentData.push(newCandle);
      
      // Trim if needed
      if (this.currentData.length > this.maxCandles) {
        this.currentData = this.currentData.slice(-this.maxCandles);
      }
      
      // Update visible range if auto-update is enabled
      if (this.autoUpdateRange && isRealtime) {
        this.updateVisibleRange();
      }
    }
  }

  private updateVisibleRange(): void {
    if (!this.visibleRange || this.currentData.length === 0) return;
    
    const lastCandle = this.currentData[this.currentData.length - 1];
    const rangeWidth = this.visibleRange.end - this.visibleRange.start;
    
    this.visibleRange = {
      start: lastCandle.time - rangeWidth + 60, // Add 60 seconds to keep current candle visible
      end: lastCandle.time + 60
    };
  }

  private notifySubscribers(data: CandleData[], isNew = false, metadata?: any): void {
    this.subscribers.forEach(callback => {
      if (Array.isArray(data)) {
        data.forEach(candle => callback(candle, isNew, metadata));
      } else {
        callback(data, isNew, metadata);
      }
    });
  }

  private notifyConnectionStatus(connected: boolean): void {
    this.subscribers.forEach(callback => {
      callback({} as CandleData, false, { type: 'connection', connected });
    });
  }

  private handleGranularityChange(granularity: string): void {
    if (this.granularityChangeCallback) {
      this.granularityChangeCallback(granularity);
    }
  }

  // Public API methods
  public setGranularityChangeCallback(callback: (granularity: string) => void): void {
    this.granularityChangeCallback = callback;
  }

  public getCurrentData(): CandleData[] {
    return this.currentData;
  }

  public getVisibleRange(): { start: number; end: number } | null {
    return this.visibleRange;
  }

  public setAutoUpdateRange(enabled: boolean): void {
    this.autoUpdateRange = enabled;
  }

  public setMaxCandles(max: number): void {
    this.maxCandles = max;
  }

  public isConnected(): boolean {
    return this.wsConnected;
  }

  public async changeGranularity(granularity: string): Promise<void> {
    if (this.currentGranularity === granularity) return;
    
    this.isTransitioning = true;
    
    try {
      // Unsubscribe from current granularity
      if (this.symbol && this.currentGranularity) {
        await this.unsubscribeRealtime(this.symbol, this.currentGranularity);
      }
      
      // Update granularity
      this.currentGranularity = granularity;
      this.granularityManager.setCurrentGranularity(granularity);
      
      // Subscribe to new granularity
      if (this.symbol) {
        await this.subscribeRealtime(this.symbol, granularity);
      }
      
      
    } catch (error) {
      throw error;
    } finally {
      this.isTransitioning = false;
    }
  }

  public async cleanup(): Promise<void> {
    
    // Clear timers
    if (this.granularityDebounceTimer) {
      clearTimeout(this.granularityDebounceTimer);
    }
    
    // Abort pending operations
    this.pendingLoadOperations.forEach(controller => controller.abort());
    this.pendingLoadOperations.clear();
    
    // Cleanup services
    await this.subscriptionManager.cleanup();
    await this.realtimeDataSource.cleanup();
    
    // Clear state
    this.subscribers.clear();
    this.loadingPromises.clear();
    this.instanceLoadCounts.clear();
    
  }

  public static resetInstance(): void {
    if (ChartDataOrchestrator.instance) {
      ChartDataOrchestrator.instance.cleanup();
      ChartDataOrchestrator.instance = null;
    }
  }
}