/**
 * @file market.ts
 * @description Market data types - candles, tickers, price updates
 */

import type { SupportedTradingPair } from './core';

// ============================
// Candle Data Types
// ============================

/**
 * OHLCV candle data (unified interface)
 * Use this for all candle data throughout the application
 */
export interface CandleData {
  time: number;                   // Unix timestamp in seconds
  open: number;                   // Opening price
  high: number;                   // Highest price
  low: number;                    // Lowest price
  close: number;                  // Closing price
  volume: number;                 // Trading volume
}

/**
 * Alias for backward compatibility
 * @deprecated Use CandleData instead
 */
export type Candle = CandleData;

/**
 * Aggregated candle with metadata for real-time updates
 */
export interface AggregatedCandle extends CandleData {
  updateCount: number;            // Number of updates received
  isComplete: boolean;            // Whether candle is finalized
}

/**
 * WebSocket candle with type indicator
 */
export interface WebSocketCandle extends CandleData {
  type: 'historical' | 'current' | 'update';
}

// ============================
// Price Update Types
// ============================

/**
 * Real-time price update
 */
export interface PriceUpdate {
  time: number;                   // Unix timestamp
  price: number;                  // Current price
  volume?: number;                // Optional volume
  pair: string;                   // Trading pair (e.g., "BTC-USD")
}

/**
 * Market data snapshot
 */
export interface MarketData {
  symbol: SupportedTradingPair;
  price: number;
  volume: number;
  timestamp: string;
  priceChange24h?: number;
  priceChangePercent24h?: number;
}

// ============================
// Ticker Types
// ============================

/**
 * Ticker message (basic)
 */
export interface TickerData {
  type: 'ticker';
  sequence: number;
  product_id: string;
  price?: string;
  time?: string;
  open_24h?: string;
  volume_24h?: string;
  low_24h?: string;
  high_24h?: string;
  volume_30d?: string;
  best_bid?: string;
  best_ask?: string;
}

// ============================
// Data Request Types
// ============================

/**
 * Data request parameters
 */
export interface DataRequest {
  pair: string;
  granularity: string;
  start?: number;
  end?: number;
  limit?: number;
}

/**
 * Data cache entry
 */
export interface DataCache {
  key: string;
  data: CandleData[];
  timestamp: number;
  expiresAt: number;
}
