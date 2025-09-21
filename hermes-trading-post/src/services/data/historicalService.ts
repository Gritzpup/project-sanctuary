/**
 * @file historicalDataService.ts
 * @description Fetches and caches historical price data
 */

import type { CandleData } from '../../strategies/base/StrategyTypes';

export interface HistoricalDataConfig {
  symbol: string;
  startTime: Date;
  endTime: Date;
  granularity: number; // seconds (60, 300, 900, 3600, 21600, 86400)
}

export class HistoricalDataService {
  private baseUrl = '/api/coinbase';

  async fetchHistoricalData(config: HistoricalDataConfig): Promise<CandleData[]> {
    const { symbol, startTime, endTime, granularity } = config;
    
    // Coinbase has a limit of 300 candles per request
    const maxCandlesPerRequest = 300;
    const timeRangeMs = endTime.getTime() - startTime.getTime();
    const candleIntervalMs = granularity * 1000;
    const totalCandles = Math.floor(timeRangeMs / candleIntervalMs);
    
    const allCandles: CandleData[] = [];
    
    // Calculate how many requests we need
    const requestsNeeded = Math.ceil(totalCandles / maxCandlesPerRequest);
    
    console.log(`Fetching ${totalCandles} candles in ${requestsNeeded} requests...`);
    
    for (let i = 0; i < requestsNeeded; i++) {
      const requestStartTime = new Date(startTime.getTime() + (i * maxCandlesPerRequest * candleIntervalMs));
      const requestEndTime = new Date(Math.min(
        requestStartTime.getTime() + (maxCandlesPerRequest * candleIntervalMs),
        endTime.getTime()
      ));
      
      try {
        const candles = await this.fetchCandlesBatch(
          symbol,
          requestStartTime,
          requestEndTime,
          granularity
        );
        
        allCandles.push(...candles);
        
        // Add a small delay between requests to avoid rate limiting
        if (i < requestsNeeded - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      } catch (error) {
        console.error(`Error fetching batch ${i + 1}/${requestsNeeded}:`, error);
        throw error;
      }
    }
    
    // Sort by time and remove duplicates
    const uniqueCandles = this.removeDuplicates(allCandles);
    return uniqueCandles.sort((a, b) => a.time - b.time);
  }

  private async fetchCandlesBatch(
    symbol: string,
    startTime: Date,
    endTime: Date,
    granularity: number
  ): Promise<CandleData[]> {
    const params = new URLSearchParams({
      start: Math.floor(startTime.getTime() / 1000).toString(),
      end: Math.floor(endTime.getTime() / 1000).toString(),
      granularity: granularity.toString()
    });

    const response = await fetch(
      `${this.baseUrl}/products/${symbol}/candles?${params}`
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch candles: ${response.statusText}`);
    }

    const data = await response.json();
    
    // Convert Coinbase format to our CandleData format
    return data.map((candle: any[]) => ({
      time: candle[0] * 1000, // Convert to milliseconds
      low: candle[1],
      high: candle[2],
      open: candle[3],
      close: candle[4],
      volume: candle[5]
    }));
  }

  private removeDuplicates(candles: CandleData[]): CandleData[] {
    const seen = new Set<number>();
    return candles.filter(candle => {
      if (seen.has(candle.time)) {
        return false;
      }
      seen.add(candle.time);
      return true;
    });
  }

  // Helper method to get optimal granularity for a time range
  static getOptimalGranularity(startTime: Date, endTime: Date): number {
    const diffMs = endTime.getTime() - startTime.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);

    if (diffDays <= 1) return 60;        // 1 minute for 1 day
    if (diffDays <= 7) return 300;       // 5 minutes for 1 week
    if (diffDays <= 30) return 900;      // 15 minutes for 1 month
    if (diffDays <= 90) return 3600;     // 1 hour for 3 months
    if (diffDays <= 365) return 21600;   // 6 hours for 1 year
    return 86400;                         // 1 day for > 1 year
  }
}

// Export singleton instance
export const historicalDataService = new HistoricalDataService();