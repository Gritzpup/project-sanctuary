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

    this.visibleRangeChangeHandler = (logicalRange: LogicalRange) => {
      // Only update if we have valid range data
      if (logicalRange && typeof logicalRange.from === 'number' && typeof logicalRange.to === 'number') {
        // Calculate visible candle count
        const visibleCount = Math.max(0, logicalRange.to - logicalRange.from);

        ChartDebug.log('🔍 Visible candle range changed', {
          from: Math.round(logicalRange.from),
          to: Math.round(logicalRange.to),
          visibleCount,
          totalCandles: dataStore.candles.length
        });

        // Update dataStore with visible candle count
        dataStore.updateVisibleCandleCount(visibleCount);
      }
    };

    // Subscribe to visible range changes
    this.unsubscribe = this.chart.timeScale().subscribeVisibleLogicalRangeChange(
      this.visibleRangeChangeHandler
    );

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
