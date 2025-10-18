/**
 * Coinbase API Service for fetching historical candle data
 */

import axios from 'axios';

export class CoinbaseAPIService {
  constructor() {
    this.baseURL = 'https://api.exchange.coinbase.com';
    this.rateLimitDelay = 125; // 8 requests per second max
    this.lastRequestTime = 0;
  }

  async rateLimit() {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < this.rateLimitDelay) {
      await new Promise(resolve => setTimeout(resolve, this.rateLimitDelay - timeSinceLastRequest));
    }
    this.lastRequestTime = Date.now();
  }

  /**
   * Fetch historical candles from Coinbase
   * @param {string} productId - e.g., 'BTC-USD'
   * @param {string} granularity - granularity in seconds (60, 300, 900, 3600, 21600, 86400)
   * @param {string} start - ISO timestamp
   * @param {string} end - ISO timestamp
   * @returns {Promise<Array>} Array of candles
   */
  async getCandles(productId, granularity, start, end) {
    await this.rateLimit();

    try {
      const params = new URLSearchParams({
        start,
        end,
        granularity: granularity.toString()
      });

      const url = `${this.baseURL}/products/${productId}/candles?${params}`;

      const response = await axios.get(url, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Hermes-Trading-Post/1.0'
        }
      });

      // Coinbase returns array format: [timestamp, low, high, open, close, volume]
      const candles = response.data.map(candle => ({
        time: candle[0],
        low: candle[1],
        high: candle[2],
        open: candle[3],
        close: candle[4],
        volume: candle[5]
      }));

      return candles;

    } catch (error) {
      if (error.response?.status === 429) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        throw new Error('Rate limited');
      }
      
      throw error;
    }
  }

  /**
   * Convert granularity string to seconds
   */
  granularityToSeconds(granularity) {
    const map = {
      '1m': 60,
      '5m': 300,
      '15m': 900,
      '30m': 1800,
      '1h': 3600,
      '4h': 14400,
      '6h': 21600,
      '12h': 43200,
      '1d': 86400
    };
    return map[granularity] || 60;
  }

  /**
   * Test API connectivity
   */
  async testConnection() {
    try {
      await this.rateLimit();
      const response = await axios.get(`${this.baseURL}/time`, { timeout: 5000 });
      return true;
    } catch (error) {
      return false;
    }
  }
}

// Export singleton instance
export const coinbaseAPI = new CoinbaseAPIService();