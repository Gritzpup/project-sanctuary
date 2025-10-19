/**
 * @file ChartDirtyFlagSystem.ts
 * @description Tracks what chart data changed to prevent unnecessary redraws
 * Part of Phase 1: Chart Rendering Optimization
 *
 * Problem: Every price update triggers full chart redraw even if only one value changed
 * Solution: Track dirty flags for different data types, only redraw what changed
 * Expected Impact: 15-25% reduction in rendering overhead
 *
 * Dirty Flags Track:
 * - Price data (high/low/open/close changes)
 * - Volume data changes
 * - Visible range changes (zoom/pan)
 * - Indicators/overlays changes
 * - Time axis changes (scale/labels)
 */

export interface ChartDirtyFlags {
  // Price candle data
  priceCandleData: boolean;
  volumeData: boolean;

  // Chart state
  visibleRange: boolean;    // Zoom or pan
  timeScale: boolean;       // Time axis changes
  priceScale: boolean;      // Price axis changes

  // Plugins and overlays
  indicators: boolean;
  overlays: boolean;
  plugins: Map<string, boolean>; // Individual plugin dirty flags

  // UI elements
  legend: boolean;
  crosshair: boolean;
  watermark: boolean;

  // Metadata
  title: boolean;
  description: boolean;
}

export class ChartDirtyFlagSystem {
  private dirtyFlags: ChartDirtyFlags;
  private previousCandle: any = null;
  private previousVolume: any = null;
  private previousVisibleRange: any = null;

  constructor() {
    this.dirtyFlags = this.createCleanFlags();
  }

  /**
   * Create clean (all false) dirty flags
   */
  private createCleanFlags(): ChartDirtyFlags {
    return {
      priceCandleData: false,
      volumeData: false,
      visibleRange: false,
      timeScale: false,
      priceScale: false,
      indicators: false,
      overlays: false,
      plugins: new Map(),
      legend: false,
      crosshair: false,
      watermark: false,
      title: false,
      description: false
    };
  }

  /**
   * Check if price candle changed (high/low/open/close)
   * Only mark dirty if values actually changed
   */
  markPriceCandleIfChanged(candle: any): boolean {
    if (!this.shouldUpdatePriceCandle(candle)) {
      this.dirtyFlags.priceCandleData = false;
      return false;
    }

    this.dirtyFlags.priceCandleData = true;
    this.previousCandle = JSON.parse(JSON.stringify(candle));
    return true;
  }

  /**
   * Check if volume changed
   */
  markVolumeIfChanged(volume: any): boolean {
    if (!this.shouldUpdateVolume(volume)) {
      this.dirtyFlags.volumeData = false;
      return false;
    }

    this.dirtyFlags.volumeData = true;
    this.previousVolume = JSON.parse(JSON.stringify(volume));
    return true;
  }

  /**
   * Mark visible range as dirty (zoom/pan)
   */
  markVisibleRangeChanged(range: any): void {
    if (!this.previousVisibleRange ||
        this.previousVisibleRange.from !== range.from ||
        this.previousVisibleRange.to !== range.to) {
      this.dirtyFlags.visibleRange = true;
      this.previousVisibleRange = { ...range };
    } else {
      this.dirtyFlags.visibleRange = false;
    }
  }

  /**
   * Mark time scale as changed
   */
  markTimeScaleChanged(): void {
    this.dirtyFlags.timeScale = true;
  }

  /**
   * Mark price scale as changed
   */
  markPriceScaleChanged(): void {
    this.dirtyFlags.priceScale = true;
  }

  /**
   * Mark specific indicator as dirty
   */
  markIndicatorDirty(indicatorId: string): void {
    this.dirtyFlags.plugins.set(`indicator:${indicatorId}`, true);
    this.dirtyFlags.indicators = true;
  }

  /**
   * Mark specific plugin as dirty
   */
  markPluginDirty(pluginId: string): void {
    this.dirtyFlags.plugins.set(pluginId, true);
  }

