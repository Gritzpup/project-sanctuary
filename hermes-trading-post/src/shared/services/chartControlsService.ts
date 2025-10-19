/**
 * @file chartControlsService.ts
 * @description Chart controls service for managing timeframe, granularity, and data operations
 */

import { dataStore } from '../../stores/dataStore.svelte';
import { statusStore } from '../../stores/statusStore.svelte';
import { chartStore } from '../../stores/chartStore.svelte';
import {
  RECOMMENDED_GRANULARITIES,
  VALID_GRANULARITIES
} from '../constants/chart.constants';

export class ChartControlsService {
  private isRefreshing = false;
  private isClearingCache = false;
  private isLoadingTimeframe = false;
  private isLoadingGranularity = false;

  async handleTimeframeChange(timeframe: string) {
    // Guard: prevent simultaneous timeframe loads
    if (this.isLoadingTimeframe) {
      return;
    }

    this.isLoadingTimeframe = true;

    try {
      chartStore.setTimeframe(timeframe);

      // Auto-select appropriate granularity if current one isn't valid for new timeframe
      const currentGranularity = chartStore.config.granularity;
      const validForTimeframe = VALID_GRANULARITIES[timeframe] || [];
      const recommended = RECOMMENDED_GRANULARITIES[timeframe] || [];

      if (!validForTimeframe.includes(currentGranularity)) {
        // Current granularity is invalid for new timeframe, select first recommended
        const newGranularity = recommended[0] || validForTimeframe[0];
        if (newGranularity) {
          chartStore.setGranularity(newGranularity);
        }
      }

      // The chart will automatically reload with the correct amount of data for the new timeframe
      // No need for special handling - useDataLoader will handle it based on the timeframe
    } finally {
      this.isLoadingTimeframe = false;
    }
  }

  async handleGranularityChange(granularity: string) {
    // Guard: prevent simultaneous granularity loads
    if (this.isLoadingGranularity) {
      return;
    }

    this.isLoadingGranularity = true;

    try {
      chartStore.setGranularity(granularity);
    } finally {
      this.isLoadingGranularity = false;
    }
  }

  async handleRefresh() {
    if (this.isRefreshing) return;

    this.isRefreshing = true;
    statusStore.setLoading('Refreshing data...');

    try {
      const stats = dataStore.stats;
      if (stats.oldestTime && stats.newestTime) {
        await dataStore.reloadData(stats.oldestTime, stats.newestTime);
      }
      statusStore.setReady();
    } catch (error) {
      console.error('ChartControls: Error refreshing data:', error);
      statusStore.setError('Failed to refresh data');
    } finally {
      this.isRefreshing = false;
    }
  }

  async handleClearCache() {
    if (this.isClearingCache) return;

    this.isClearingCache = true;

    try {
      await dataStore.clearCache();
      await this.handleRefresh();
    } catch (error) {
      console.error('ChartControls: Error clearing cache:', error);
      statusStore.setError('Failed to clear cache');
    } finally {
      this.isClearingCache = false;
    }
  }

  getRefreshingState() {
    return this.isRefreshing;
  }

  getClearingCacheState() {
    return this.isClearingCache;
  }
}

// Export singleton instance
export const chartControlsService = new ChartControlsService();
