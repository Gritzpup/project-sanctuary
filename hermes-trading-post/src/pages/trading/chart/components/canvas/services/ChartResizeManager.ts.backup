/**
 * @file ChartResizeManager.ts
 * @description Handles chart container resizing and dimension updates
 * Monitors container size changes and updates chart dimensions accordingly
 */

import type { IChartApi } from 'lightweight-charts';

const INITIAL_RESIZE_DELAY_MS = 100; // Delay before first resize to ensure proper sizing

/**
 * Manages chart container resizing
 */
export class ChartResizeManager {
  private chart: IChartApi | null = null;
  private container: HTMLDivElement | null = null;
  private resizeObserver: ResizeObserver | null = null;

  constructor(chart: IChartApi, container: HTMLDivElement) {
    this.chart = chart;
    this.container = container;
  }

  /**
   * Setup resize observer to monitor container size changes
   * Automatically resizes chart when container dimensions change
   */
  setupResizeObserver(): void {
    if (!this.container || !this.chart) return;

    this.resizeObserver = new ResizeObserver((entries) => {
      if (!this.chart) return;

      const { width: newWidth, height: newHeight } = entries[0].contentRect;

      // Only resize dimensions, don't reapply all chart options
      // (which could reset timeScale and other settings)
      this.chart.resize(Math.floor(newWidth), Math.floor(newHeight));
    });

    this.resizeObserver.observe(this.container);

    // Force an initial resize after a short delay to ensure proper sizing
    setTimeout(() => {
      this.handleInitialResize();
    }, INITIAL_RESIZE_DELAY_MS);
  }

  /**
   * Handle initial resize when chart is first mounted
   * @private
   */
  private handleInitialResize(): void {
    if (!this.chart || !this.container) return;

    const rect = this.container.getBoundingClientRect();
    // Only resize dimensions, don't reapply all chart options
    this.chart.resize(Math.floor(rect.width), Math.floor(rect.height));
  }

  /**
   * Manually trigger a resize (useful for known size changes)
   */
  forceResize(): void {
    if (!this.chart || !this.container) return;

    const rect = this.container.getBoundingClientRect();
    this.chart.resize(Math.floor(rect.width), Math.floor(rect.height));
  }

  /**
   * Get current container dimensions
   * @returns Object with width and height, or null if container unavailable
   */
  getContainerDimensions(): { width: number; height: number } | null {
    if (!this.container) return null;

    const rect = this.container.getBoundingClientRect();
    return {
      width: Math.floor(rect.width),
      height: Math.floor(rect.height)
    };
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    this.chart = null;
    this.container = null;
  }
}
