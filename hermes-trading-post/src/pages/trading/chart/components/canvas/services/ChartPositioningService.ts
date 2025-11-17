/**
 * @file ChartPositioningService.ts
 * @description Chart positioning and zoom management service
 * Handles viewport calculations, bar spacing, and candle visibility
 */

import type { IChartApi } from 'lightweight-charts';
import ServerTimeService from '../../../../../../services/ServerTimeService';

/**
 * Constants for chart positioning
 */
const STANDARD_VISIBLE_CANDLES = 60;
const MINIMUM_BAR_SPACING = 6; // Minimum 6px per bar
const RIGHT_OFFSET = 3; // Keep 3 candles of space on the right
const PADDING_CANDLES = 5; // Extra padding when calculating bar spacing
const POSITION_DEBOUNCE_MS = 50; // Debounce positioning updates
const INTERACTION_DEBOUNCE_MS = 30000; // 30 seconds to consider "recently interacted"

/**
 * Chart positioning and viewport management
 */
export class ChartPositioningService {
  private isApplyingPositioning = false;
  private positioningTimeout: NodeJS.Timeout | null = null;
  private chart: IChartApi | null = null;
  private container: HTMLDivElement | null = null;

  constructor(chart: IChartApi, container: HTMLDivElement) {
    this.chart = chart;
    this.container = container;
  }

  /**
   * Calculate optimal candle display and bar spacing
   * @param candleCount Total number of available candles
   * @param userHasInteracted Whether user has manually interacted
   * @param lastUserInteraction Timestamp of last user interaction
   * @returns True if positioning was applied, false if skipped
   */
  applyOptimalPositioning(
    candleCount: number,
    userHasInteracted: boolean,
    lastUserInteraction: number
  ): boolean {
    if (!this.chart || this.isApplyingPositioning || candleCount === 0) {
      return false;
    }

    this.isApplyingPositioning = true;

    try {
      // Check if user recently interacted
      const timeSinceInteraction = ServerTimeService.getNow() - lastUserInteraction;
      const recentlyInteracted = userHasInteracted && timeSinceInteraction < INTERACTION_DEBOUNCE_MS;

      // If user interacted recently, preserve their view
      if (recentlyInteracted) {
        return false;
      }

      // Calculate visible candles and start index
      const showCandles = Math.min(candleCount, STANDARD_VISIBLE_CANDLES);
      const startIndex = Math.max(0, candleCount - showCandles);

      // Set visible logical range
      this.chart.timeScale().setVisibleLogicalRange({
        from: startIndex,
        to: candleCount // rightOffset property handles right padding
      });

      // Apply bar spacing and right offset
      const barSpacing = this.calculateBarSpacing(showCandles);
      this.chart.timeScale().applyOptions({
        barSpacing: Math.max(MINIMUM_BAR_SPACING, barSpacing),
        rightOffset: RIGHT_OFFSET
      });

      // Scroll to real-time
      this.chart.timeScale().scrollToRealTime();

      return true;
    } catch (error) {
      console.error('Error applying chart positioning:', error);
      return false;
    } finally {
      setTimeout(() => {
        this.isApplyingPositioning = false;
      }, POSITION_DEBOUNCE_MS);
    }
  }

  /**
   * Reset zoom to show exactly 60 candles (typically triggered by double-click)
   * @param candleCount Total number of available candles
   */
  resetZoomTo60Candles(candleCount: number): void {
    if (!this.chart || candleCount === 0) return;

    const showCandles = Math.min(candleCount, STANDARD_VISIBLE_CANDLES);

    // 🚀 PHASE 6.2 FIX: Reset to exact 60 candles view with proper spacing
    // Calculate bar spacing for 60 candles
    const barSpacing = this.calculateBarSpacing(showCandles);

    // Apply bar spacing first
    this.chart.timeScale().applyOptions({
      barSpacing: Math.max(MINIMUM_BAR_SPACING, barSpacing),
      rightOffset: RIGHT_OFFSET
    });

    // Set visible range to match the bar spacing we just applied
    // This ensures the right-side gap is consistent with initial load
    const startIndex = Math.max(0, candleCount - showCandles);
    this.chart.timeScale().setVisibleLogicalRange({
      from: startIndex,
      to: candleCount
    });
  }

  /**
   * Show exactly N candles
   * @param candleCount Total number of available candles
   * @param visibleCount Number of candles to display
   */
  showNCandles(candleCount: number, visibleCount: number = STANDARD_VISIBLE_CANDLES): void {
    if (!this.chart || candleCount === 0) return;

    const showCandles = Math.min(candleCount, visibleCount);
    const startIndex = Math.max(0, candleCount - showCandles);

    console.log(`📊 [ChartPositioningService] showNCandles: candleCount=${candleCount}, visibleCount=${visibleCount}, showing ${showCandles} candles from ${startIndex} to ${candleCount}`);

    // Always set visible range and bar spacing, regardless of candle count
    this.chart.timeScale().setVisibleLogicalRange({
      from: startIndex,
      to: candleCount // rightOffset property handles right padding
    });

    // Calculate and apply bar spacing
    const barSpacing = this.calculateBarSpacing(showCandles);
    this.chart.timeScale().applyOptions({
      barSpacing: Math.max(MINIMUM_BAR_SPACING, barSpacing),
      rightOffset: RIGHT_OFFSET
    });

    // Scroll to real-time to show latest data
    this.chart.timeScale().scrollToRealTime();
  }

  /**
   * Calculate appropriate bar spacing for given number of visible candles
   * @param visibleCandles Number of candles to display
   * @returns Bar spacing in pixels
   */
  private calculateBarSpacing(visibleCandles: number): number {
    if (!this.container) return MINIMUM_BAR_SPACING;

    const chartWidth = this.chart?.options().width || this.container.clientWidth || 800;
    return Math.floor(chartWidth / (visibleCandles + PADDING_CANDLES));
  }

  /**
   * Fit all content to chart view
   */
  fitContent(): void {
    if (!this.chart) return;
    this.chart.timeScale().fitContent();
  }

  /**
   * Scroll to real-time (rightmost position)
   */
  scrollToRealTime(): void {
    if (!this.chart) return;
    this.chart.timeScale().scrollToRealTime();
  }

  /**
   * Set visible range by time values
   * @param from Start time
   * @param to End time
   */
  setVisibleRange(from: any, to: any): void {
    if (!this.chart) return;
    this.chart.timeScale().setVisibleRange({ from, to });
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    if (this.positioningTimeout) {
      clearTimeout(this.positioningTimeout);
      this.positioningTimeout = null;
    }
    this.chart = null;
    this.container = null;
  }

  /**
   * Get standard visible candles constant
   */
  static getStandardVisibleCandles(): number {
    return STANDARD_VISIBLE_CANDLES;
  }
}
