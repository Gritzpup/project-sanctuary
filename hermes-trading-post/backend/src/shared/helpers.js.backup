/**
 * @file helpers.js
 * @description Shared backend helper functions
 */

import { GRANULARITY_TO_SECONDS, MEMORY_LIMITS } from '../config/constants.js';

/**
 * Convert granularity string to seconds
 */
export function getGranularitySeconds(granularity) {
  return GRANULARITY_TO_SECONDS[granularity] || 60;
}

/**
 * Monitor memory usage and log stats
 */
export function getMemoryStats() {
  const memUsage = process.memoryUsage();
  return {
    heapUsedMB: Math.round(memUsage.heapUsed / 1024 / 1024),
    heapTotalMB: Math.round(memUsage.heapTotal / 1024 / 1024),
    rssMB: Math.round(memUsage.rss / 1024 / 1024),
    externalMB: Math.round(memUsage.external / 1024 / 1024),
    isHighMemory: memUsage.heapUsed > MEMORY_LIMITS.HEAP_WARNING_MB * 1024 * 1024
  };
}

/**
 * Format candle data from Coinbase format
 */
export function formatCandleFromCoinbase([time, low, high, open, close, volume]) {
  return {
    time: Math.floor(time),
    open: parseFloat(open),
    high: parseFloat(high),
    low: parseFloat(low),
    close: parseFloat(close),
    volume: parseFloat(volume)
  };
}

/**
 * Generate unique client ID
 */
export function generateClientId() {
  return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Check if throttle timeout has passed
 */
export function shouldThrottle(lastEmissionTime, throttleMs) {
  if (!lastEmissionTime) return false;
  return Date.now() - lastEmissionTime < throttleMs;
}
