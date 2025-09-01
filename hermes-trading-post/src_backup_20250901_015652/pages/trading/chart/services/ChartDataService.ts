import type { CandlestickData, Time } from 'lightweight-charts';
import type { Candle, DataRequest, PriceUpdate, WebSocketCandle } from '../types/data.types';
import type { ChartRange } from '../types/chart.types';
import { ChartAPIService } from './ChartAPIService';
import { ChartCacheService } from './ChartCacheService';
import { RealtimeCandleAggregator } from '../utils/RealtimeCandleAggregator';
import { ChartDebug } from '../utils/debug';
import { perfTest } from '../utils/performanceTest';

export class ChartDataService {
  private apiService: ChartAPIService;
  private cacheService: ChartCacheService;
  private realtimeAggregator: RealtimeCandleAggregator;
  private currentPair: string = 'BTC-USD';
  private currentGranularity: string = '1m';
  private realtimeSubscription: any = null;

  constructor() {
    this.apiService = new ChartAPIService();
    this.cacheService = new ChartCacheService();
    this.realtimeAggregator = new RealtimeCandleAggregator();
  }

  async initialize(pair: string, granularity: string) {
    this.currentPair = pair;
    this.currentGranularity = granularity;
    await this.apiService.initialize();
  }

  async fetchHistoricalData(
    startTime: number, 
    endTime: number,
    useCache: boolean = true
  ): Promise<CandlestickData[]> {
    const cacheKey = this.cacheService.generateKey(
      this.currentPair,
      this.currentGranularity,
      startTime,
      endTime
    );

    // Check cache first if enabled
    if (useCache) {
      perfTest.mark('cache-check-start');
      
      if (this.currentGranularity === '1d') {
        ChartDebug.critical(`[PERF] Checking cache for 1d data`);
      }
      
      const cachedData = await this.cacheService.get(cacheKey);
      perfTest.measure('Cache check', 'cache-check-start');
      
      if (cachedData) {
        ChartDebug.log(`Cache hit for ${cacheKey}`);
        if (this.currentGranularity === '1d') {
          ChartDebug.critical(`[PERF] Cache HIT! Using ${cachedData.length} cached candles`);
        }
        return this.transformToChartData(cachedData);
      } else {
        if (this.currentGranularity === '1d') {
          ChartDebug.critical(`[PERF] Cache MISS! Will fetch from API`);
        }
      }
    }

    // Fetch from API
    ChartDebug.log(`Fetching data from API for ${this.currentPair}/${this.currentGranularity}`);
    
    // Debug for 3M/1d
    if (this.currentGranularity === '1d') {
      const expectedCandles = Math.ceil((endTime - startTime) / 86400);
      ChartDebug.critical(`Fetching historical data for 1d granularity:`);
      ChartDebug.critical(`- Expected candles based on time range: ${expectedCandles}`);
      ChartDebug.critical(`- Start: ${new Date(startTime * 1000).toISOString()}`);
      ChartDebug.critical(`- End: ${new Date(endTime * 1000).toISOString()}`);
    }
    
    const request: DataRequest = {
      pair: this.currentPair,
      granularity: this.currentGranularity,
      start: startTime,
      end: endTime
    };

    perfTest.mark('api-fetch-start');
    const data = await this.apiService.fetchCandles(request);
    perfTest.measure('API fetch total', 'api-fetch-start');
    
    // Debug response for 1d
    if (this.currentGranularity === '1d') {
      ChartDebug.critical(`API returned ${data.length} candles for 1d granularity`);
      if (data.length < 90 && (endTime - startTime) >= 7776000) { // 90 days
        ChartDebug.critical(`WARNING: Less than 90 candles returned for 3M timeframe!`);
      }
    }
    
    // Cache the result
    if (useCache && data.length > 0) {
      perfTest.mark('cache-set-start');
      await this.cacheService.set(cacheKey, data);
      perfTest.measure('Cache set', 'cache-set-start');
    }

    return this.transformToChartData(data);
  }

  async getDataForVisibleRange(
    visibleFrom: number,
    visibleTo: number,
    bufferRatio: number = 0.2
  ): Promise<CandlestickData[]> {
    // Calculate buffer for smooth scrolling
    const range = visibleTo - visibleFrom;
    const buffer = range * bufferRatio;
    const dataStart = Math.floor(visibleFrom - buffer);
    const dataEnd = Math.ceil(visibleTo + buffer);

    return this.fetchHistoricalData(dataStart, dataEnd);
  }

  subscribeToRealtime(
    onUpdate: (update: WebSocketCandle) => void,
    onError?: (error: Error) => void,
    onReconnect?: () => void
  ): () => void {
    // Clean up existing subscription
    this.unsubscribeFromRealtime();

    // Set up new subscription
    this.realtimeSubscription = this.apiService.subscribeToWebSocket(
      this.currentPair,
      this.currentGranularity,
      (candle: WebSocketCandle) => {
        // Aggregate updates
        const aggregated = this.realtimeAggregator.addUpdate(candle);
        if (aggregated) {
          onUpdate(aggregated);
        }
      },
      onError,
      onReconnect
    );

    // Return unsubscribe function
    return () => this.unsubscribeFromRealtime();
  }

  unsubscribeFromRealtime() {
    if (this.realtimeSubscription) {
      this.realtimeSubscription.unsubscribe();
      this.realtimeSubscription = null;
    }
    this.realtimeAggregator.reset();
  }

  async reloadData(range: ChartRange): Promise<CandlestickData[]> {
    // Clear cache for current data
    await this.cacheService.clearForPair(this.currentPair);
    
    // Fetch fresh data
    return this.fetchHistoricalData(
      Number(range.from),
      Number(range.to),
      false // Don't use cache for reload
    );
  }

  setPair(pair: string) {
    if (pair !== this.currentPair) {
      this.currentPair = pair;
      this.realtimeAggregator.reset();
    }
  }

  setGranularity(granularity: string) {
    if (granularity !== this.currentGranularity) {
      this.currentGranularity = granularity;
      this.realtimeAggregator.reset();
    }
  }

  private transformToChartData(candles: Candle[]): CandlestickData[] {
    return candles
      .filter(candle => this.isValidCandle(candle))
      .map(candle => ({
        time: candle.time as Time,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        volume: candle.volume
      }))
      .sort((a, b) => (a.time as number) - (b.time as number));
  }

  private isValidCandle(candle: Candle): boolean {
    return (
      candle &&
      typeof candle.time === 'number' &&
      typeof candle.open === 'number' &&
      typeof candle.high === 'number' &&
      typeof candle.low === 'number' &&
      typeof candle.close === 'number' &&
      !isNaN(candle.open) &&
      !isNaN(candle.high) &&
      !isNaN(candle.low) &&
      !isNaN(candle.close)
    );
  }

  async clearCache() {
    await this.cacheService.clearAll();
  }

  getCacheStatus() {
    return this.cacheService.getStatus();
  }

  destroy() {
    this.unsubscribeFromRealtime();
    this.apiService.destroy();
  }
}