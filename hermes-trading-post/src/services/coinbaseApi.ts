import axios from 'axios';
import type { CandleData } from '../types/coinbase';

export class CoinbaseAPI {
  private baseUrl = import.meta.env.DEV ? '/api/coinbase' : 'https://api.exchange.coinbase.com';
  
  constructor() {
    console.log('CoinbaseAPI initialized with baseUrl:', this.baseUrl);
    
    // Add request interceptor for debugging
    axios.interceptors.request.use(request => {
      console.log('Starting Request:', request.url);
      return request;
    });
    
    axios.interceptors.response.use(
      response => {
        console.log('Response:', response.status, 'for', response.config.url);
        return response;
      },
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
    try {
      console.log('Fetching candles from Coinbase...');
      console.log('Product ID:', productId);
      console.log('Granularity:', granularity);
      
      const params: any = {
        granularity
      };

      if (start) params.start = start;
      if (end) params.end = end;

      const url = `${this.baseUrl}/products/${productId}/candles`;
      console.log('Requesting:', url, 'with params:', params);
      
      const response = await axios.get(url, { params });
      
      console.log('Coinbase response:', response.data.length, 'candles');
      
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
      
      console.log('Processed candles:', candles.slice(-5)); // Show last 5
      return candles;
    } catch (error) {
      console.error('Error fetching Coinbase candles:', error);
      if (axios.isAxiosError(error)) {
        console.error('Response:', error.response?.data);
        console.error('Status:', error.response?.status);
        console.error('Headers:', error.response?.headers);
        console.error('Config:', error.config);
      }
      throw error;
    }
  }

  async getTicker(productId: string = 'BTC-USD'): Promise<number> {
    try {
      const response = await axios.get(`${this.baseUrl}/products/${productId}/ticker`);
      return parseFloat(response.data.price);
    } catch (error) {
      console.error('Error fetching Coinbase ticker:', error);
      throw error;
    }
  }
}