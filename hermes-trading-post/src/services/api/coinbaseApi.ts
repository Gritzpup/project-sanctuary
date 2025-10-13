/**
 * @file coinbaseApi.ts
 * @description Handles Coinbase API requests for market data and trading
 */

import axios from 'axios';
import type { CandleData } from '../../types/coinbase';
import { RateLimiter } from './rateLimiter';
import { logger } from '../logging';

export class CoinbaseAPI {
  private baseUrl = 'https://api.exchange.coinbase.com'; // Direct API access
  private rateLimiter = new RateLimiter(10, 3); // 10 requests per second, max 3 concurrent
  
  constructor() {
    // Add response error interceptor only
    axios.interceptors.response.use(
      response => response,
      error => {
        logger.error( 'API Error', { 
          message: error.message,
          responseData: error.response?.data,
          responseStatus: error.response?.status
        });
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
        logger.warn( 'Attempted to fetch future data. Capping end time at now.');
        end = now.toString();
      }
      
      if (start && parseInt(start) > now) {
        logger.warn( 'Start time is in the future. Returning empty array.');
        return [];
      }
      
      const params: any = {
        granularity
      };

      // Ensure timestamps are integers (no decimals)
      if (start) params.start = Math.floor(parseFloat(start)).toString();
      if (end) params.end = Math.floor(parseFloat(end)).toString();

      const url = `${this.baseUrl}/products/${productId}/candles`;
      
      const response = await axios.get(url, { 
        params,
        timeout: 15000,
        headers: {
          'Accept': 'application/json',
        }
      });
      
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
      logger.error( 'API request failed', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data
      });
      throw error;
    });
  }

  async getTicker(productId: string = 'BTC-USD'): Promise<number> {
    const key = `ticker-${productId}`;
    
    return this.rateLimiter.execute(key, async () => {
      const response = await axios.get(`${this.baseUrl}/products/${productId}/ticker`);
      return parseFloat(response.data.price);
    }).catch(error => {
      logger.error( 'Error fetching ticker', { productId, error: error.message });
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

  async get24hStats(productId: string = 'BTC-USD'): Promise<{
    open: number;
    high: number;
    low: number;
    last: number;
    volume: number;
    volume_30day: number;
    priceChange24h: number;
    priceChangePercent24h: number;
  }> {
    // Clean up - removed debug logging
    const key = `stats-24h-${productId}`;
    
    return this.rateLimiter.execute(key, async () => {
      const response = await axios.get(`${this.baseUrl}/products/${productId}/stats`, {
        timeout: 10000,
        headers: {
          'Accept': 'application/json',
        }
      });
      
      const stats = response.data;
      const open = parseFloat(stats.open);
      const last = parseFloat(stats.last);
      const priceChange24h = last - open;
      const priceChangePercent24h = (priceChange24h / open) * 100;
      
      const result = {
        open,
        high: parseFloat(stats.high),
        low: parseFloat(stats.low),
        last,
        volume: parseFloat(stats.volume),
        volume_30day: parseFloat(stats.volume_30day),
        priceChange24h,
        priceChangePercent24h
      };
      
      // Clean up - removed verbose logging
      
      return result;
    }).catch(error => {
      logger.error( 'Failed to fetch 24h stats', {
        productId,
        message: error.message,
        status: error.response?.status,
        data: error.response?.data
      });
      throw error;
    });
  }
}