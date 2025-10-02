/**
 * @file schema.ts
 * @description IndexedDB schema definitions and interfaces
 */

import type { CandleData } from '../../../types/coinbase';

export const DB_NAME = 'TradingDataCache';
export const DB_VERSION = 5;
export const CHUNKS_STORE = 'chunks';
export const METADATA_STORE = 'metadata';

export interface DataChunk {
  chunkId: string;
  symbol: string;
  granularity: string;
  startTime: number;
  endTime: number;
  candles: CandleData[];
  lastUpdated: number;
  isComplete: boolean;
}

export interface DataMetadata {
  symbol: string;
  earliestData: number;
  latestData: number;
  totalCandles: number;
  lastSync: number;
  granularityRanges: {
    [granularity: string]: {
      startTime: number;
      endTime: number;
      candleCount: number;
    };
  };
}

export interface CacheConfig {
  MAX_CANDLES_PER_GRANULARITY: { [key: string]: number };
  TTL_RECENT: number;
  TTL_OLD: number;
  CHUNK_SIZE: number;
}

export const DEFAULT_CONFIG: CacheConfig = {
  // Cache limits to prevent excessive storage - AGGRESSIVE LIMITS
  MAX_CANDLES_PER_GRANULARITY: {
    '1m': 2880,     // 2 days of 1-minute candles
    '5m': 2016,     // 7 days of 5-minute candles
    '15m': 2880,    // 30 days of 15-minute candles
    '1h': 2160,     // 90 days of hourly candles
    '6h': 1460,     // 1 year of 6-hour candles
    '1d': 2200,     // 6 years of daily candles
    '1D': 2200      // 6 years of daily candles
  },
  TTL_RECENT: 3600000,  // 1 hour in ms
  TTL_OLD: 86400000,    // 24 hours in ms
  CHUNK_SIZE: 1000      // Candles per chunk
};