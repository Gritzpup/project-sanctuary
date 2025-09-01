/**
 * GranularityManager - Manages chart granularity transitions and optimal selection
 * Extracted from the monolithic chartDataFeed.ts
 */

export class GranularityManager {
  private currentGranularity: string = '1m';
  private targetGranularity: string = '1m';
  private isTransitioning = false;
  private granularityChangeCallback: ((granularity: string) => void) | null = null;
  private granularityDebounceTimer: any = null;
  private pendingGranularity: string | null = null;
  
  // Granularity thresholds for automatic switching
  private readonly granularityThresholds = [
    { hours: 0.5, granularity: '1m' },    // < 30 min: 1-minute
    { hours: 2, granularity: '5m' },      // < 2 hours: 5-minute
    { hours: 8, granularity: '15m' },     // < 8 hours: 15-minute
    { hours: 48, granularity: '1h' },     // < 2 days: 1-hour
    { hours: 336, granularity: '6h' },    // < 2 weeks: 6-hour
    { hours: Infinity, granularity: '1D' } // >= 2 weeks: 1-day
  ];
  
  // Hysteresis factors to prevent rapid switching
  private readonly HYSTERESIS_FACTOR_UP = 1.2;    // 20% buffer when zooming out
  private readonly HYSTERESIS_FACTOR_DOWN = 0.8;  // 20% buffer when zooming in
  
  constructor(initialGranularity: string = '1m') {
    this.currentGranularity = initialGranularity;
    this.targetGranularity = initialGranularity;
  }

  /**
   * Get optimal granularity for a given time range
   */
  getOptimalGranularity(rangeHours: number): string {
    for (const threshold of this.granularityThresholds) {
      if (rangeHours < threshold.hours) {
        return threshold.granularity;
      }
    }
    return '1D';
  }

  /**
   * Get optimal granularity with hysteresis to prevent rapid switching
   */
  getOptimalGranularityWithHysteresis(rangeHours: number): string {
    const currentIndex = this.granularityThresholds.findIndex(
      t => t.granularity === this.currentGranularity
    );
    
    if (currentIndex === -1) {
      return this.getOptimalGranularity(rangeHours);
    }
    
    // Check if we should switch to a coarser granularity (zooming out)
    if (currentIndex < this.granularityThresholds.length - 1) {
      const nextThreshold = this.granularityThresholds[currentIndex + 1];
      if (rangeHours > nextThreshold.hours * this.HYSTERESIS_FACTOR_UP) {
        return nextThreshold.granularity;
      }
    }
    
    // Check if we should switch to a finer granularity (zooming in)
    if (currentIndex > 0) {
      const prevThreshold = this.granularityThresholds[currentIndex];
      if (rangeHours < prevThreshold.hours * this.HYSTERESIS_FACTOR_DOWN) {
        return this.granularityThresholds[currentIndex - 1].granularity;
      }
    }
    
    return this.currentGranularity;
  }

  /**
   * Schedule a granularity change with debouncing
   */
  scheduleGranularityChange(newGranularity: string, callback?: () => Promise<void>): void {
    if (this.granularityDebounceTimer) {
      clearTimeout(this.granularityDebounceTimer);
    }
    
    this.pendingGranularity = newGranularity;
    
    this.granularityDebounceTimer = setTimeout(async () => {
      if (this.pendingGranularity && this.pendingGranularity !== this.currentGranularity) {
        await this.performTransition(this.pendingGranularity, callback);
      }
      this.pendingGranularity = null;
    }, 300); // 300ms debounce
  }

  /**
   * Perform smooth transition to new granularity
   */
  private async performTransition(newGranularity: string, callback?: () => Promise<void>): Promise<void> {
    if (this.isTransitioning) {
      return;
    }
    
    console.log(`[GranularityManager] Transitioning from ${this.currentGranularity} to ${newGranularity}`);
    this.isTransitioning = true;
    this.targetGranularity = newGranularity;
    
    try {
      // Execute callback if provided (e.g., load new data)
      if (callback) {
        await callback();
      }
      
      // Update current granularity
      this.currentGranularity = newGranularity;
      
      // Notify listeners
      if (this.granularityChangeCallback) {
        this.granularityChangeCallback(newGranularity);
      }
    } finally {
      this.isTransitioning = false;
    }
  }

  /**
   * Set callback for granularity changes
   */
  onGranularityChange(callback: (granularity: string) => void): void {
    this.granularityChangeCallback = callback;
  }

  /**
   * Get current granularity
   */
  getCurrentGranularity(): string {
    return this.currentGranularity;
  }

  /**
   * Get target granularity (during transition)
   */
  getTargetGranularity(): string {
    return this.targetGranularity;
  }

  /**
   * Check if currently transitioning
   */
  isInTransition(): boolean {
    return this.isTransitioning;
  }

  /**
   * Force set granularity without transition
   */
  setGranularity(granularity: string): void {
    this.currentGranularity = granularity;
    this.targetGranularity = granularity;
  }

  /**
   * Get granularity in seconds
   */
  static getGranularitySeconds(granularity: string): number {
    const granularityMap: Record<string, number> = {
      '1m': 60,
      '5m': 300,
      '15m': 900,
      '1h': 3600,
      '6h': 21600,
      '1D': 86400
    };
    return granularityMap[granularity] || 60;
  }

  /**
   * Parse granularity string to get unit and value
   */
  static parseGranularity(granularity: string): { value: number, unit: string } {
    const match = granularity.match(/^(\d+)([mhD])$/);
    if (!match) {
      return { value: 1, unit: 'm' };
    }
    return {
      value: parseInt(match[1], 10),
      unit: match[2]
    };
  }
}