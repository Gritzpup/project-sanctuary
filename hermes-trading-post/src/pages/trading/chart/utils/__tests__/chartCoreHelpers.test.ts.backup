/**
 * Unit tests for chartCoreHelpers.ts
 * Tests helper functions created during Phase 3 refactoring
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  isLongTermPeriod,
  delay
} from '../chartCoreHelpers';

describe('chartCoreHelpers', () => {
  describe('isLongTermPeriod', () => {
    it('should identify long-term periods', () => {
      expect(isLongTermPeriod('3M')).toBe(true);
      expect(isLongTermPeriod('6M')).toBe(true);
      expect(isLongTermPeriod('1Y')).toBe(true);
      expect(isLongTermPeriod('5Y')).toBe(true);
    });

    it('should identify short-term periods', () => {
      expect(isLongTermPeriod('1H')).toBe(false);
      expect(isLongTermPeriod('4H')).toBe(false);
      expect(isLongTermPeriod('1D')).toBe(false);
      expect(isLongTermPeriod('1W')).toBe(false);
      expect(isLongTermPeriod('1M')).toBe(false);
    });

    it('should handle unknown periods', () => {
      expect(isLongTermPeriod('INVALID')).toBe(false);
    });
  });

  describe('delay', () => {
    it('should delay for specified time', async () => {
      const start = Date.now();
      await delay(100);
      const elapsed = Date.now() - start;

      // Allow small margin for execution time
      expect(elapsed).toBeGreaterThanOrEqual(90);
      expect(elapsed).toBeLessThan(200);
    });

    it('should resolve with no value', async () => {
      const result = await delay(10);
      expect(result).toBeUndefined();
    });
  });

  // Note: Functions like refreshAllPlugins, positionChartForPeriod, getVolumeSeries,
  // and forceReadyAfterTimeout require mocking ChartCanvas, PluginManager, and stores
  // These are better tested as integration tests with actual component instances
});