  /**
   * Mark overlay as dirty
   */
  markOverlayDirty(): void {
    this.dirtyFlags.overlays = true;
  }

  /**
   * Mark legend as dirty
   */
  markLegendDirty(): void {
    this.dirtyFlags.legend = true;
  }

  /**
   * Mark crosshair as dirty
   */
  markCrosshairDirty(): void {
    this.dirtyFlags.crosshair = true;
  }

  /**
   * Check if anything is dirty (needs redraw)
   */
  isDirty(): boolean {
    return (
      this.dirtyFlags.priceCandleData ||
      this.dirtyFlags.volumeData ||
      this.dirtyFlags.visibleRange ||
      this.dirtyFlags.timeScale ||
      this.dirtyFlags.priceScale ||
      this.dirtyFlags.indicators ||
      this.dirtyFlags.overlays ||
      this.dirtyFlags.legend ||
      this.dirtyFlags.crosshair ||
      this.dirtyFlags.watermark ||
      this.dirtyFlags.title ||
      this.dirtyFlags.description ||
      this.dirtyFlags.plugins.size > 0
    );
  }

  /**
   * Check if specific area is dirty
   */
  isAreaDirty(area: keyof ChartDirtyFlags): boolean {
    if (area === 'plugins') {
      return this.dirtyFlags.plugins.size > 0;
    }
    return Boolean(this.dirtyFlags[area]);
  }

  /**
   * Get all dirty areas
   */
  getDirtyAreas(): (keyof ChartDirtyFlags)[] {
    const dirty: (keyof ChartDirtyFlags)[] = [];

    for (const [key, value] of Object.entries(this.dirtyFlags)) {
      if (key === 'plugins') {
        if ((value as Map<string, boolean>).size > 0) {
          dirty.push('plugins');
        }
      } else if (value === true) {
        dirty.push(key as keyof ChartDirtyFlags);
      }
    }

    return dirty;
  }

  /**
   * Get dirty plugin IDs
   */
  getDirtyPlugins(): string[] {
    return Array.from(this.dirtyFlags.plugins.keys()).filter(
      id => this.dirtyFlags.plugins.get(id) === true
    );
  }

  /**
   * Clear dirty flags (call after redraw)
   */
  clearDirty(): void {
    this.dirtyFlags = this.createCleanFlags();
  }

  /**
   * Clear specific area's dirty flag
   */
  clearArea(area: keyof ChartDirtyFlags): void {
    if (area === 'plugins') {
      this.dirtyFlags.plugins.clear();
    } else {
      this.dirtyFlags[area] = false;
    }
  }

  /**
   * Clear specific plugin's dirty flag
   */
  clearPlugin(pluginId: string): void {
    this.dirtyFlags.plugins.delete(pluginId);
  }

  /**
   * Get full dirty flags state (for debugging)
   */
  getState(): ChartDirtyFlags {
    return JSON.parse(JSON.stringify(this.dirtyFlags));
  }

  /**
   * Check if price candle should be updated
   * Only if high/low/open/close actually changed (not just the price ticker)
   */
  private shouldUpdatePriceCandle(candle: any): boolean {
    if (!this.previousCandle) return true;

    // Check if OHLC values changed
    return (
      this.previousCandle.open !== candle.open ||
      this.previousCandle.high !== candle.high ||
      this.previousCandle.low !== candle.low ||
      this.previousCandle.close !== candle.close ||
      this.previousCandle.time !== candle.time
    );
  }

  /**
   * Check if volume should be updated
   */
  private shouldUpdateVolume(volume: any): boolean {
    if (!this.previousVolume) return true;

    return this.previousVolume.value !== volume.value ||
           this.previousVolume.time !== volume.time ||
           this.previousVolume.color !== volume.color;
  }
}

/**
 * Export singleton instance
 */
export const chartDirtyFlagSystem = new ChartDirtyFlagSystem();
