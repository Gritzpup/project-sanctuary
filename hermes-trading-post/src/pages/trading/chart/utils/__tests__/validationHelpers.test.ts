/**
 * Unit tests for validationHelpers.ts
 * Tests all validation functions created during Phase 1 refactoring
 */

import { describe, it, expect } from 'vitest';
import {
  isValidCandle,
  isValidCandleBasic,
  validateCandleData,
  isValidPrice,
  isValidVolume,
  isValidTimestamp,
  isCandlesSorted,
  hasDuplicateCandles,
  removeDuplicateCandles,
  hasNoLargeGaps,
  isInRange,
  isValidProductId,
  sanitizeArray,
  clamp,
  isValidHexColor,
  isValidWebSocketMessage
} from '../validationHelpers';

describe('validationHelpers', () => {
  describe('isValidCandle', () => {
    it('should validate a correct candle', () => {
      const validCandle = {
        time: 1000,
        open: 100,
        high: 110,
        low: 90,
        close: 105
      };
      expect(isValidCandle(validCandle)).toBe(true);
    });

    it('should reject candle with high < low', () => {
      const invalidCandle = {
        time: 1000,
        open: 100,
        high: 90, // Invalid: high < low
        low: 110,
        close: 105
      };
      expect(isValidCandle(invalidCandle)).toBe(false);
    });

    it('should reject candle with NaN values', () => {
      const invalidCandle = {
        time: 1000,
        open: NaN,
        high: 110,
        low: 90,
        close: 105
      };
      expect(isValidCandle(invalidCandle)).toBe(false);
    });

    it('should reject null', () => {
      expect(isValidCandle(null)).toBeFalsy();
    });
  });

  describe('isValidCandleBasic', () => {
    it('should validate candle with basic structure', () => {
      const candle = {
        time: 1000,
        open: 100,
        high: 90, // Note: doesn't validate constraints
        low: 110,
        close: 105
      };
      expect(isValidCandleBasic(candle)).toBe(true);
    });

    it('should reject candle without required fields', () => {
      const invalidCandle = {
        time: 1000,
        open: 100
        // missing high, low, close
      };
      expect(isValidCandleBasic(invalidCandle)).toBe(false);
    });
  });

  describe('validateCandleData', () => {
    it('should filter out invalid candles', () => {
      const data = [
        { time: 1000, open: 100, high: 110, low: 90, close: 105 }, // valid
        { time: 2000, open: NaN, high: 110, low: 90, close: 105 }, // invalid
        { time: 3000, open: 100, high: 110, low: 90, close: 105 }, // valid
      ];
      const result = validateCandleData(data);
      expect(result).toHaveLength(2);
    });
  });

  describe('isValidPrice', () => {
    it('should accept positive numbers', () => {
      expect(isValidPrice(100)).toBe(true);
      expect(isValidPrice(0.01)).toBe(true);
    });

    it('should reject zero and negative numbers', () => {
      expect(isValidPrice(0)).toBe(false);
      expect(isValidPrice(-10)).toBe(false);
    });

    it('should reject NaN and Infinity', () => {
      expect(isValidPrice(NaN)).toBe(false);
      expect(isValidPrice(Infinity)).toBe(false);
    });
  });

  describe('isValidVolume', () => {
    it('should accept non-negative numbers', () => {
      expect(isValidVolume(0)).toBe(true);
      expect(isValidVolume(1000)).toBe(true);
    });

    it('should reject negative numbers', () => {
      expect(isValidVolume(-1)).toBe(false);
    });
  });

  describe('isValidTimestamp', () => {
    it('should accept valid timestamps', () => {
      const now = Math.floor(Date.now() / 1000);
      expect(isValidTimestamp(now)).toBe(true);
    });

    it('should reject timestamps in the far future', () => {
      const farFuture = 5000000000; // Year 2128
      expect(isValidTimestamp(farFuture)).toBe(false);
    });

    it('should reject zero and negative timestamps', () => {
      expect(isValidTimestamp(0)).toBe(false);
      expect(isValidTimestamp(-1000)).toBe(false);
    });
  });

  describe('isCandlesSorted', () => {
    it('should return true for sorted candles', () => {
      const candles = [
        { time: 1000, open: 100, high: 110, low: 90, close: 105 },
        { time: 2000, open: 105, high: 115, low: 95, close: 110 },
        { time: 3000, open: 110, high: 120, low: 100, close: 115 },
      ];
      expect(isCandlesSorted(candles)).toBe(true);
    });

    it('should return false for unsorted candles', () => {
      const candles = [
        { time: 3000, open: 100, high: 110, low: 90, close: 105 },
        { time: 1000, open: 105, high: 115, low: 95, close: 110 },
        { time: 2000, open: 110, high: 120, low: 100, close: 115 },
      ];
      expect(isCandlesSorted(candles)).toBe(false);
    });
  });

  describe('hasDuplicateCandles', () => {
    it('should detect duplicates', () => {
      const candles = [
        { time: 1000, open: 100, high: 110, low: 90, close: 105 },
        { time: 1000, open: 105, high: 115, low: 95, close: 110 }, // duplicate time
        { time: 2000, open: 110, high: 120, low: 100, close: 115 },
      ];
      expect(hasDuplicateCandles(candles)).toBe(true);
    });

    it('should return false when no duplicates', () => {
      const candles = [
        { time: 1000, open: 100, high: 110, low: 90, close: 105 },
        { time: 2000, open: 105, high: 115, low: 95, close: 110 },
        { time: 3000, open: 110, high: 120, low: 100, close: 115 },
      ];
      expect(hasDuplicateCandles(candles)).toBe(false);
    });
  });

  describe('removeDuplicateCandles', () => {
    it('should remove duplicates and keep last occurrence', () => {
      const candles = [
        { time: 1000, open: 100, high: 110, low: 90, close: 105 },
        { time: 1000, open: 105, high: 115, low: 95, close: 110 }, // duplicate, should be kept
        { time: 2000, open: 110, high: 120, low: 100, close: 115 },
      ];
      const result = removeDuplicateCandles(candles);
      expect(result).toHaveLength(2);
      expect(result[0].open).toBe(105); // Last occurrence kept
    });

    it('should sort results by time', () => {
      const candles = [
        { time: 3000, open: 110, high: 120, low: 100, close: 115 },
        { time: 1000, open: 100, high: 110, low: 90, close: 105 },
        { time: 2000, open: 105, high: 115, low: 95, close: 110 },
      ];
      const result = removeDuplicateCandles(candles);
      expect(result[0].time).toBe(1000);
      expect(result[1].time).toBe(2000);
      expect(result[2].time).toBe(3000);
    });
  });

  describe('isInRange', () => {
    it('should validate numbers in range', () => {
      expect(isInRange(5, 0, 10)).toBe(true);
      expect(isInRange(0, 0, 10)).toBe(true);
      expect(isInRange(10, 0, 10)).toBe(true);
    });

    it('should reject numbers out of range', () => {
      expect(isInRange(-1, 0, 10)).toBe(false);
      expect(isInRange(11, 0, 10)).toBe(false);
    });
  });

  describe('isValidProductId', () => {
    it('should accept valid product IDs', () => {
      expect(isValidProductId('BTC-USD')).toBe(true);
      expect(isValidProductId('ETH-USDT')).toBe(true);
      expect(isValidProductId('SOL-EUR')).toBe(true);
    });

    it('should reject invalid formats', () => {
      expect(isValidProductId('BTC')).toBe(false);
      expect(isValidProductId('BTC-')).toBe(false);
      expect(isValidProductId('-USD')).toBe(false);
      expect(isValidProductId('btc-usd')).toBe(false); // lowercase
      expect(isValidProductId(123)).toBe(false);
    });
  });

  describe('sanitizeArray', () => {
    it('should remove null and undefined values', () => {
      const arr = [1, null, 2, undefined, 3, null];
      const result = sanitizeArray(arr);
      expect(result).toEqual([1, 2, 3]);
    });

    it('should preserve other falsy values', () => {
      const arr = [0, false, '', null, undefined];
      const result = sanitizeArray(arr);
      expect(result).toEqual([0, false, '']);
    });
  });

  describe('clamp', () => {
    it('should clamp to min', () => {
      expect(clamp(-5, 0, 10)).toBe(0);
    });

    it('should clamp to max', () => {
      expect(clamp(15, 0, 10)).toBe(10);
    });

    it('should not clamp values in range', () => {
      expect(clamp(5, 0, 10)).toBe(5);
    });
  });

  describe('isValidHexColor', () => {
    it('should accept valid hex colors', () => {
      expect(isValidHexColor('#FFF')).toBe(true);
      expect(isValidHexColor('#FFFFFF')).toBe(true);
      expect(isValidHexColor('#abc123')).toBe(true);
    });

    it('should reject invalid hex colors', () => {
      expect(isValidHexColor('FFF')).toBe(false); // missing #
      expect(isValidHexColor('#GGGGGG')).toBe(false); // invalid characters
      expect(isValidHexColor('#FF')).toBe(false); // too short
      expect(isValidHexColor(123)).toBe(false);
    });
  });

  describe('isValidWebSocketMessage', () => {
    it('should accept valid messages', () => {
      expect(isValidWebSocketMessage({ type: 'update', data: {} })).toBe(true);
    });

    it('should reject invalid messages', () => {
      expect(isValidWebSocketMessage(null)).toBeFalsy();
      expect(isValidWebSocketMessage({})).toBe(false); // missing type
      expect(isValidWebSocketMessage({ type: 123 })).toBe(false); // type not string
    });
  });
});
