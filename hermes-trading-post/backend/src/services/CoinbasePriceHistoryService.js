/**
 * Price History Backfill Service
 *
 * Uses CryptoCompare free API for full 5Y daily OHLCV candle history.
 * CryptoCompare has real OHLCV + volume for all our pairs (BTC, ETH, PAXG)
 * going back 5.5+ years — unlike Coinbase which only has ~291 days for PAXG.
 *
 * Falls back to Coinbase Exchange API for recent data overlay.
 */

import { redisCandleStorage } from './redis/RedisCandleStorage.js';

/**
 * Fetch daily OHLCV candles from CryptoCompare (free, no auth needed).
 * Returns up to `limit` daily candles ending at today, sorted oldest-first.
 *
 * @param {string} pair - e.g. 'PAXG-USD' or 'BTC-USD'
 * @param {number} limit - max candles (2000 = ~5.5 years)
 * @returns {Array<{time, open, high, low, close, volume}>}
 */
async function fetchCryptoCompareDaily(pair, limit = 2000) {
  // Convert pair format: 'PAXG-USD' → fsym=PAXG, tsym=USD
  const [fsym, tsym] = pair.split('-');
  const url = `https://min-api.cryptocompare.com/data/v2/histoday?fsym=${fsym}&tsym=${tsym}&limit=${limit}`;

  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Hermes-Trading-Post/1.0' }
    });

    if (!response.ok) {
      console.warn(`[CryptoCompare] HTTP ${response.status} for ${pair}`);
      return [];
    }

    const json = await response.json();
    const data = json?.Data?.Data;

    if (!Array.isArray(data) || data.length === 0) {
      console.warn(`[CryptoCompare] No data returned for ${pair}`);
      return [];
    }

    // Filter out zero-price entries and convert to our candle format
    return data
      .filter(c => c.close > 0)
      .map(c => ({
        time: c.time,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: c.volumeto || 0  // volumeto = volume in quote currency (USD)
      }));

  } catch (err) {
    console.error(`[CryptoCompare] Failed to fetch ${pair}: ${err.message}`);
    return [];
  }
}

/**
 * Backfill daily OHLCV candle data for a pair using CryptoCompare.
 * Provides real OHLCV + volume for 5.5 years for all pairs including PAXG.
 *
 * @param {string} pair - e.g. 'PAXG-USD'
 * @returns {number} number of new candles added
 */
export async function backfillDailyHistory(pair) {
  console.log(`[PriceHistory] Backfilling daily history for ${pair} from CryptoCompare...`);

  const now = Math.floor(Date.now() / 1000);
  const fiveYearsAgo = now - (5 * 365 * 24 * 60 * 60);

  // Fetch ~5.5 years of real daily OHLCV from CryptoCompare
  const candles = await fetchCryptoCompareDaily(pair, 2000);

  if (candles.length === 0) {
    console.warn(`[PriceHistory] No CryptoCompare data for ${pair}`);
    return 0;
  }

  // Filter to our 5-year window
  const filtered = candles.filter(c => c.time >= fiveYearsAgo);

  console.log(`[PriceHistory] Got ${filtered.length} daily candles for ${pair} (${new Date(filtered[0]?.time * 1000).toISOString().slice(0, 10)} to ${new Date(filtered[filtered.length - 1]?.time * 1000).toISOString().slice(0, 10)})`);

  // Check what already exists in Redis to avoid duplicates
  const existing = await redisCandleStorage.getCandles(pair, '1d', fiveYearsAgo, now);
  const existingTimes = new Set(existing.map(c => c.time));
  const newCandles = filtered.filter(c => !existingTimes.has(c.time));

  if (newCandles.length > 0) {
    await redisCandleStorage.storeCandles(pair, '1d', newCandles);
    console.log(`[PriceHistory] Stored ${newCandles.length} new daily candles for ${pair} (${existing.length} already existed)`);
    return newCandles.length;
  }

  console.log(`[PriceHistory] All ${filtered.length} daily candles already exist for ${pair}`);
  return 0;
}
