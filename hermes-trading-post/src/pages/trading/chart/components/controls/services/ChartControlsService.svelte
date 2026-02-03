<script lang="ts" context="module">
  import { dataStore } from '../../../stores/dataStore.svelte';
  import { statusStore } from '../../../stores/statusStore.svelte';
  import { chartStore } from '../../../stores/chartStore.svelte';
  import { 
    RECOMMENDED_GRANULARITIES,
    VALID_GRANULARITIES
  } from '../../../utils/constants';

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
        // 🔧 FIX: Update both timeframe AND granularity atomically in one call
        // This prevents race condition where period-change event fires with old granularity
        const currentGranularity = chartStore.config.granularity;
        const validForTimeframe = VALID_GRANULARITIES[timeframe] || [];
        const recommended = RECOMMENDED_GRANULARITIES[timeframe] || [];

        let finalGranularity = currentGranularity;
        if (!validForTimeframe.includes(currentGranularity)) {
          // Current granularity is invalid for new timeframe, select first recommended
          finalGranularity = recommended[0] || validForTimeframe[0];
        }

        // UPDATE BOTH ATOMICALLY to prevent race condition
        chartStore.updateConfig({ timeframe, granularity: finalGranularity });

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
        // Wait for chart to complete reload (150ms + buffer)
        await new Promise(resolve => setTimeout(resolve, 300));
      } finally {
        this.isLoadingGranularity = false;
      }
    }

    getIsLoadingGranularity(): boolean {
      return this.isLoadingGranularity;
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
</script>