// @ts-nocheck - Implicit any in map callback
import type { CandleData } from '../../../types/coinbase';
import { coinbaseAPI } from '../../api';

export class HistoricalDataSource {
  private requestQueue: Array<() => Promise<any>> = [];
  private isProcessingQueue = false;
  private maxConcurrentRequests = 3;
  private activeRequests = 0;

  public async getData(
    symbol: string, 
    granularity: string, 
    startTime: number, 
    endTime: number
  ): Promise<CandleData[]> {
    return new Promise((resolve, reject) => {
      this.requestQueue.push(async () => {
        try {
          const data = await this.fetchHistoricalData(symbol, granularity, startTime, endTime);
          resolve(data);
        } catch (error) {
          reject(error);
        }
      });
      
      this.processQueue();
    });
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.activeRequests >= this.maxConcurrentRequests) {
      return;
    }
    
    this.isProcessingQueue = true;
    
    while (this.requestQueue.length > 0 && this.activeRequests < this.maxConcurrentRequests) {
      const request = this.requestQueue.shift();
      if (request) {
        this.activeRequests++;
        request().finally(() => {
          this.activeRequests--;
          this.processQueue();
        });
      }
    }
    
    this.isProcessingQueue = false;
  }

  private async fetchHistoricalData(
    symbol: string,
    granularity: string,
    startTime: number,
    endTime: number
  ): Promise<CandleData[]> {
    try {
      
      // Convert timestamps to appropriate format
      const start = new Date(startTime * 1000);
      const end = new Date(endTime * 1000);
      
      // Fetch data from Coinbase API
      const candles = await coinbaseAPI.getHistoricalRates(
        symbol,
        start,
        end,
        granularity as any
      );
      
      // Convert to our format
      const candleData: CandleData[] = candles.map(candle => ({
        symbol,
        time: candle.time,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        volume: candle.volume
      }));
      
      // Sort by time (oldest first)
      candleData.sort((a, b) => a.time - b.time);
      
      return candleData;
      
    } catch (error) {
      
      // Return empty array on error to prevent cascading failures
      return [];
    }
  }

  // Batch fetch for multiple requests
  public async getBatchData(
    requests: Array<{
      symbol: string;
      granularity: string;
      startTime: number;
      endTime: number;
    }>
  ): Promise<CandleData[][]> {
    const promises = requests.map(request => 
      this.getData(request.symbol, request.granularity, request.startTime, request.endTime)
    );
    
    return Promise.allSettled(promises).then(results => 
      results.map(result => 
        result.status === 'fulfilled' ? result.value : []
      )
    );
  }

  // Check data availability for a given range
  public async checkDataAvailability(
    symbol: string,
    granularity: string,
    startTime: number,
    endTime: number
  ): Promise<{ available: boolean; gaps: Array<{ start: number; end: number }> }> {
    try {
      // For simplicity, assume data is always available from Coinbase
      // In a production system, you might check for known gaps or API limits
      const now = Math.floor(Date.now() / 1000);
      const maxHistoryDays = 300; // Coinbase typical limit
      const maxHistoryTime = now - (maxHistoryDays * 24 * 60 * 60);
      
      if (startTime < maxHistoryTime) {
        return {
          available: false,
          gaps: [{ start: startTime, end: Math.min(endTime, maxHistoryTime) }]
        };
      }
      
      return { available: true, gaps: [] };
      
    } catch (error) {
      return { available: false, gaps: [{ start: startTime, end: endTime }] };
    }
  }

  // Get the latest available data timestamp
  public async getLatestDataTimestamp(symbol: string, granularity: string): Promise<number> {
    try {
      const ticker = await coinbaseAPI.getTicker(symbol);
      return new Date(ticker.time).getTime() / 1000;
    } catch (error) {
      return Math.floor(Date.now() / 1000);
    }
  }

  // Validate granularity support
  public isGranularitySupported(granularity: string): boolean {
    const supportedGranularities = ['1m', '5m', '15m', '1h', '6h', '1d'];
    return supportedGranularities.includes(granularity);
  }

  // Get optimal chunk size for data fetching based on granularity
  public getOptimalChunkSize(granularity: string): number {
    const chunkSizes: Record<string, number> = {
      '1m': 300,   // 5 hours
      '5m': 288,   // 24 hours
      '15m': 96,   // 24 hours
      '1h': 168,   // 1 week
      '6h': 120,   // 30 days
      '1d': 365    // 1 year
    };

    return chunkSizes[granularity] || 100;
  }

  public getQueueStatus(): { queued: number; active: number } {
    return {
      queued: this.requestQueue.length,
      active: this.activeRequests
    };
  }
}