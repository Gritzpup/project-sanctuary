/**
 * @file ChartInteractionTracker.ts
 * @description Tracks user interactions with the chart (mouse, touch, scroll)
 * Manages interaction state and event listeners for chart manipulation
 */

import type { IChartApi } from 'lightweight-charts';
import ServerTimeService from '../../../../../../services/ServerTimeService';

/**
 * User interaction events tracked on chart
 */
type InteractionCallback = () => void;
type ResetZoomCallback = () => void;

/**
 * Tracks user interactions with chart
 */
export class ChartInteractionTracker {
  private chart: IChartApi | null = null;
  private container: HTMLDivElement | null = null;
  private userHasInteracted = false;
  private lastUserInteraction = 0;
  private interactionCallback: InteractionCallback | null = null;
  private resetZoomCallback: ResetZoomCallback | null = null;

  constructor(chart: IChartApi, container: HTMLDivElement) {
    this.chart = chart;
    this.container = container;
    this.lastUserInteraction = ServerTimeService.getNow();
  }

  /**
   * Setup tracking for user interactions
   * @param onInteraction Callback when user interacts with chart
   * @param onResetZoom Callback when user double-clicks to reset zoom
   */
  setupInteractionTracking(
    onInteraction?: InteractionCallback,
    onResetZoom?: ResetZoomCallback
  ): void {
    if (!this.chart || !this.container) return;

    this.interactionCallback = onInteraction || null;
    this.resetZoomCallback = onResetZoom || null;

    // Setup interaction handlers
    this.setupMouseTracking();
    this.setupTouchTracking();
    this.setupWheelTracking();
    this.setupDoubleClickTracking();
    this.setupChartEventTracking();
  }

  /**
   * Setup mouse event tracking
   * @private
   */
  private setupMouseTracking(): void {
    if (!this.container) return;

    this.container.addEventListener('mousedown', () => this.markUserInteraction());
  }

  /**
   * Setup touch event tracking
   * @private
   */
  private setupTouchTracking(): void {
    if (!this.container) return;

    this.container.addEventListener('touchstart', () => this.markUserInteraction());
  }

  /**
   * Setup wheel/scroll event tracking
   * @private
   */
  private setupWheelTracking(): void {
    if (!this.container) return;

    this.container.addEventListener('wheel', () => this.markUserInteraction());
  }

  /**
   * Setup double-click to reset zoom
   * @private
   */
  private setupDoubleClickTracking(): void {
    if (!this.container) return;

    this.container.addEventListener('dblclick', () => {
      this.markUserInteraction();
      if (this.resetZoomCallback) {
        this.resetZoomCallback();
      }
    });
  }

  /**
   * Setup chart-specific event tracking (zoom, pan)
   * @private
   */
  private setupChartEventTracking(): void {
    if (!this.chart) return;

    // Track chart zoom and pan events
    this.chart.timeScale().subscribeVisibleLogicalRangeChange(() => {
      this.markUserInteraction();
    });
  }

  /**
   * Mark that user has interacted with chart
   * Updates interaction timestamp
   */
  private markUserInteraction(): void {
    this.userHasInteracted = true;
    this.lastUserInteraction = ServerTimeService.getNow();

    if (this.interactionCallback) {
      this.interactionCallback();
    }
  }

  /**
   * Check if user has interacted
   * @returns True if user has interacted with chart
   */
  hasUserInteracted(): boolean {
    return this.userHasInteracted;
  }

  /**
   * Get timestamp of last user interaction
   * @returns Timestamp in milliseconds
   */
  getLastInteractionTime(): number {
    return this.lastUserInteraction;
  }

  /**
   * Reset interaction state
   * Call when starting fresh data load or resetting chart
   */
  resetInteractionState(): void {
    this.userHasInteracted = false;
    this.lastUserInteraction = ServerTimeService.getNow();
  }

  /**
   * Clean up event listeners and resources
   */
  destroy(): void {
    if (this.container) {
      this.container.removeEventListener('mousedown', () => this.markUserInteraction());
      this.container.removeEventListener('touchstart', () => this.markUserInteraction());
      this.container.removeEventListener('wheel', () => this.markUserInteraction());
      this.container.removeEventListener('dblclick', () => this.markUserInteraction());
    }
    this.chart = null;
    this.container = null;
    this.interactionCallback = null;
    this.resetZoomCallback = null;
  }
}
