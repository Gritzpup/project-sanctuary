/**
 * @file simpleDataFeed.ts
 * @description Basic data feed implementation for charts
 */

// Simplified data feed that bypasses caching for testing
import type { CandleData } from '../../types/coinbase';
import { CoinbaseAPI } from '../api/coinbaseApi';

export class SimpleDataFeed {
  private api: CoinbaseAPI;
  
  constructor() {
    this.api = new CoinbaseAPI();
  }
  
  async getCandles(symbol: string, granularity: string, startTime: number, endTime: number): Promise<CandleData[]> {
    try {
      console.log('SimpleDataFeed fetching candles:', {
        symbol,
        granularity,
        startTime: new Date(startTime * 1000).toISOString(),
        endTime: new Date(endTime * 1000).toISOString()
      });
      
      // Cap endTime to current time
      const now = Math.floor(Date.now() / 1000);
      endTime = Math.min(endTime, now);
      
      // If entire range is in future, return empty
      if (startTime > now) {
        console.log('Entire range is in future, returning empty');
        return [];
      }
      
      // Fetch from API
      const candles = await this.api.getCandles(symbol, granularity, startTime, endTime);
      console.log(`API returned ${candles.length} candles`);
      
      return candles;
      
    } catch (error) {
      console.error('SimpleDataFeed error:', error);
      throw error;
    }
  }
}