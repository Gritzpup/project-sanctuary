/**
 * @file VisibleCandleTracker.ts
 * @description Tracks which candles are currently visible in the chart viewport
 * This is separate from total candles (all loaded) vs database candles (all available)
 */

import type { IChartApi } from 'lightweight-charts';
import { ChartDebug } from '../utils/debug';
import { dataStore } from '../stores/dataStore.svelte';

export interface LogicalRange {
  from: number;
  to: number;
}

export class VisibleCandleTracker {
  private chart: IChartApi | null = null;
  private unsubscribe: (() => void) | null = null;
  private visibleRangeChangeHandler: ((range: LogicalRange) => void) | null = null;

  constructor(chart: IChartApi) {
    this.chart = chart;
  }

  /**
   * Start tracking visible candle range changes
   */
  start(): void {
    if (!this.chart) return;

    this.visibleRangeChangeHandler = (logicalRange: LogicalRange | null) => {
      // Only update if we have valid range data
      if (logicalRange && typeof logicalRange.from === 'number' && typeof logicalRange.to === 'number') {
        // 🚀 PHASE 6 FIX: Clamp visible count to actual loaded candles
        // The logical range can be larger than actual candles (e.g., when zoomed far out)
        // We should never show more candles than are actually loaded
        const logicalVisibleCount = Math.max(0, logicalRange.to - logicalRange.from);
        const actualLoadedCandles = dataStore.candles.length;

        // Clamp to actual candles available - can't show more than what's loaded
        let visibleCount = Math.min(logicalVisibleCount, actualLoadedCandles);

        // 🚀 PHASE 6 FIX: Round to integer - avoid decimal display issues
        // Decimal values like 35.923 get formatted as "35,923" by Intl.NumberFormat
        visibleCount = Math.round(visibleCount);

        ChartDebug.log('🔍 Visible candle range changed', {
          from: Math.round(logicalRange.from),
          to: Math.round(logicalRange.to),
          logicalVisibleCount: Math.round(logicalVisibleCount),
          actualLoadedCandles,
          roundedVisibleCount: visibleCount
        });

        // Update dataStore with visible candle count
        dataStore.updateVisibleCandleCount(visibleCount);
      } else {
      }
    };

    // Subscribe to visible range changes
    try {
      this.chart.timeScale().subscribeVisibleLogicalRangeChange(
        this.visibleRangeChangeHandler as any
      );
      this.unsubscribe = () => {
        this.chart?.timeScale().unsubscribeVisibleLogicalRangeChange(this.visibleRangeChangeHandler as any);
      };

      // Get and log initial range immediately
      const initialRange = this.chart.timeScale().getVisibleLogicalRange();
      if (initialRange) {
        this.visibleRangeChangeHandler(initialRange);
      }
    } catch (error) {
    }

    ChartDebug.log('✅ Visible candle tracker started');
  }

  /**
   * Stop tracking visible candles
   */
  stop(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    this.visibleRangeChangeHandler = null;
    this.chart = null;

    ChartDebug.log('✅ Visible candle tracker stopped');
  }

  /**
   * Get current visible range from chart
   */
  getVisibleRange(): LogicalRange | null {
    if (!this.chart) return null;

    const range = this.chart.timeScale().getVisibleLogicalRange();
    return range ? { from: range.from, to: range.to } : null;
  }

  /**
   * Get visible candle count
   */
  getVisibleCandleCount(): number {
    const range = this.getVisibleRange();
    if (!range) return 0;

    return Math.max(0, Math.round(range.to - range.from));
  }
}
