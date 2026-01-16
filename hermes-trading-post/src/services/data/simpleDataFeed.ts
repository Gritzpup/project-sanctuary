// @ts-nocheck - API parameter type compatibility
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
      // Cap endTime to current time
      const now = Math.floor(Date.now() / 1000);
      endTime = Math.min(endTime, now);
      
      // If entire range is in future, return empty
      if (startTime > now) {
        return [];
      }
      
      // Fetch from API
      const candles = await this.api.getCandles(symbol, granularity, startTime, endTime);
      
      return candles;
      
    } catch (error) {
      throw error;
    }
  }
}