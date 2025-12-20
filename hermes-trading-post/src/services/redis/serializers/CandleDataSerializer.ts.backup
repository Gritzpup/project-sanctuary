/**
 * @file CandleDataSerializer.ts
 * @description Handles serialization/deserialization of candle data for Redis storage
 * Pure utility functions with no Redis dependency
 */

import type { StoredCandle, CompactCandleData } from '../types';
import { GRANULARITY_SECONDS } from '../RedisConfig';

/**
 * Serializes a single candle into compact JSON format
 * @param candle Candle to serialize
 * @returns Compact JSON string representation
 */
export function serializeCandle(candle: StoredCandle): string {
  const compactData: CompactCandleData = {
    o: candle.open,
    h: candle.high,
    l: candle.low,
    c: candle.close,
    v: candle.volume
  };
  return JSON.stringify(compactData);
}

/**
 * Deserializes a candle from Redis storage format
 * @param data Compact JSON string from Redis
 * @param timestamp Candle timestamp
 * @returns Deserialized candle object
 */
export function deserializeCandle(data: string, timestamp: number): StoredCandle {
  try {
    const compact: CompactCandleData = JSON.parse(data);
    return {
      time: timestamp,
      open: compact.o,
      high: compact.h,
      low: compact.l,
      close: compact.c,
      volume: compact.v || 0
    };
  } catch (error) {
    throw new Error(`Failed to deserialize candle: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Format candle data for Redis sorted set storage
 * Redis format: `${time}:${JSON.stringify(compactData)}`
 * @param candle Candle to format
 * @returns Formatted string for Redis storage
 */
export function formatCandleForRedis(candle: StoredCandle): string {
  const compactData = serializeCandle(candle);
  return `${candle.time}:${compactData}`;
}

/**
 * Parse candle data from Redis sorted set format
 * Handles the `${time}:${JSON.stringify(compactData)}` format
 * @param redisData String from Redis
 * @returns Parsed candle object
 */
export function parseCandleFromRedis(redisData: string): StoredCandle {
  const parts = redisData.split(':', 2);
  if (parts.length !== 2) {
    throw new Error(`Invalid Redis candle format: ${redisData}`);
  }

  const timeStr = parts[0];
  const candleJson = parts[1];
  const timestamp = parseInt(timeStr);

  if (isNaN(timestamp)) {
    throw new Error(`Invalid timestamp in Redis candle: ${timeStr}`);
  }

  return deserializeCandle(candleJson, timestamp);
}

/**
 * Group candles by day (86400 seconds per day)
 * @param candles Array of candles to group
 * @returns Map of day timestamp to candles for that day
 */
export function groupCandlesByDay(candles: StoredCandle[]): Map<number, StoredCandle[]> {
  const candlesByDay = new Map<number, StoredCandle[]>();

  for (const candle of candles) {
    const dayTimestamp = Math.floor(candle.time / 86400) * 86400;

    if (!candlesByDay.has(dayTimestamp)) {
      candlesByDay.set(dayTimestamp, []);
    }

    candlesByDay.get(dayTimestamp)!.push(candle);
  }

  return candlesByDay;
}

/**
 * Calculate checksum for data validation
 * Uses a simple hash function for quick validation
 * @param candles Array of candles to checksum
 * @returns Hex-encoded checksum string
 */
export function calculateChecksum(candles: StoredCandle[]): string {
  const data = candles.map(c => `${c.time}:${c.close}`).join('|');
  let hash = 0;

  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  return hash.toString(36);
}

/**
 * Get day timestamp boundaries for a given timestamp
 * @param timestamp Any timestamp in the day
 * @returns Object with start and end of day
 */
export function getDayBoundaries(timestamp: number): { start: number; end: number } {
  const dayStart = Math.floor(timestamp / 86400) * 86400;
  const dayEnd = dayStart + 86400 - 1;
  return { start: dayStart, end: dayEnd };
}

/**
 * Get all day timestamps between two times (inclusive)
 * @param startTime Start timestamp
 * @param endTime End timestamp
 * @returns Array of day timestamps
 */
export function getDaysInRange(startTime: number, endTime: number): number[] {
  const days: number[] = [];
  const startDay = Math.floor(startTime / 86400) * 86400;
  const endDay = Math.floor(endTime / 86400) * 86400;

  for (let dayTimestamp = startDay; dayTimestamp <= endDay; dayTimestamp += 86400) {
    days.push(dayTimestamp);
  }

  return days;
}

/**
 * Convert granularity string to seconds
 * @param granularity Granularity string (e.g., '1m', '5m', '1h')
 * @returns Seconds in this granularity
 */
export function getGranularitySeconds(granularity: string): number {
  const seconds = GRANULARITY_SECONDS[granularity];
  if (!seconds) {
    throw new Error(`Unknown granularity: ${granularity}`);
  }
  return seconds;
}

/**
 * Filter candles to those within a time range
 * @param candles Array of candles
 * @param startTime Range start
 * @param endTime Range end
 * @returns Filtered candles within range
 */
export function filterCandlesByTimeRange(
  candles: StoredCandle[],
  startTime: number,
  endTime: number
): StoredCandle[] {
  return candles.filter(candle => candle.time >= startTime && candle.time <= endTime);
}

/**
 * Sort candles by timestamp (ascending)
 * @param candles Array of candles
 * @returns New sorted array
 */
export function sortCandlesByTime(candles: StoredCandle[]): StoredCandle[] {
  return [...candles].sort((a, b) => a.time - b.time);
}
