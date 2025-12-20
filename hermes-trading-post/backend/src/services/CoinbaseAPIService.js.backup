/**
 * Coinbase Advanced Trade API Service for fetching historical candle data
 * 🚀 UPGRADED from Exchange API to Advanced Trade API (2025)
 *
 * Advanced Trade API supports additional granularities:
 * - ONE_MINUTE (60s)
 * - FIVE_MINUTE (300s)
 * - FIFTEEN_MINUTE (900s)
 * - THIRTY_MINUTE (1800s) ✅ Now supported
 * - ONE_HOUR (3600s)
 * - TWO_HOUR (7200s) ✅ Now supported
 * - FOUR_HOUR (14400s) ✅ Now supported
 * - SIX_HOUR (21600s)
 * - ONE_DAY (86400s)
 */

import axios from 'axios';

export class CoinbaseAPIService {
  constructor() {
    // 🚀 Upgraded to Advanced Trade API with better support and higher rate limits
    this.baseURL = 'https://api.coinbase.com/api/v3/brokerage';
    this.rateLimitDelay = 100; // 10 requests per second (better rate limits than Exchange API)
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
   * Convert granularity seconds to Advanced Trade API enum string
   * @param {number} granularitySeconds - e.g., 60, 300, 900, etc.
   * @returns {string} Enum like "ONE_MINUTE", "FIVE_MINUTE", etc.
   */
  secondsToGranularityEnum(granularitySeconds) {
    const map = {
      60: 'ONE_MINUTE',
      300: 'FIVE_MINUTE',
      900: 'FIFTEEN_MINUTE',
      1800: 'THIRTY_MINUTE',
      3600: 'ONE_HOUR',
      7200: 'TWO_HOUR',
      14400: 'FOUR_HOUR',
      21600: 'SIX_HOUR',
      86400: 'ONE_DAY'
    };
    return map[granularitySeconds] || 'UNKNOWN_GRANULARITY';
  }

  /**
   * Fetch historical candles from Coinbase Advanced Trade API
   * @param {string} productId - e.g., 'BTC-USD'
   * @param {number} granularity - granularity in seconds (60, 300, 900, 1800, 3600, 7200, 14400, 21600, 86400)
   * @param {string} start - ISO timestamp
   * @param {string} end - ISO timestamp
   * @returns {Promise<Array>} Array of candles
   */
  async getCandles(productId, granularity, start, end) {
    await this.rateLimit();

    try {
      const granularityEnum = this.secondsToGranularityEnum(granularity);

      const params = new URLSearchParams({
        start,
        end,
        granularity: granularityEnum
      });

      // Advanced Trade API endpoint
      const url = `${this.baseURL}/products/${productId}/candles?${params}`;

      const response = await axios.get(url, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Hermes-Trading-Post/1.0'
        }
      });

      // Advanced Trade returns array format: [timestamp, open, high, low, close, volume]
      // Note: Order differs from Exchange API - high/low positions swapped
      const candles = response.data.map(candle => ({
        time: candle[0],
        open: candle[1],
        high: candle[2],
        low: candle[3],
        close: candle[4],
        volume: candle[5]
      }));

      return candles;

    } catch (error) {
      if (error.response?.status === 429) {
        // Advanced Trade API has higher limits but still respect them
        console.warn('⚠️ Rate limited by Coinbase API, backing off...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        throw new Error('Rate limited');
      }

      throw error;
    }
  }

  /**
   * Convert granularity string to seconds
   * Now supports ALL Coinbase Advanced Trade granularities
   */
  granularityToSeconds(granularity) {
    const map = {
      '1m': 60,
      '5m': 300,
      '15m': 900,
      '30m': 1800,    // ✅ Now supported
      '1h': 3600,
      '2h': 7200,     // ✅ Now supported
      '4h': 14400,    // ✅ Now supported
      '6h': 21600,
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