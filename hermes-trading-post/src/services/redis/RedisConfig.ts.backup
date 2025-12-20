/**
 * Redis Configuration for Candle Storage System
 * 
 * Centralized configuration for Redis connection and storage settings
 */

export interface RedisConnectionConfig {
  host: string;
  port: number;
  password?: string;
  db: number;
  retryDelayOnFailover: number;
  maxRetriesPerRequest: number;
}

export interface CandleStorageConfig {
  // Storage duration in seconds (5 years)
  maxStorageDuration: number;
  
  // Batch sizes for different operations
  batchSizes: {
    insert: number;
    fetch: number;
    cleanup: number;
  };
  
  // TTL settings for different data types
  ttl: {
    candles: number;      // 5 years + buffer
    metadata: number;     // Longer for consistency checks
    checkpoints: number;  // For data validation
  };
  
  // Key prefixes for organization
  keyPrefixes: {
    candles: string;
    metadata: string;
    checkpoints: string;
    locks: string;
  };
}

// Redis connection configuration
export const REDIS_CONFIG: RedisConnectionConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB || '0'),
  retryDelayOnFailover: 100,
  maxRetriesPerRequest: 3
};

// Candle storage configuration
export const CANDLE_STORAGE_CONFIG: CandleStorageConfig = {
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
    checkpoints: (1 * 365 * 24 * 3600) // 1 year
  },
  
  keyPrefixes: {
    candles: 'candles',
    metadata: 'meta',
    checkpoints: 'checkpoint',
    locks: 'lock'
  }
};

// Supported granularities with their seconds
export const GRANULARITY_SECONDS: Record<string, number> = {
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
export function generateCandleKey(pair: string, granularity: string, timestamp: number): string {
  // Use day-based bucketing for efficient storage and retrieval
  const dayTimestamp = Math.floor(timestamp / 86400) * 86400;
  return `${CANDLE_STORAGE_CONFIG.keyPrefixes.candles}:${pair}:${granularity}:${dayTimestamp}`;
}

// Generate Redis key for metadata
export function generateMetadataKey(pair: string, granularity: string): string {
  return `${CANDLE_STORAGE_CONFIG.keyPrefixes.metadata}:${pair}:${granularity}`;
}

// Generate Redis key for checkpoints
export function generateCheckpointKey(pair: string, granularity: string, timestamp: number): string {
  // Weekly checkpoints for validation
  const weekTimestamp = Math.floor(timestamp / 604800) * 604800;
  return `${CANDLE_STORAGE_CONFIG.keyPrefixes.checkpoints}:${pair}:${granularity}:${weekTimestamp}`;
}

// Generate Redis key for operation locks
export function generateLockKey(operation: string, pair: string, granularity?: string): string {
  const suffix = granularity ? `${pair}:${granularity}` : pair;
  return `${CANDLE_STORAGE_CONFIG.keyPrefixes.locks}:${operation}:${suffix}`;
}