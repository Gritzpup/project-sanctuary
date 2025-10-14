/**
 * Validation Helper Functions
 *
 * Centralized validation utilities for chart data.
 * Eliminates duplicate validation logic across components.
 */

import type { CandlestickData, Time } from 'lightweight-charts';
import type { Candle } from '../types/chartTypes';

/**
 * Validate if an object is a valid candle (strict)
 * Checks all OHLC values and ensures high/low constraints
 * @param candle - Candle object to validate
 * @returns True if candle is valid
 */
export function isValidCandle(candle: any): candle is CandlestickData {
  return (
    candle &&
    typeof candle.time === 'number' &&
    typeof candle.open === 'number' &&
    typeof candle.high === 'number' &&
    typeof candle.low === 'number' &&
    typeof candle.close === 'number' &&
    !isNaN(candle.open) &&
    !isNaN(candle.high) &&
    !isNaN(candle.low) &&
    !isNaN(candle.close) &&
    candle.high >= candle.low &&
    candle.high >= candle.open &&
    candle.high >= candle.close &&
    candle.low <= candle.open &&
    candle.low <= candle.close
  );
}

/**
 * Validate if an object is a valid candle (basic)
 * Only checks if OHLC values exist and are numbers
 * @param candle - Candle object to validate
 * @returns True if candle has valid structure
 */
export function isValidCandleBasic(candle: any): candle is Candle {
  return (
    candle &&
    typeof candle.time === 'number' &&
    typeof candle.open === 'number' &&
    typeof candle.high === 'number' &&
    typeof candle.low === 'number' &&
    typeof candle.close === 'number' &&
    !isNaN(candle.open) &&
    !isNaN(candle.high) &&
    !isNaN(candle.low) &&
    !isNaN(candle.close)
  );
}

/**
 * Filter array of candles to only valid ones
 * @param data - Array of potential candle objects
 * @returns Array of valid candles
 */
export function validateCandleData(data: any[]): CandlestickData[] {
  return data.filter(isValidCandle);
}

/**
 * Check if a price value is valid
 * @param price - Price value to validate
 * @returns True if price is a valid positive number
 */
export function isValidPrice(price: any): price is number {
  return typeof price === 'number' && !isNaN(price) && price > 0 && isFinite(price);
}

/**
 * Check if a volume value is valid
 * @param volume - Volume value to validate
 * @returns True if volume is a valid non-negative number
 */
export function isValidVolume(volume: any): volume is number {
  return typeof volume === 'number' && !isNaN(volume) && volume >= 0 && isFinite(volume);
}

/**
 * Check if a timestamp is valid
 * @param timestamp - Unix timestamp in seconds
 * @returns True if timestamp is valid
 */
export function isValidTimestamp(timestamp: any): timestamp is number {
  return (
    typeof timestamp === 'number' &&
    !isNaN(timestamp) &&
    isFinite(timestamp) &&
    timestamp > 0 &&
    timestamp < 4102444800 // Max: Jan 1, 2100
  );
}

/**
 * Validate if a candle array is properly sorted by time
 * @param candles - Array of candles
 * @returns True if candles are sorted ascending by time
 */
export function isCandlesSorted(candles: CandlestickData[]): boolean {
  for (let i = 1; i < candles.length; i++) {
    if ((candles[i].time as number) < (candles[i - 1].time as number)) {
      return false;
    }
  }
  return true;
}

/**
 * Check if a candle array has duplicates
 * @param candles - Array of candles
 * @returns True if there are duplicate timestamps
 */
export function hasDuplicateCandles(candles: CandlestickData[]): boolean {
  const seen = new Set<number>();
  for (const candle of candles) {
    const time = candle.time as number;
    if (seen.has(time)) {
      return true;
    }
    seen.add(time);
  }
  return false;
}

/**
 * Remove duplicate candles (keeps last occurrence)
 * @param candles - Array of candles
 * @returns Array without duplicates
 */
export function removeDuplicateCandles(candles: CandlestickData[]): CandlestickData[] {
  const map = new Map<number, CandlestickData>();

  // Iterate forward, last occurrence will overwrite
  for (const candle of candles) {
    map.set(candle.time as number, candle);
  }

  return Array.from(map.values()).sort((a, b) =>
    (a.time as number) - (b.time as number)
  );
}

/**
 * Validate if candle data has no gaps larger than expected
 * @param candles - Array of candles
 * @param expectedGapSeconds - Expected time between candles in seconds
 * @param maxAllowedGaps - Maximum number of gaps to allow (default: 3)
 * @returns True if no large gaps exist
 */
export function hasNoLargeGaps(
  candles: CandlestickData[],
  expectedGapSeconds: number,
  maxAllowedGaps: number = 3
): boolean {
  let gapCount = 0;

  for (let i = 1; i < candles.length; i++) {
    const gap = (candles[i].time as number) - (candles[i - 1].time as number);
    const expectedGap = expectedGapSeconds;

    // Allow up to 1.5x the expected gap (some tolerance)
    if (gap > expectedGap * 1.5) {
      gapCount++;
      if (gapCount > maxAllowedGaps) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Check if a number is within a valid range
 * @param value - Value to check
 * @param min - Minimum value (inclusive)
 * @param max - Maximum value (inclusive)
 * @returns True if value is within range
 */
export function isInRange(value: number, min: number, max: number): boolean {
  return value >= min && value <= max;
}

/**
 * Validate product ID format (e.g., "BTC-USD")
 * @param productId - Product ID string
 * @returns True if valid format
 */
export function isValidProductId(productId: any): productId is string {
  if (typeof productId !== 'string') return false;

  // Format: XXX-XXX (e.g., BTC-USD, ETH-USDT)
  const pattern = /^[A-Z0-9]{2,10}-[A-Z0-9]{2,10}$/;
  return pattern.test(productId);
}

/**
 * Sanitize an array by removing null/undefined values
 * @param arr - Array to sanitize
 * @returns Array without null/undefined
 */
export function sanitizeArray<T>(arr: (T | null | undefined)[]): T[] {
  return arr.filter((item): item is T => item !== null && item !== undefined);
}

/**
 * Clamp a number to a range
 * @param value - Value to clamp
 * @param min - Minimum value
 * @param max - Maximum value
 * @returns Clamped value
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Check if a string is a valid hex color
 * @param color - Color string to validate
 * @returns True if valid hex color
 */
export function isValidHexColor(color: any): color is string {
  if (typeof color !== 'string') return false;
  return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color);
}

/**
 * Validate WebSocket message structure
 * @param message - Message object to validate
 * @returns True if message has valid structure
 */
export function isValidWebSocketMessage(message: any): boolean {
  return (
    message &&
    typeof message === 'object' &&
    'type' in message &&
    typeof message.type === 'string'
  );
}
