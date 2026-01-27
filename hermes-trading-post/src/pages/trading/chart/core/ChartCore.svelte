<script lang="ts">
  // @ts-nocheck - Complex IChartApi null/undefined compatibility with lightweight-charts
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

  import type { Snippet } from 'svelte';

  // 🚀 Svelte 5 runes mode: Use $props() instead of export let
  const {
    pair = 'BTC-USD',
    granularity = '1m',
    period = '1H',
    enablePlugins = true,
    enableAutoGranularity = true,
    chartRefreshKey = Date.now(),
    onReady,
    overlays,
    controls
  } = $props<{
    pair?: string;
    granularity?: string;
    period?: string;
    enablePlugins?: boolean;
    enableAutoGranularity?: boolean;
    chartRefreshKey?: number;
    onReady?: (chart: IChartApi) => void;
    overlays?: Snippet;
    controls?: Snippet;
  }>();

  let chartCanvas: ChartCanvas;
  let pluginManager: PluginManager | null = null;
  let isInitialized = false;
  let isInitialDataLoaded = false;

  // ✅ PHASE 2: Timeout registry for cleanup
  // Tracks all setTimeout calls to prevent memory leaks on component destroy
  const timeoutRegistry: Set<NodeJS.Timeout> = new Set();

  function createTimeout(callback: () => void, delay: number): NodeJS.Timeout {
    const timeoutId = setTimeout(() => {
      timeoutRegistry.delete(timeoutId);
      callback();
    }, delay);
    timeoutRegistry.add(timeoutId);
    return timeoutId;
  }

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
  let previousTrackedGranularity = granularity;
  let previousTrackedPeriod = period;
  let trackedStoreTimeframe = chartStore.config.timeframe;

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
  $effect(() => {
    chartStore.updateConfig({
      granularity,
      timeframe: period
    });
  });

  // Handle granularity/period changes after initial load
  // Check for actual prop changes and trigger coordinator
  $effect(() => {
    // Always log to debug why reactive block might not trigger
    if (isInitialDataLoaded) {
      // This reactive dependency should trigger whenever any of these change
      const _ = [granularity, period, isInitialized];

      if (isInitialized && isInitialDataLoaded) {
        console.log(`[ChartCore] $effect: granularity=${granularity}, period=${period}`);
        if (granularity !== previousTrackedGranularity) {
          ChartDebug.log(`⏱️ Granularity prop changed: ${previousTrackedGranularity} → ${granularity}`);
          previousTrackedGranularity = granularity;

          // Use async IIFE to properly await and then reset display
          (async () => {
            await timeframeCoordinator.onGranularityChange(granularity, chartCanvas?.getSeries() || null, pluginManager);
            // Reset display after data loads to ensure chart shows new granularity data
            createTimeout(() => {
              if (chartCanvas && typeof chartCanvas.resetAndUpdateDisplay === 'function') {
                ChartDebug.log(`📊 Resetting display after granularity change to ${granularity}`);
                chartCanvas.resetAndUpdateDisplay(pluginManager);
              }
            }, 150);
          })();
        }

        if (period !== previousTrackedPeriod) {
          console.log(`[ChartCore] 🔍 Period prop changed: ${previousTrackedPeriod} → ${period}`);
          ChartDebug.log(`⏱️ Period prop changed: ${previousTrackedPeriod} → ${period}`);
          previousTrackedPeriod = period;

          // Use async IIFE to properly await period change (same as granularity change)
          (async () => {
            try {
              console.log(`[ChartCore] ✅ Calling timeframeCoordinator.onPeriodChange(${period})`);
              console.log(`[ChartCore] DEBUG: chartCanvas=${!!chartCanvas}, chartSeries=${!!chartCanvas?.getSeries()}, pluginManager=${!!pluginManager}`);
              await timeframeCoordinator.onPeriodChange(period, chartCanvas?.getSeries() || null, pluginManager);
              console.log(`[ChartCore] ✅ onPeriodChange completed for ${period}`);
              // Reset display after data loads to ensure chart shows new period data
              createTimeout(() => {
                if (chartCanvas && typeof chartCanvas.resetAndUpdateDisplay === 'function') {
                  ChartDebug.log(`📊 Resetting display after period change to ${period}`);
                  chartCanvas.resetAndUpdateDisplay(pluginManager);
                }
              }, 150);
            } catch (error) {
              console.error(`[ChartCore] ❌ ERROR in onPeriodChange:`, error);
            }
          })();
        }
      }
    }
  });

  // 🔧 FIX: Subscribe to chartStore events to detect timeframe changes
  // The reactive block approach doesn't work with class getters, so we use event subscriptions
  let storeUnsubscribe: (() => void) | null = null;

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
            enabled: true,  // ✅ FIX: Enable auto-granularity to switch timeframes on zoom
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

          // 🚀 PHASE 6: Update database count after initial load
          // This ensures DB stat shows total available candles
          await dataStore.updateDatabaseCount();

          // Initialize timeframeCoordinator with current values so it can detect changes
          // This is critical for granularity button functionality
          timeframeCoordinator.initialize(granularity, period);

          ChartDebug.log('✅ Historical data loaded, now safe to subscribe to real-time');

          // Update chart display with loaded data
          chartCanvas?.updateChartDisplay();

          // 🔧 FIX: Explicitly position chart to show 60 candles after data loads
          // This fixes race condition where checkAndPosition() ran before data was ready
          chartCanvas?.show60Candles();

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

            // Initialize timeframeCoordinator even on failure so granularity changes can still work
            timeframeCoordinator.initialize(granularity, period);

            // Update chart display with whatever data we have
            chartCanvas?.updateChartDisplay();

            // 🔧 FIX: Explicitly position chart after data loads
            chartCanvas?.show60Candles();

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

      // 🚀 PHASE 6 FIX: Don't automatically fill data gaps!
      // Gap filling was loading ALL backend data (35,923+ candles) defeating lazy loading
      // Instead, rely on realtime WebSocket updates for recent data
      // Historical data loads on-demand when user scrolls left (via useHistoricalDataLoader)
      // Check for data gaps
      // setTimeout(() => {
      //   dataLoader.checkAndFillDataGaps(chartCanvas?.getChart(), chartCanvas?.getSeries())
      // }, 1000);

      // 🔧 FIX: Subscribe to chartStore events to detect timeframe changes
      // Now that data is loaded, set up store listener for future timeframe changes
      // The store emits 'period-change' events when timeframe is updated
      storeUnsubscribe = chartStore.subscribeToEvents((event: any) => {
        if (event?.type === 'period-change') {
          const newTimeframe = event?.data?.newValue;

          // Only execute if chart is fully initialized and data is loaded
          if (isInitialDataLoaded && isInitialized && newTimeframe && newTimeframe !== trackedStoreTimeframe) {
            trackedStoreTimeframe = newTimeframe;
            timeframeCoordinator.onPeriodChange(newTimeframe, chartCanvas?.getSeries() || null, pluginManager);
          }
        }
      });

    } catch (error) {
      statusStore.setError('Failed to initialize chart: ' + (error instanceof Error ? error.message : String(error)));
    }
  });


  onDestroy(async () => {
    // ✅ PHASE 2: Clear all pending timeouts to prevent memory leaks
    timeoutRegistry.forEach(timeoutId => clearTimeout(timeoutId));
    timeoutRegistry.clear();
    ChartDebug.log(`🧹 Cleared ${timeoutRegistry.size} pending timeouts on destroy`);

    // Clean up store subscription
    if (storeUnsubscribe) {
      storeUnsubscribe();
    }

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
      return;
    }
    chartCanvas.addMarkers(markers);
  }
  
  export function addMarker(marker: any) {
    addMarkers([marker]);
  }
  
  export function clearMarkers() {
    if (!chartCanvas) {
      return;
    }
    chartCanvas.clearMarkers();
  }

  export function show60Candles() {
    if (!chartCanvas) {
      return;
    }

    chartCanvas.show60Candles();
  }

  /**
   * Reload data for a new granularity (called directly by parent component)
   * This bypasses reactive block issues by providing explicit control
   */
  export async function reloadForGranularity(newGranularity: string) {
    ChartDebug.log(`📊 ChartCore.reloadForGranularity() called: ${newGranularity}`);

    await timeframeCoordinator.onGranularityChange(
      newGranularity,
      chartCanvas?.getSeries() || null,
      pluginManager
    );

    // CRITICAL: Reset chart state and update display after data loads
    // This ensures the chart completely redraws with new timeframe data
    // resetAndUpdateDisplay clears all cached chart state and forces a fresh render
    // Also resets volume plugin state so volume candles display correctly
    createTimeout(() => {
      if (chartCanvas && typeof chartCanvas.resetAndUpdateDisplay === 'function') {
        ChartDebug.log(`📊 Resetting and updating chart display after granularity reload...`);
        chartCanvas.resetAndUpdateDisplay(pluginManager);
      } else {
        if (chartCanvas && typeof chartCanvas.updateChartDisplay === 'function') {
          chartCanvas.updateChartDisplay();
        } else {
        }
      }
    }, 150); // Reduced from 700ms - data load is faster now
  }
</script>

<div class="chart-core">
  <ChartCanvas
    bind:this={chartCanvas}
    onChartReady={handleChartReady}
  />

  {@render overlays?.()}
  {@render controls?.()}
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