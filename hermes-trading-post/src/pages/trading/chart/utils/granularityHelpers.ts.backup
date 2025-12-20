/**
 * Granularity Helper Functions
 * 
 * Centralized utilities for handling chart granularity calculations.
 * This eliminates duplicate code across ChartCore, ChartInfo, and ChartAPIService.
 */

// ✅ VALIDATED Coinbase API Granularities - the single source of truth
export const GRANULARITY_SECONDS = {
  '1m': 60,
  '5m': 300,
  '15m': 900,
  '1h': 3600,
  '6h': 21600,
  '1d': 86400,
  '1D': 86400  // Handle uppercase
} as const;

// ❌ UNSUPPORTED by Coinbase API (removed):
// '30m': 1800,   // HTTP 400
// '2h': 7200,    // HTTP 400  
// '4h': 14400,   // HTTP 400
// '12h': 43200,  // HTTP 400

// Type for valid granularities
export type Granularity = keyof typeof GRANULARITY_SECONDS;

/**
 * Get the number of seconds for a given granularity
 * @param granularity - Chart granularity (e.g., '1m', '5m', '1h')
 * @returns Number of seconds, or 0 if invalid granularity
 */
export function getGranularitySeconds(granularity: string): number {
  return GRANULARITY_SECONDS[granularity as Granularity] || 0;
}

/**
 * Align a timestamp to the nearest granularity boundary
 * @param timestamp - Unix timestamp in seconds
 * @param granularity - Chart granularity
 * @returns Aligned timestamp
 */
export function alignTimeToGranularity(timestamp: number, granularity: string): number {
  const seconds = getGranularitySeconds(granularity);
  if (seconds === 0) return timestamp;
  
  return Math.floor(timestamp / seconds) * seconds;
}

/**
 * Get the next candle time for a given granularity
 * @param currentTime - Current timestamp in seconds
 * @param granularity - Chart granularity
 * @returns Next candle timestamp
 */
export function getNextCandleTime(currentTime: number, granularity: string): number {
  const seconds = getGranularitySeconds(granularity);
  if (seconds === 0) return currentTime;
  
  const aligned = alignTimeToGranularity(currentTime, granularity);
  return aligned + seconds;
}

/**
 * Calculate time remaining until next candle
 * @param granularity - Chart granularity
 * @returns Seconds until next candle
 */
export function getTimeToNextCandle(granularity: string): number {
  const now = Math.floor(Date.now() / 1000);
  const nextCandle = getNextCandleTime(now, granularity);
  return Math.max(0, nextCandle - now);
}

/**
 * Check if a granularity is valid
 * @param granularity - Granularity string to validate
 * @returns True if valid granularity
 */
export function isValidGranularity(granularity: string): granularity is Granularity {
  return granularity in GRANULARITY_SECONDS;
}

/**
 * Get all available granularities
 * @returns Array of valid granularity strings
 */
export function getAvailableGranularities(): Granularity[] {
  return Object.keys(GRANULARITY_SECONDS) as Granularity[];
}