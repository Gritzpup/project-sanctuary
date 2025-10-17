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

    async handleTimeframeChange(timeframe: string) {
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
    }

    handleGranularityChange(granularity: string) {
      chartStore.setGranularity(granularity);
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
</script>