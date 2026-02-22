// src/services/coinbaseAdvancedTradeHistoryService.js
// Delegates to CoinbaseAPIService which handles Advanced Trade API with Exchange API fallback

import { coinbaseAPI } from './CoinbaseAPIService.js';

/**
 * Fetches historical OHLCV candles with pagination, delegating to CoinbaseAPIService.
 * CoinbaseAPIService handles the Advanced Trade API → Exchange API fallback automatically.
 *
 * @param {string} pair - The trading pair (e.g., 'BTC-USD').
 * @param {string} granularityStr - The granularity as a string (e.g., '1d').
 * @param {number} startTime - Unix timestamp in seconds for the start of the period.
 * @param {number} endTime - Unix timestamp in seconds for the end of the period.
 * @returns {Promise<Array<{time: number, low: number, high: number, open: number, close: number, volume: number}>>}
 */
export async function fetchPaginatedCandles(pair, granularityStr, startTime, endTime) {
  console.log(`[CoinbaseAdvTradeHistory] Fetching paginated candles for ${pair}, ${granularityStr} from ${startTime} to ${endTime}`);

  try {
    const candles = await coinbaseAPI.getCandlesPaginated(
      pair, granularityStr, startTime.toString(), endTime.toString()
    );

    // Deduplicate and sort
    const uniqueCandles = Array.from(new Map(candles.map(c => [c.time, c])).values());
    uniqueCandles.sort((a, b) => a.time - b.time);

    console.log(`[CoinbaseAdvTradeHistory] Total unique candles fetched: ${uniqueCandles.length}`);
    return uniqueCandles;
  } catch (err) {
    console.error(`[CoinbaseAdvTradeHistory] Error fetching candles for ${pair}: ${err.message}`);
    return [];
  }
}
