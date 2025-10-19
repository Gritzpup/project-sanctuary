/**
 * @file useDataTransformations.svelte.ts
 * @description Svelte hook for reactive data transformations with memoization
 */

import { dataTransformations } from '../services/DataTransformations';
import type { CandlestickDataWithVolume } from '../services/DataTransformations';

/**
 * Hook for transforming candle data with reactive memoization
 *
 * Usage:
 * ```svelte
 * <script lang="ts">
 *   import { useDataTransformations } from './hooks/useDataTransformations.svelte';
 *
 *   const transformations = useDataTransformations();
 *
 *   const normalized = transformations.transformCandles(rawCandles);
 *   const merged = transformations.mergeCandles(existing, incoming);
 *   const filtered = transformations.filterByTimeRange(candles, startTime, endTime);
 * </script>
 * ```
 *
 * @returns Object containing transformation methods
 */
export function useDataTransformations() {
  return {
    /**
     * Transform raw candle data from WebSocket to chart format
     * @param candles Raw candle data
     * @returns Transformed and validated candles
     */
    transformCandles: (candles: any[]): CandlestickDataWithVolume[] => {
      return dataTransformations.transformCandles(candles);
    },

    /**
     * Merge existing candles with incoming data (for delta sync)
     * @param existing Existing candle array
     * @param incoming Incoming candle data
     * @returns Merged candles with duplicates removed
     */
    mergeCandles: (
      existing: CandlestickDataWithVolume[],
      incoming: CandlestickDataWithVolume[]
    ): CandlestickDataWithVolume[] => {
      return dataTransformations.mergeCandles(existing, incoming);
    },

    /**
     * Calculate volume statistics across candles
     * @param candles Candle data
     * @returns Volume stats object
     */
    calculateVolumeStats: (candles: CandlestickDataWithVolume[]) => {
      return dataTransformations.calculateVolumeStats(candles);
    },

    /**
     * Filter candles by time range
     * @param candles Candle data
     * @param startTime Start timestamp (seconds)
     * @param endTime End timestamp (seconds)
     * @returns Filtered candles within range
     */
    filterByTimeRange: (
      candles: CandlestickDataWithVolume[],
      startTime: number,
      endTime: number
    ): CandlestickDataWithVolume[] => {
      return dataTransformations.filterByTimeRange(candles, startTime, endTime);
    },

    /**
     * Get visible candles slice (last N most recent)
     * @param candles All candles
     * @param visibleCount Number of visible candles to return
     * @returns Last N candles
     */
    getVisibleCandles: (
      candles: CandlestickDataWithVolume[],
      visibleCount: number
    ): CandlestickDataWithVolume[] => {
      return dataTransformations.getVisibleCandles(candles, visibleCount);
    }
  };
}

/**
 * Hook to access singleton transformation instance directly
 * Use this when you need the full DataTransformations class methods
 *
 * @returns DataTransformations singleton instance
 */
export function useDataTransformationService() {
  return dataTransformations;
}
