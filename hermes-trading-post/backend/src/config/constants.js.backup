/**
 * @file constants.js
 * @description Backend constants and configuration values
 */

export const GRANULARITY_TO_SECONDS = {
  '1m': 60,
  '5m': 300,
  '15m': 900,
  '30m': 1800,
  '1h': 3600,
  '4h': 14400,
  '1d': 86400
};

export const MEMORY_LIMITS = {
  HEAP_WARNING_MB: 1024,
  MAPPING_CLEANUP_INTERVAL_MS: 30 * 60 * 1000, // 30 minutes
  MAPPING_TTL_MS: 60 * 60 * 1000, // 1 hour
  EMISSION_THROTTLE_MS: 100 // Throttle duplicate emissions
};

export const API_CONFIG = {
  COINBASE_API_URL: 'https://api.exchange.coinbase.com',
  DEFAULT_PAIR: 'BTC-USD'
};

export const SERVER_CONFIG = {
  PORT: process.env.PORT || 4829,
  HOST: process.env.HOST || '0.0.0.0'
};
