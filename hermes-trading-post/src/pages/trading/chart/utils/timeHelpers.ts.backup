/**
 * Time Helper Functions
 * 
 * Centralized utilities for time calculations, formatting, and conversions.
 * Eliminates duplicate time logic across chart components.
 */

// Time constants
export const TIME_CONSTANTS = {
  SECOND: 1000,
  MINUTE: 60 * 1000,
  HOUR: 60 * 60 * 1000,
  DAY: 24 * 60 * 60 * 1000,
  WEEK: 7 * 24 * 60 * 60 * 1000,
  
  // Seconds per period (for API calculations)
  SECONDS_PER_MINUTE: 60,
  SECONDS_PER_HOUR: 3600,
  SECONDS_PER_DAY: 86400,
  SECONDS_PER_WEEK: 604800,
  SECONDS_PER_YEAR: 31536000
} as const;

/**
 * Get current Unix timestamp in seconds
 * @returns Current timestamp in seconds
 */
export function getCurrentTimestamp(): number {
  return Math.floor(Date.now() / 1000);
}

/**
 * Convert Unix timestamp (seconds) to milliseconds
 * @param timestamp - Unix timestamp in seconds
 * @returns Timestamp in milliseconds
 */
export function timestampToMs(timestamp: number): number {
  return timestamp * 1000;
}

/**
 * Convert milliseconds to Unix timestamp (seconds)
 * @param ms - Timestamp in milliseconds
 * @returns Unix timestamp in seconds
 */
export function msToTimestamp(ms: number): number {
  return Math.floor(ms / 1000);
}

/**
 * Format Unix timestamp as ISO string
 * @param timestamp - Unix timestamp in seconds
 * @returns ISO date string
 */
export function timestampToISO(timestamp: number): string {
  return new Date(timestamp * 1000).toISOString();
}

/**
 * Format Unix timestamp for display
 * @param timestamp - Unix timestamp in seconds
 * @param includeSeconds - Whether to include seconds in display
 * @returns Formatted time string
 */
export function formatTime(timestamp: number, includeSeconds: boolean = true): string {
  const date = new Date(timestamp * 1000);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: includeSeconds ? '2-digit' : undefined,
    hour12: false
  });
}

/**
 * Format millisecond timestamp for display
 * @param timestampMs - Timestamp in milliseconds
 * @param includeSeconds - Whether to include seconds in display
 * @returns Formatted time string
 */
export function formatTimeMs(timestampMs: number, includeSeconds: boolean = true): string {
  const date = new Date(timestampMs);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: includeSeconds ? '2-digit' : undefined,
    hour12: false
  });
}

/**
 * Format Unix timestamp as date
 * @param timestamp - Unix timestamp in seconds
 * @returns Formatted date string
 */
export function formatDate(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

/**
 * Format Unix timestamp as full date and time
 * @param timestamp - Unix timestamp in seconds
 * @returns Formatted date and time string
 */
export function formatDateTime(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  return date.toLocaleString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
}

/**
 * Format candle timestamp for display
 * @param timestamp - Unix timestamp in seconds
 * @returns Formatted candle time string
 */
export function formatCandleTime(timestamp: number): string {
  return formatDateTime(timestamp);
}

/**
 * Calculate days between two timestamps
 * @param startTimestamp - Start timestamp in seconds
 * @param endTimestamp - End timestamp in seconds
 * @returns Number of days between timestamps
 */
export function calculateDaysBetween(startTimestamp: number, endTimestamp: number): number {
  return (endTimestamp - startTimestamp) / TIME_CONSTANTS.SECONDS_PER_DAY;
}

/**
 * Get timestamp for X days ago
 * @param days - Number of days ago
 * @returns Unix timestamp in seconds
 */
export function getDaysAgo(days: number): number {
  return getCurrentTimestamp() - (days * TIME_CONSTANTS.SECONDS_PER_DAY);
}

/**
 * Get timestamp for X hours ago
 * @param hours - Number of hours ago
 * @returns Unix timestamp in seconds
 */
export function getHoursAgo(hours: number): number {
  return getCurrentTimestamp() - (hours * TIME_CONSTANTS.SECONDS_PER_HOUR);
}

/**
 * Get timestamp for X minutes ago
 * @param minutes - Number of minutes ago
 * @returns Unix timestamp in seconds
 */
export function getMinutesAgo(minutes: number): number {
  return getCurrentTimestamp() - (minutes * TIME_CONSTANTS.SECONDS_PER_MINUTE);
}

/**
 * Check if timestamp is today
 * @param timestamp - Unix timestamp in seconds
 * @returns True if timestamp is today
 */
export function isToday(timestamp: number): boolean {
  const date = new Date(timestamp * 1000);
  const today = new Date();
  return date.toDateString() === today.toDateString();
}

/**
 * Get start of day timestamp
 * @param timestamp - Unix timestamp in seconds (optional, defaults to now)
 * @returns Start of day timestamp in seconds
 */
export function getStartOfDay(timestamp?: number): number {
  const date = new Date((timestamp || getCurrentTimestamp()) * 1000);
  date.setHours(0, 0, 0, 0);
  return Math.floor(date.getTime() / 1000);
}

/**
 * Get end of day timestamp
 * @param timestamp - Unix timestamp in seconds (optional, defaults to now)
 * @returns End of day timestamp in seconds
 */
export function getEndOfDay(timestamp?: number): number {
  const date = new Date((timestamp || getCurrentTimestamp()) * 1000);
  date.setHours(23, 59, 59, 999);
  return Math.floor(date.getTime() / 1000);
}

/**
 * Format time range for display
 * @param startTimestamp - Start timestamp in seconds
 * @param endTimestamp - End timestamp in seconds
 * @returns Formatted time range string
 */
export function formatTimeRange(startTimestamp: number, endTimestamp: number): string {
  const days = calculateDaysBetween(startTimestamp, endTimestamp);
  
  if (days < 1) {
    const hours = (endTimestamp - startTimestamp) / TIME_CONSTANTS.SECONDS_PER_HOUR;
    return `${hours.toFixed(1)} hours`;
  } else if (days < 7) {
    return `${days.toFixed(1)} days`;
  } else if (days < 30) {
    const weeks = days / 7;
    return `${weeks.toFixed(1)} weeks`;
  } else if (days < 365) {
    const months = days / 30;
    return `${months.toFixed(1)} months`;
  } else {
    const years = days / 365;
    return `${years.toFixed(1)} years`;
  }
}

/**
 * Create current timestamp for debugging
 * @returns Current timestamp for debug logs
 */
export function debugTimestamp(): string {
  return new Date().toISOString();
}

/**
 * Sleep for specified milliseconds (for testing/debugging)
 * @param ms - Milliseconds to sleep
 * @returns Promise that resolves after the delay
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Check if market is open (basic check for weekdays)
 * @param timestamp - Unix timestamp in seconds (optional, defaults to now)
 * @returns True if likely market hours
 */
export function isMarketOpen(timestamp?: number): boolean {
  const date = new Date((timestamp || getCurrentTimestamp()) * 1000);
  const day = date.getDay(); // 0 = Sunday, 6 = Saturday
  
  // Weekend check
  if (day === 0 || day === 6) {
    return false;
  }
  
  // Basic hour check (9 AM - 4 PM EST, simplified)
  const hour = date.getHours();
  return hour >= 9 && hour < 16;
}