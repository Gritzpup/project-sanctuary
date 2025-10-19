/**
 * @file CandleTypes.ts
 * @description Core types for candle storage and management
 */

/**
 * A single candle with OHLCV data
 */
export interface StoredCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/**
 * Metadata for a pair/granularity combination
 * Tracks data coverage and last update time
 */
export interface CandleMetadata {
  pair: string;
  granularity: string;
  firstTimestamp: number;
  lastTimestamp: number;
  totalCandles: number;
  lastUpdated: number;
}

/**
 * Time range for querying candles
 */
export interface CandleRange {
  start: number;
  end: number;
  granularity: string;
  pair: string;
}

/**
 * Checkpoint for data validation
 */
export interface Checkpoint {
  timestamp: number;
  candleCount: number;
  lastPrice: number;
  checksum: string;
}

/**
 * Compact candle data format for Redis storage
 * Uses abbreviated keys to minimize memory usage
 */
export interface CompactCandleData {
  o: number;  // open
  h: number;  // high
  l: number;  // low
  c: number;  // close
  v: number;  // volume
}
