/**
 * Redis Configuration for Candle Storage System
 * 
 * Centralized configuration for Redis connection and storage settings
 */

// Redis connection configuration
export const REDIS_CONFIG = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB || '0'),
  retryDelayOnFailover: 100,
  maxRetriesPerRequest: 3
};

// Candle storage configuration
export const CANDLE_STORAGE_CONFIG = {
  // 5 years in seconds + 6 month buffer
  maxStorageDuration: (5 * 365 * 24 * 3600) + (6 * 30 * 24 * 3600),
  
  batchSizes: {
    insert: 1000,    // Insert candles in batches of 1000
    fetch: 5000,     // Fetch up to 5000 candles at once
    cleanup: 100     // Clean up in smaller batches to avoid blocking
  },
  
  ttl: {
    candles: (5 * 365 * 24 * 3600) + (6 * 30 * 24 * 3600), // 5.5 years
    metadata: (6 * 365 * 24 * 3600), // 6 years
    checkpoints: (30 * 24 * 3600) // 🔥 MEMORY LEAK FIX: Reduced from 1 year to 30 days
  },
  
  keyPrefixes: {
    candles: 'candles',
    metadata: 'meta',
    checkpoints: 'checkpoint',
    locks: 'lock'
  }
};

// Supported granularities with their seconds
export const GRANULARITY_SECONDS = {
  '1m': 60,
  '5m': 300,
  '15m': 900,
  '30m': 1800,
  '1h': 3600,
  '4h': 14400,
  '6h': 21600,
  '12h': 43200,
  '1d': 86400,
  '1w': 604800
};

export const SUPPORTED_GRANULARITIES = Object.keys(GRANULARITY_SECONDS);

// Generate Redis key for candle data
export function generateCandleKey(pair, granularity, timestamp) {
  // Use day-based bucketing for efficient storage and retrieval
  const dayTimestamp = Math.floor(timestamp / 86400) * 86400;
  return `${CANDLE_STORAGE_CONFIG.keyPrefixes.candles}:${pair}:${granularity}:${dayTimestamp}`;
}

// Generate Redis key for metadata
export function generateMetadataKey(pair, granularity) {
  return `${CANDLE_STORAGE_CONFIG.keyPrefixes.metadata}:${pair}:${granularity}`;
}

// Generate Redis key for checkpoints
export function generateCheckpointKey(pair, granularity, timestamp) {
  // Weekly checkpoints for validation
  const weekTimestamp = Math.floor(timestamp / 604800) * 604800;
  return `${CANDLE_STORAGE_CONFIG.keyPrefixes.checkpoints}:${pair}:${granularity}:${weekTimestamp}`;
}

// Generate Redis key for operation locks
export function generateLockKey(operation, pair, granularity) {
  const suffix = granularity ? `${pair}:${granularity}` : pair;
  return `${CANDLE_STORAGE_CONFIG.keyPrefixes.locks}:${operation}:${suffix}`;
}