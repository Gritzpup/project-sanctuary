/**
 * @file coinbaseApi.ts
 * @description Handles Coinbase API requests for market data and trading
 */

import axios from 'axios';
import type { CandleData } from '../types/coinbase';
import { RateLimiter } from './rateLimiter';

export class CoinbaseAPI {
  private baseUrl = import.meta.env.DEV ? '/api/coinbase' : 'https://api.exchange.coinbase.com';
  private rateLimiter = new RateLimiter(10, 3); // 10 requests per second, max 3 concurrent
  
  constructor() {
    // Add response error interceptor only
    axios.interceptors.response.use(
      response => response,
      error => {
        console.error('API Error:', error.message);
        if (error.response) {
          console.error('Response data:', error.response.data);
          console.error('Response status:', error.response.status);
        }
        return Promise.reject(error);
      }
    );
  }

  async getCandles(
    productId: string = 'BTC-USD',
    granularity: number = 60, // 1 minute
    start?: string,
    end?: string
  ): Promise<CandleData[]> {
    // Create a unique key for this request for rate limiting
    const key = `candles-${productId}-${granularity}-${start || 'latest'}-${end || 'now'}`;
    
    return this.rateLimiter.execute(key, async () => {
      
      // Validate time range to prevent future data requests
      const now = Math.floor(Date.now() / 1000);
      if (end && parseInt(end) > now) {
        console.warn(`Attempted to fetch future data. Capping end time at now.`);
        end = now.toString();
      }
      
      if (start && parseInt(start) > now) {
        console.warn(`Start time is in the future. Returning empty array.`);
        return [];
      }
      
      const params: any = {
        granularity
      };

      // Ensure timestamps are integers (no decimals)
      if (start) params.start = Math.floor(parseFloat(start)).toString();
      if (end) params.end = Math.floor(parseFloat(end)).toString();

      const url = `${this.baseUrl}/products/${productId}/candles`;
      
      const response = await axios.get(url, { params });
      
      // Coinbase returns candles in reverse chronological order
      // Format: [timestamp, price_low, price_high, price_open, price_close, volume]
      const candles = response.data.reverse().map((candle: number[]) => ({
        time: candle[0], // Already in seconds
        open: candle[3],
        high: candle[2],
        low: candle[1],
        close: candle[4],
        volume: candle[5]
      }));
      
      return candles;
    }).catch(error => {
      if (axios.isAxiosError(error) && error.response?.status !== 429) {
        console.error('Coinbase API error:', error.response?.status, error.response?.data);
      }
      throw error;
    });
  }

  async getTicker(productId: string = 'BTC-USD'): Promise<number> {
    const key = `ticker-${productId}`;
    
    return this.rateLimiter.execute(key, async () => {
      const response = await axios.get(`${this.baseUrl}/products/${productId}/ticker`);
      return parseFloat(response.data.price);
    }).catch(error => {
      console.error('Error fetching Coinbase ticker:', error);
      throw error;
    });
  }

  async getRecentCandles(
    productId: string = 'BTC-USD',
    granularity: number = 60,
    minutes: number = 2
  ): Promise<CandleData[]> {
    // Fetch recent candles for API synchronization
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - (minutes * 60000));
    
    return this.getCandles(
      productId,
      granularity,
      startTime.toISOString(),
      endTime.toISOString()
    );
  }
}