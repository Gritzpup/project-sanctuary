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
    this.exchangeBaseURL = 'https://api.exchange.coinbase.com/products';
    this.rateLimitDelay = 100; // 10 requests per second (better rate limits than Exchange API)
    this.lastRequestTime = 0;
    // Track products that need Exchange API fallback (e.g. PAXG-USD returns 403 on Advanced Trade)
    this.exchangeApiFallbackProducts = new Set();
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
   * 🚀 UPGRADED: Using Advanced Trade API which supports all granularities (30m, 2h, 4h)
   * The market/products endpoint is PUBLIC and doesn't require authentication!
   * @param {string} productId - e.g., 'BTC-USD'
   * @param {number} granularity - granularity in seconds (60, 300, 900, 1800, 3600, 7200, 14400, 21600, 86400)
   * @param {string} start - ISO timestamp
   * @param {string} end - ISO timestamp
   * @returns {Promise<Array>} Array of candles
   */
  async getCandles(productId, granularity, start, end) {
    await this.rateLimit();

    // Skip straight to Exchange API for products known to fail on Advanced Trade
    if (this.exchangeApiFallbackProducts.has(productId)) {
      return this.getCandlesViaExchangeAPI(productId, granularity, start, end);
    }

    try {
      // 🚀 Advanced Trade API - supports ALL granularities including 30m, 2h, 4h
      // The market/products endpoint is PUBLIC (no auth needed for market data)
      // Convert granularity to seconds first (could be string "1m" or number 60)
      const granularitySeconds = typeof granularity === 'string'
        ? this.granularityToSeconds(granularity)
        : granularity;
      const granularityEnum = this.secondsToGranularityEnum(granularitySeconds);
      const url = `${this.baseURL}/market/products/${productId}/candles?start=${start}&end=${end}&granularity=${granularityEnum}`;

      const response = await axios.get(url, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Hermes-Trading-Post/1.0'
        }
      });

      // Advanced Trade API returns: { candles: [{ start, low, high, open, close, volume }] }
      const candles = response.data.candles.map(candle => ({
        time: parseInt(candle.start),
        open: parseFloat(candle.open),
        high: parseFloat(candle.high),
        low: parseFloat(candle.low),
        close: parseFloat(candle.close),
        volume: parseFloat(candle.volume)
      }));

      return candles;

    } catch (error) {
      if (error.response?.status === 429) {
        // Advanced Trade API has higher limits but still respect them
        await new Promise(resolve => setTimeout(resolve, 2000));
        throw new Error('Rate limited');
      }

      // If Advanced Trade API returns 403, fall back to Exchange API
      // Some products (e.g. PAXG-USD) are not available on Advanced Trade but work on Exchange API
      if (error.response?.status === 403) {
        console.warn(`[CoinbaseAPI] Advanced Trade 403 for ${productId}, falling back to Exchange API`);
        this.exchangeApiFallbackProducts.add(productId);
        return this.getCandlesViaExchangeAPI(productId, granularity, start, end);
      }

      throw error;
    }
  }

  /**
   * Fetch candles via the legacy Exchange API (api.exchange.coinbase.com)
   * Used as fallback when Advanced Trade API returns 403 for certain products
   */
  async getCandlesViaExchangeAPI(productId, granularity, start, end) {
    const granularitySeconds = typeof granularity === 'string'
      ? this.granularityToSeconds(granularity)
      : granularity;

    const startISO = new Date(parseInt(start) * 1000).toISOString();
    const endISO = new Date(parseInt(end) * 1000).toISOString();
    const url = `${this.exchangeBaseURL}/${productId}/candles?start=${startISO}&end=${endISO}&granularity=${granularitySeconds}`;

    const response = await axios.get(url, {
      timeout: 10000,
      headers: { 'User-Agent': 'Hermes-Trading-Post/1.0' }
    });

    // Exchange API returns array of [time, low, high, open, close, volume]
    const candles = response.data.map(([time, low, high, open, close, volume]) => ({
      time,
      open: parseFloat(open),
      high: parseFloat(high),
      low: parseFloat(low),
      close: parseFloat(close),
      volume: parseFloat(volume)
    }));

    return candles;
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
   * Fetch candles with pagination for large time ranges.
   * Breaks the range into chunks of 300 candles (under Coinbase's 350 limit)
   * and merges the results.
   */
  async getCandlesPaginated(productId, granularity, start, end) {
    const granularitySeconds = typeof granularity === 'string'
      ? this.granularityToSeconds(granularity) : granularity;
    const maxCandlesPerRequest = 300;
    const timeSpanPerRequest = maxCandlesPerRequest * granularitySeconds;

    let allCandles = [];
    let currentStart = typeof start === 'string' ? parseInt(start) : start;
    const endTime = typeof end === 'string' ? parseInt(end) : end;

    while (currentStart < endTime) {
      const currentEnd = Math.min(currentStart + timeSpanPerRequest, endTime);
      await this.rateLimit();
      try {
        const chunk = await this.getCandles(productId, granularitySeconds,
          currentStart.toString(), currentEnd.toString());
        allCandles.push(...chunk);
      } catch (err) {
        console.warn(`[CoinbaseAPI] Paginated fetch chunk failed (${currentStart}-${currentEnd}): ${err.message}`);
      }
      currentStart = currentEnd;
    }

    return allCandles.sort((a, b) => a.time - b.time);
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