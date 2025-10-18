<script lang="ts">
  import { onMount, onDestroy, setContext } from 'svelte';
  import type { IChartApi } from 'lightweight-charts';
  import { chartStore } from '../stores/chartStore.svelte';
  import { dataStore } from '../stores/dataStore.svelte';
  import { statusStore } from '../stores/statusStore.svelte';
  import { performanceStore } from '../stores/performanceStore.svelte';
  import { PluginManager } from '../plugins/base/PluginManager';
  import ChartCanvas from '../components/canvas/ChartCanvas.svelte';
  import { ChartDebug } from '../utils/debug';
  import { perfTest } from '../utils/performanceTest';
  import { getGranularitySeconds } from '../utils/granularityHelpers';
  import { useDataLoader } from '../hooks/useDataLoader.svelte';
  import { useRealtimeSubscription } from '../hooks/useRealtimeSubscription.svelte';
  import { useAutoGranularity } from '../hooks/useAutoGranularity.svelte';
  import { chartPrefetcher } from '../services/ChartPrefetcher';
  import {
    refreshAllPlugins,
    positionChartForPeriod,
    getVolumeSeries,
    forceReadyAfterTimeout,
    delay
  } from '../utils/chartCoreHelpers';

  export let pair: string = 'BTC-USD';
  export let granularity: string = '1m';
  export let period: string = '1H';
  export let enablePlugins: boolean = true;
  export let enableAutoGranularity: boolean = true; // Enable automatic granularity switching
  export let onReady: ((chart: IChartApi) => void) | undefined = undefined;
  
  let chartCanvas: ChartCanvas;
  let pluginManager: PluginManager | null = null;
  let isInitialized = false;

  // Initialize data loader hook
  const dataLoader = useDataLoader({
    onDataLoaded: (candles) => {
      ChartDebug.log(`Data loaded: ${candles.length} candles`);
    },
    onGapFilled: (gapData) => {
      ChartDebug.log(`Gap filled with ${gapData.length} candles`);
    },
    onError: (error) => {
      ChartDebug.error('Data loader error:', error);
    }
  });
  
  // Initialize realtime subscription hook
  const realtimeSubscription = useRealtimeSubscription({
    onPriceUpdate: (price) => {
      // Price updates are handled internally by the hook
    },
    onNewCandle: (candle) => {
    },
    onReconnect: () => {
      ChartDebug.log('Real-time connection reconnected');
    },
    onError: (error) => {
      ChartDebug.error('Real-time subscription error:', error);
    }
  });

  // Auto-granularity will be initialized after chart is ready
  let autoGranularity: any = null;

  // Set up chart context for child components
  const chartContext = {
    getChart: () => chartCanvas?.getChart(),
    getSeries: () => chartCanvas?.getSeries(),
    getPluginManager: () => pluginManager,
    stores: {
      chart: chartStore,
      data: dataStore,
      status: statusStore,
      performance: performanceStore
    }
  };
  
  setContext('chart', chartContext);
  
  // Initialize chart configuration with props
  $: {
    chartStore.updateConfig({ 
      granularity,
      timeframe: period
    });
  }

  // Reload data when granularity or period changes (after initial mount)
  $: if (isInitialized && (granularity || period)) {
    reloadDataForNewTimeframe();
  }

  async function reloadDataForNewTimeframe() {
    try {
      statusStore.setLoading('Updating timeframe...');

      // Unsubscribe from current real-time updates
      realtimeSubscription.unsubscribeFromRealtime();

      // Reload data with new timeframe
      await dataLoader.loadData({
        pair,
        granularity,
        timeframe: period,
        chart: chartCanvas?.getChart(),
        series: chartCanvas?.getSeries()
      });

      // Track new usage and update prefetch queue
      chartPrefetcher.trackUsage(pair, granularity);

      // CRITICAL: Refresh ALL plugins after granularity change (including volume)
      // Volume needs full refresh when switching granularities, not just real-time updates
      refreshAllPlugins(pluginManager, 500);

      // Apply proper positioning for new timeframe, then re-enable real-time updates
      setTimeout(() => {
        positionChartForPeriod(chartCanvas, period, 0);

        // Re-enable real-time updates AFTER positioning completes
        // This prevents auto-scroll from interfering with initial positioning
        const volumeSeries = getVolumeSeries(pluginManager);

        realtimeSubscription.subscribeToRealtime({
          pair,
          granularity
        }, chartCanvas?.getSeries(), volumeSeries);
      }, 600); // Increased timeout to ensure positioning completes before real-time updates

      statusStore.setReady();
    } catch (error) {
      console.error('Failed to reload data for new timeframe:', error);
      statusStore.setError('Failed to update timeframe');
    }
  }
  
  async function handleChartReady(chart: IChartApi) {
    // Initialize plugin manager if plugins are enabled
    if (enablePlugins) {
      pluginManager = new PluginManager();

      // Set context for plugins (ChartContainer will register the actual plugins)
      await pluginManager.setContext({
        chart,
        dataStore,
        chartStore,
        statusStore
      });

      // Wait a bit for plugins to be registered by ChartContainer, then update volume series
      setTimeout(() => {
        const volumeSeries = getVolumeSeries(pluginManager);

        if (volumeSeries) {
          realtimeSubscription.subscribeToRealtime({
            pair,
            granularity
          }, chartCanvas?.getSeries(), volumeSeries);
        }
      }, 1500); // Wait for plugins to be registered
    }

    // Initialize auto-granularity switching after chart is ready
    if (enableAutoGranularity) {
      autoGranularity = useAutoGranularity({
        chart,
        candleSeries: chartCanvas?.getSeries() || null,
        enabled: false, // DISABLED: Interferes with manual granularity selection (e.g., 15m with few candles)
        debounceMs: 300
      });
    }

    // Notify parent component that chart is ready
    if (onReady) {
      onReady(chart);
    }
  }

  onMount(async () => {

    try {
      // Initialize chart with proper data flow
      statusStore.setInitializing('Loading chart...');

      // Initialize prefetcher
      await chartPrefetcher.initialize();

      // Force status to ready after timeout if still initializing
      forceReadyAfterTimeout(statusStore, 3000);

      // Wait for canvas to be available
      await delay(200);

      statusStore.setInitializing('Loading chart data...');

      // 🚀 PERF: ChartCanvas will handle fast hydration from Redis cache
      // Chart displays instantly with cached data (already happening)
      // Mark chart as ready immediately to allow user interaction
      isInitialized = true;
      statusStore.setReady();

      // ⏮️ BACKGROUND: Load additional data in the background without blocking render
      // This does IndexedDB checks, sorting, and merging - expensive operations
      // Don't await this - let it run asynchronously so chart renders first
      dataLoader.loadData({
        pair,
        granularity,
        timeframe: period,
        chart: chartCanvas?.getChart(),
        series: chartCanvas?.getSeries()
      }).catch(error => {
        console.warn('Background data load failed (non-critical):', error);
      });

      // Track usage and trigger pre-fetching for likely next selections
      chartPrefetcher.trackUsage(pair, granularity);

      // Check for data gaps in the background (after initial render)
      setTimeout(() => {
        dataLoader.checkAndFillDataGaps(chartCanvas?.getChart(), chartCanvas?.getSeries())
          .catch(error => console.warn('Gap fill failed (non-critical):', error));
      }, 1000);

      // CRITICAL: Refresh ALL plugins after initial data load (including volume for first load)
      // Do this async so it doesn't block chart display
      setTimeout(() => {
        refreshAllPlugins(pluginManager, 500);
      }, 500);

      // Enable real-time updates after initial data load
      // Note: Volume plugin may not be registered yet, so start without it
      // It will be re-subscribed with volume series after plugin initialization
      realtimeSubscription.subscribeToRealtime({
        pair,
        granularity
      }, chartCanvas?.getSeries(), null);

    } catch (error) {
      console.error('Chart initialization failed:', error);
      statusStore.setError('Failed to initialize chart: ' + error.message);
    }
  });
  
  onDestroy(async () => {
    performanceStore.stopMonitoring();
    realtimeSubscription.unsubscribeFromRealtime();

    // Cleanup auto-granularity if it was initialized
    if (autoGranularity && typeof autoGranularity.cleanup === 'function') {
      autoGranularity.cleanup();
    }

    // Cleanup prefetcher
    chartPrefetcher.destroy();

    if (pluginManager) {
      await pluginManager.destroy();
    }

    chartStore.reset();
    dataStore.reset();
    statusStore.reset();
  });
  
  
  export function getPluginManager(): PluginManager | null {
    return pluginManager;
  }
  
  export function fitContent() {
    // Always delegate to ChartCanvas.fitContent() which has the proper logic
    chartCanvas?.fitContent();
  }

  export function scrollToCurrentCandle() {
    chartCanvas?.scrollToCurrentCandle();
  }
  
  export function getChart(): IChartApi | null {
    return chartCanvas?.getChart() || null;
  }
  
  export function addMarkers(markers: any[]) {
    if (!chartCanvas) {
      console.error('ChartCore: ChartCanvas not available for adding markers');
      return;
    }
    chartCanvas.addMarkers(markers);
  }
  
  export function addMarker(marker: any) {
    addMarkers([marker]);
  }
  
  export function clearMarkers() {
    if (!chartCanvas) {
      console.error('ChartCore: ChartCanvas not available for clearing markers');
      return;
    }
    chartCanvas.clearMarkers();
  }

  export function show60Candles() {
    if (!chartCanvas) {
      console.error('ChartCore: ChartCanvas not available for show60Candles');
      return;
    }

    chartCanvas.show60Candles();
  }
</script>

<div class="chart-core">
  <ChartCanvas 
    bind:this={chartCanvas}
    onChartReady={handleChartReady}
  />
  
  <slot name="overlays" />
  <slot name="controls" />
</div>

<style>
  .chart-core {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
    min-width: 0;
    max-width: 100%;
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }
</style>