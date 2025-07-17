import type { CandlestickData, Time } from 'lightweight-charts';
import type { Candle, DataRequest, PriceUpdate, WebSocketCandle } from '../types/data.types';
import type { ChartRange } from '../types/chart.types';
import { ChartAPIService } from './ChartAPIService';
import { ChartCacheService } from './ChartCacheService';
import { RealtimeCandleAggregator } from '../utils/RealtimeCandleAggregator';

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
      const cachedData = await this.cacheService.get(cacheKey);
      if (cachedData) {
        console.log(`ChartDataService: Cache hit for ${cacheKey}`);
        return this.transformToChartData(cachedData);
      }
    }

    // Fetch from API
    console.log(`ChartDataService: Fetching data from API for ${this.currentPair}/${this.currentGranularity}`);
    const request: DataRequest = {
      pair: this.currentPair,
      granularity: this.currentGranularity,
      start: startTime,
      end: endTime
    };

    const data = await this.apiService.fetchCandles(request);
    
    // Cache the result
    if (useCache && data.length > 0) {
      await this.cacheService.set(cacheKey, data);
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
    onError?: (error: Error) => void
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
      onError
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