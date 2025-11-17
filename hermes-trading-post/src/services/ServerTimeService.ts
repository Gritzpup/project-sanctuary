/**
 * Server Time Service
 *
 * Synchronizes client time with server time to ensure:
 * - Accurate timers (candle countdown, clock)
 * - Proper chart animation positioning
 * - Consistent time calculations across the app
 */

let timeDrift = 0; // Difference between server time and client time (ms)
let lastSyncTime = 0;
let isInitialized = false;

/**
 * Initialize time synchronization with server
 * Should be called once on app startup
 */
export async function initServerTime(): Promise<void> {
  if (isInitialized) return;

  try {
    const clientTime = Date.now();
    const response = await fetch('/api/time');

    // Validate response status and content
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    // Check if response has content before parsing
    const contentLength = response.headers.get('content-length');
    if (contentLength === '0' || !contentLength) {
      throw new Error('Empty response from server');
    }

    const text = await response.text();
    if (!text || text.trim().length === 0) {
      throw new Error('Empty response body');
    }

    const data = JSON.parse(text);

    if (data.success) {
      // Calculate time drift (how far client is behind/ahead of server)
      const serverTime = data.timestamp;
      timeDrift = serverTime - clientTime;
      lastSyncTime = Date.now();
      isInitialized = true;


      // Re-sync every 30 seconds to correct for clock drift
      setInterval(syncServerTime, 30000);
    }
  } catch (error) {
    isInitialized = true; // Still mark as initialized to prevent retries
  }
}

/**
 * Re-sync with server to correct clock drift
 */
async function syncServerTime(): Promise<void> {
  try {
    const clientTime = Date.now();
    const response = await fetch('/api/time');

    // Validate response status
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    // Check if response has content before parsing
    const text = await response.text();
    if (!text || text.trim().length === 0) {
      throw new Error('Empty response body');
    }

    const data = JSON.parse(text);

    if (data.success) {
      const serverTime = data.timestamp;
      const newDrift = serverTime - clientTime;

      // Only update if drift changed significantly (>100ms)
      if (Math.abs(newDrift - timeDrift) > 100) {
        timeDrift = newDrift;
      }

      lastSyncTime = Date.now();
    }
  } catch (error) {
  }
}

/**
 * Get current time synchronized with server
 * Returns server time adjusted for client clock drift
 */
export function getNow(): number {
  return Date.now() + timeDrift;
}

/**
 * Get current time in seconds (Unix timestamp)
 */
export function getNowSeconds(): number {
  return Math.floor(getNow() / 1000);
}

/**
 * Get current Date object synchronized with server
 */
export function getNowDate(): Date {
  return new Date(getNow());
}

/**
 * Format current server time as ISO string
 */
export function getNowISO(): string {
  return getNowDate().toISOString();
}

/**
 * Calculate time until next candle
 * @param granularity Candle granularity (e.g., '1m', '5m', '1h')
 */
export function getTimeToNextCandle(granularity: string): number {
  const GRANULARITY_SECONDS = {
    '1m': 60,
    '5m': 300,
    '15m': 900,
    '30m': 1800,
    '1h': 3600,
    '4h': 14400,
    '1d': 86400
  };

  const granularitySeconds = GRANULARITY_SECONDS[granularity as keyof typeof GRANULARITY_SECONDS] || 60;
  const now = getNowSeconds();

  // Find the current candle boundary
  const alignedTime = Math.floor(now / granularitySeconds) * granularitySeconds;
  const nextCandleTime = alignedTime + granularitySeconds;

  // Return seconds until next candle (always positive)
  return Math.max(1, nextCandleTime - now);
}

/**
 * Get next candle boundary time
 * @param granularity Candle granularity (e.g., '1m', '5m', '1h')
 * @returns Unix timestamp in seconds
 */
export function getNextCandleTime(granularity: string): number {
  const GRANULARITY_SECONDS = {
    '1m': 60,
    '5m': 300,
    '15m': 900,
    '30m': 1800,
    '1h': 3600,
    '4h': 14400,
    '1d': 86400
  };

  const granularitySeconds = GRANULARITY_SECONDS[granularity as keyof typeof GRANULARITY_SECONDS] || 60;
  const now = getNowSeconds();

  const alignedTime = Math.floor(now / granularitySeconds) * granularitySeconds;
  return alignedTime + granularitySeconds;
}

/**
 * Check if we're close to a candle boundary (< 2 seconds away)
 */
export function isNearCandleBoundary(granularity: string): boolean {
  return getTimeToNextCandle(granularity) <= 2;
}

export default {
  initServerTime,
  getNow,
  getNowSeconds,
  getNowDate,
  getNowISO,
  getTimeToNextCandle,
  getNextCandleTime,
  isNearCandleBoundary
};
