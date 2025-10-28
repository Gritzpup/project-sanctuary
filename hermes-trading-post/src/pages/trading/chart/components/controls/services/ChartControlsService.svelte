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
        console.log(`🔒 [ChartControls] Timeframe change blocked - already loading`);
        return;
      }

      console.log(`🎯 [ChartControls] Timeframe change requested: ${timeframe}`);
      this.isLoadingTimeframe = true;

      try {
        chartStore.setTimeframe(timeframe);
        console.log(`✅ [ChartControls] Timeframe set to: ${timeframe}`);

        // Auto-select appropriate granularity if current one isn't valid for new timeframe
        const currentGranularity = chartStore.config.granularity;
        const validForTimeframe = VALID_GRANULARITIES[timeframe] || [];
        const recommended = RECOMMENDED_GRANULARITIES[timeframe] || [];

        console.log(`🔍 [ChartControls] Granularity check for ${timeframe}:`, {
          currentGranularity,
          validForTimeframe,
          recommended,
          isValid: validForTimeframe.includes(currentGranularity)
        });

        if (!validForTimeframe.includes(currentGranularity)) {
          // Current granularity is invalid for new timeframe, select first recommended
          const newGranularity = recommended[0] || validForTimeframe[0];
          if (newGranularity) {
            console.log(`🔄 [ChartControls] Auto-switching granularity: ${currentGranularity} → ${newGranularity}`);
            chartStore.setGranularity(newGranularity);
          } else {
            console.warn(`⚠️ [ChartControls] No valid granularity found for ${timeframe}!`);
          }
        } else {
          console.log(`✅ [ChartControls] Current granularity ${currentGranularity} is valid for ${timeframe}`);
        }

        // The chart will automatically reload with the correct amount of data for the new timeframe
        // No need for special handling - useDataLoader will handle it based on the timeframe
        console.log(`📊 [ChartControls] Timeframe change complete, chart will reload automatically`);
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
</script>