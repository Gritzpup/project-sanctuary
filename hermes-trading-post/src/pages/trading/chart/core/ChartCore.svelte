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
  import { useDataLoader } from '../hooks/useDataLoader.svelte';
  import { useRealtimeSubscription } from '../hooks/useRealtimeSubscription.svelte';
  import { useAutoGranularity } from '../hooks/useAutoGranularity.svelte';
  import { ChartAnimationService } from '../services/ChartAnimationService';
  import { ChartInitializationService } from '../services/ChartInitializationService';
  import { ChartReadinessOrchestrator } from '../services/ChartReadinessOrchestrator';
  import { ChartSubscriptionOrchestrator } from '../services/ChartSubscriptionOrchestrator';
  import { ChartTimeframeCoordinator } from '../services/ChartTimeframeCoordinator';

  export let pair: string = 'BTC-USD';
  export let granularity: string = '1m';
  export let period: string = '1H';
  export let enablePlugins: boolean = true;
  export let enableAutoGranularity: boolean = true;
  export let onReady: ((chart: IChartApi) => void) | undefined = undefined;

  let chartCanvas: ChartCanvas;
  let pluginManager: PluginManager | null = null;
  let isInitialized = false;
  let isInitialDataLoaded = false;

  // Initialize services
  const initService = new ChartInitializationService();
  const readinessOrchestrator = new ChartReadinessOrchestrator();
  const subscriptionOrchestrator = new ChartSubscriptionOrchestrator();
  const timeframeCoordinator = new ChartTimeframeCoordinator();

  // Initialize data loader and realtime subscription hooks
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

  // Update chart configuration when props change
  $: {
    chartStore.updateConfig({
      granularity,
      timeframe: period
    });
  }

  // Handle granularity/period changes after initial load
  $: if (isInitialized && isInitialDataLoaded && (granularity || period)) {
    timeframeCoordinator.onGranularityChange(granularity, chartCanvas?.getSeries() || null, pluginManager);
    timeframeCoordinator.onPeriodChange(period, chartCanvas?.getSeries() || null, pluginManager);
  }

  // Initialize subscriptions orchestrator with hook
  subscriptionOrchestrator.setRealtimeSubscription(realtimeSubscription);

  // Wire timeframe coordinator dependencies
  timeframeCoordinator.setDependencies({
    dataLoader,
    subscriptionOrchestrator,
    animationService: ChartAnimationService,
    prefetcher: initService
  });

  // Thin wrapper for animations
  function animateChartToLatestData() {
    const chart = chartCanvas?.getChart();
    if (chart) {
      ChartAnimationService.animateToLatestData(chart, dataStore.candles);
    }
  }

  // Thin wrapper for timeframe reloads
  async function reloadDataForNewTimeframe() {
    await timeframeCoordinator.reloadDataForNewTimeframe(
      granularity,
      period,
      chartCanvas?.getSeries() || null,
      pluginManager
    );
  }

  async function handleChartReady(chart: IChartApi) {
    if (enablePlugins) {
      pluginManager = new PluginManager();
      await pluginManager.setContext({
        chart,
        dataStore,
        chartStore,
        statusStore
      });
    }

    // Use readiness orchestrator to coordinate initialization
    await readinessOrchestrator.handleChartReady(
      chart,
      pluginManager,
      enablePlugins,
      enableAutoGranularity,
      () => {
        // Initialize auto-granularity if enabled
        if (enableAutoGranularity) {
          autoGranularity = useAutoGranularity({
            chart,
            candleSeries: chartCanvas?.getSeries() || null,
            enabled: false,
            debounceMs: 300
          });
        }

        // Notify parent
        if (onReady) {
          onReady(chart);
        }
      }
    );

  }

  onMount(async () => {
    try {
      // ⚡ CRITICAL FIX: Wait for series to be created before loading data
      // Otherwise loadData() will have undefined series and won't set chart data
      let maxWaitTime = 5000; // 5 second timeout
      let startTime = Date.now();
      let series = chartCanvas?.getSeries();

      while (!series && (Date.now() - startTime) < maxWaitTime) {
        await new Promise(resolve => setTimeout(resolve, 50));
        series = chartCanvas?.getSeries();
      }

      if (!series) {
        console.warn('Series not created after 5 seconds, proceeding anyway');
      }

      // Use initialization service
      await initService.initialize({
        pair,
        granularity,
        period,
        chart: chartCanvas?.getChart(),
        series: chartCanvas?.getSeries()
      });

      statusStore.setReady();
      isInitialized = true;

      // ⚡ CRITICAL FIX: Wait for initial historical data to load BEFORE subscribing to real-time
      // This prevents real-time updates from arriving before historical candles are set,
      // which causes sync issues where current price candle doesn't align with historical data
      ChartDebug.log('📊 Waiting for historical data to load before real-time subscription...');

      // ⚡ RETRY LOGIC: If data loading fails, retry up to 3 times before giving up
      let dataLoadAttempt = 0;
      const maxLoadRetries = 3;
      let dataLoadSuccess = false;

      while (dataLoadAttempt < maxLoadRetries && !dataLoadSuccess) {
        try {
          dataLoadAttempt++;
          ChartDebug.log(`📊 Attempting to load historical data (attempt ${dataLoadAttempt}/${maxLoadRetries})...`);

          await dataLoader.loadData({
            pair,
            granularity,
            timeframe: period,
            chart: chartCanvas?.getChart(),
            series: chartCanvas?.getSeries()
          });

          dataLoadSuccess = true;
          isInitialDataLoaded = true;
          ChartDebug.log('✅ Historical data loaded, now safe to subscribe to real-time');

          // NOW subscribe to real-time after historical data is loaded
          // This ensures current price candle aligns with historical data
          subscriptionOrchestrator.subscribeAfterPositioning(
            { pair, granularity },
            chartCanvas?.getSeries() || null,
            pluginManager
          );
        } catch (loadError) {
          ChartDebug.log(`⚠️ Data load attempt ${dataLoadAttempt} failed: ${loadError instanceof Error ? loadError.message : String(loadError)}`);

          if (dataLoadAttempt < maxLoadRetries) {
            // Wait before retrying (exponential backoff: 500ms, 1000ms, 1500ms)
            const backoffMs = 500 * dataLoadAttempt;
            ChartDebug.log(`⏳ Retrying in ${backoffMs}ms...`);
            await new Promise(resolve => setTimeout(resolve, backoffMs));
          } else {
            // All retries failed - still subscribe to real-time with whatever data we have
            // User can always refresh manually if needed
            ChartDebug.log('❌ Data load failed after 3 attempts. Subscribing to real-time without historical data.');
            isInitialDataLoaded = true;

            subscriptionOrchestrator.subscribeAfterPositioning(
              { pair, granularity },
              chartCanvas?.getSeries() || null,
              pluginManager
            );
          }
        }
      }

      // Track usage for prefetching
      initService.trackUsage(pair, granularity);

      // Check for data gaps
      setTimeout(() => {
        dataLoader.checkAndFillDataGaps(chartCanvas?.getChart(), chartCanvas?.getSeries())
          .catch(error => console.warn('Gap fill failed (non-critical):', error));
      }, 1000);

    } catch (error) {
      console.error('Chart initialization failed:', error);
      statusStore.setError('Failed to initialize chart: ' + (error instanceof Error ? error.message : String(error)));
    }
  });

  onDestroy(async () => {
    performanceStore.stopMonitoring();
    subscriptionOrchestrator.unsubscribeFromRealtime();

    if (autoGranularity && typeof autoGranularity.cleanup === 'function') {
      autoGranularity.cleanup();
    }

    await initService.destroy();
    readinessOrchestrator.destroy();
    subscriptionOrchestrator.destroy();
    timeframeCoordinator.destroy();

    if (pluginManager) {
      await pluginManager.destroy();
    }

    // IMPORTANT: Don't reset dataStore candles here!
    // If the chart component remounts/reloads, cached candles will be lost
    // The candles are persisted and should survive component lifecycle
    // Only reset chart UI state, not the data itself
    chartStore.reset();
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