<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { type IChartApi, type ISeriesApi } from 'lightweight-charts';
  import ChartInitializer from './ChartInitializer.svelte';
  import ChartDataManager from './ChartDataManager.svelte';
  import { chartStore } from '../../stores/chartStore.svelte';
  import { dataStore } from '../../stores/dataStore.svelte';
  import { statusStore } from '../../stores/statusStore.svelte';
  import { useHistoricalDataLoader } from '../../hooks/useHistoricalDataLoader.svelte';
  import { ChartPositioningService } from './services/ChartPositioningService';
  import { ChartResizeManager } from './services/ChartResizeManager';
  import { ChartInteractionTracker } from './services/ChartInteractionTracker';
  import { VisibleCandleTracker } from '../../services/VisibleCandleTracker';
  import { getCandleCount } from '../../../../../lib/chart/TimeframeCompatibility';

  // Props using Svelte 5 runes syntax
  const {
    width = undefined,
    height = undefined,
    onChartReady = undefined
  }: {
    width?: number;
    height?: number;
    onChartReady?: (chart: IChartApi) => void;
  } = $props();

  let container: HTMLDivElement | undefined = $state();
  let chart: IChartApi | null = $state(null);
  let candleSeries: ISeriesApi<'Candlestick'> | null = $state(null);
  let volumeSeries: ISeriesApi<'Histogram'> | null = $state(null);

  let chartInitializer: ChartInitializer;
  let dataManager: ChartDataManager;

  // Service instances
  let positioningService: ChartPositioningService | null = null;
  let resizeManager: ChartResizeManager | null = null;
  let interactionTracker: ChartInteractionTracker | null = null;
  let visibleCandleTracker: VisibleCandleTracker | null = null;

  // Historical data loader
  let historicalDataLoader: ReturnType<typeof useHistoricalDataLoader> | null = null;

  // Debug state
  let initCalled: boolean = $state(false);
  let containerExists: boolean = $state(false);
  let chartCreated: boolean = $state(false);
  let lastCandleCount: number = 0;

  // Positioning debounce
  let positioningTimeout: NodeJS.Timeout | null = null;

  // Track previous candle count for comparison (avoid reactive dependencies)
  let prevCandleCount: number = 0;

  onMount(() => {
    initializeChart();
  });

  onDestroy(() => {
    cleanup();
  });

  function initializeChart() {

    if (initCalled) {
      return;
    }

    // 🚀 CRITICAL FIX: Don't reinitialize if chart already exists
    // This prevents creating multiple chart instances on Vite hot reload
    if (chart) {
      return;
    }

    initCalled = true;
    containerExists = !!container;

    if (!container) {
      statusStore.setError('Chart container not available');
      return;
    }

    // Create chart instance
    chart = chartInitializer.createChartInstance();
    if (!chart) {
      statusStore.setError('Failed to create chart');
      return;
    }

    chartCreated = true;

    // Initialize services
    positioningService = new ChartPositioningService(chart, container);
    resizeManager = new ChartResizeManager(chart, container);
    interactionTracker = new ChartInteractionTracker(chart, container);

    // Setup managers
    resizeManager.setupResizeObserver();
    interactionTracker.setupInteractionTracking(
      () => {
        // Called when user interacts
      },
      () => {
        // Called when user double-clicks to reset zoom
        positioningService?.resetZoomTo60Candles(dataStore.candles.length);
      }
    );

    // Setup series
    const seriesCreated = dataManager.setupSeries();
    if (!seriesCreated) {
      statusStore.setError('Failed to create chart series');
      return;
    }

    // NOTE: Chart data loading and real-time updates are handled by ChartCore via:
    // - useDataLoader hook (loads historical data and populates dataStore)
    // - useRealtimeSubscription hook (subscribes to real-time candle updates)
    // - ChartCore calls updateChartData() when data is ready
    //
    // ChartCanvas is a pure rendering layer that just displays what's in dataStore
    // It should NOT subscribe to dataStore or load data - that creates:
    // - Duplicate subscriptions
    // - Accumulated callbacks in memory
    // - Infinite reactive loops
    // - OOM crashes

    // Initialize chart with current dataStore content
    // ChartCore will handle loading historical data via useDataLoader hook
    dataManager.updateChartData();
    dataManager.updateVolumeData();
    prevCandleCount = dataStore.candles.length;

    // 🚀 PHASE 6: Initialize historical data loader for lazy loading on zoom-out
    // User zooms out → triggers automatic load of 60 more candles
    // No button needed - seamless infinite scroll experience
    historicalDataLoader = useHistoricalDataLoader({
      chart,
      candleSeries,
      loadThreshold: 0.1,      // Load when within 10% of data edge
      loadAmount: 60,          // Load 60 candles at a time (matches initial load)
      debounceMs: 500          // Debounce zoom events to avoid rapid loads
    });

    // 🚀 PHASE 6 FIX: Initialize visible candle tracker
    // Tracks which candles are currently visible in the viewport
    // Updates dataStore.stats.visibleCount whenever user pans/zooms
    visibleCandleTracker = new VisibleCandleTracker(chart);
    visibleCandleTracker.start();

    // ⚡ SEAMLESS REFRESH FIX: Reset interaction state on initialization
    // This ensures the chart shows 60 candles even after page refresh
    // Without this, the chart would maintain the previous zoom level (e.g., 39 candles)
    interactionTracker?.resetInteractionState();

    // ⚡ FIX: Wait for sufficient candles before positioning (retry up to 1 second)
    // This fixes race condition where chart shows only 2 candles on refresh
    const MIN_CANDLES = 10;
    const MAX_WAIT_MS = 1000;  // Reduced from 3s to 1s
    const CHECK_INTERVAL_MS = 200;
    let waited = 0;

    const checkAndPosition = () => {
      if (dataStore.candles.length >= MIN_CANDLES) {
        positioningTimeout = null;
        positioningService?.showNCandles(dataStore.candles.length, 60);
      } else if (waited < MAX_WAIT_MS) {
        waited += CHECK_INTERVAL_MS;
        positioningTimeout = setTimeout(checkAndPosition, CHECK_INTERVAL_MS);
      } else {
        // Fallback: position with whatever we have after timeout
        positioningTimeout = null;
        if (dataStore.candles.length > 0) {
          positioningService?.showNCandles(dataStore.candles.length, 60);
        }
      }
    };
    positioningTimeout = setTimeout(checkAndPosition, CHECK_INTERVAL_MS);

    // Notify parent component chart is ready
    if (onChartReady) {
      onChartReady(chart);
    }

    statusStore.setReady();
  }

  function cleanup() {
    if (positioningTimeout) {
      clearTimeout(positioningTimeout);
      positioningTimeout = null;
    }

    // 🔧 FIX: Unsubscribe from realtime updates (ChartCore handles subscriptions)
    dataStore.unsubscribeFromRealtime();

    // Cleanup services
    positioningService?.destroy();
    resizeManager?.destroy();
    interactionTracker?.destroy();

    // Clean up visible candle tracker
    if (visibleCandleTracker) {
      visibleCandleTracker.stop();
      visibleCandleTracker = null;
    }

    // Clean up historical data loader
    if (historicalDataLoader) {
      historicalDataLoader.cleanup();
      historicalDataLoader = null;
    }

    if (chart) {
      chart.remove();
      chart = null;
    }

    candleSeries = null;
    volumeSeries = null;

    // 🔧 FIX: Cleanup dataStore to clear callbacks
    dataStore.destroy();
  }

  // Helper function for applying optimal positioning
  function applyOptimalPositioning() {
    if (!positioningService) return;
    const candleCount = dataStore.candles.length;
    if (candleCount === 0) return;

    const hasInteracted = interactionTracker?.hasUserInteracted() ?? false;
    const lastInteraction = interactionTracker?.getLastInteractionTime() ?? 0;

    positioningService.applyOptimalPositioning(candleCount, hasInteracted, lastInteraction);
  }

  // Export functions for parent component
  export function getChart(): IChartApi | null {
    return chart;
  }

  export function getSeries(): ISeriesApi<'Candlestick'> | null {
    return candleSeries;
  }

  export function getVolumeSeries(): ISeriesApi<'Histogram'> | null {
    return volumeSeries;
  }

  export function fitContent() {
    positioningService?.fitContent();
  }

  export function scrollToCurrentCandle() {
    positioningService?.scrollToRealTime();
  }

  export function setVisibleRange(from: number, to: number) {
    positioningService?.setVisibleRange(from, to);
  }

  /**
   * ✅ Ensure chart shows the latest candles by scrolling to the right edge
   * Called on initial load and when candle count changes significantly
   */
  export function show60Candles() {
    positioningService?.showNCandles(dataStore.candles.length, 60);
  }

  export function addMarker(marker: any) {
    if (!candleSeries) {
      return;
    }
    candleSeries.setMarkers([marker]);
  }

  export function addMarkers(markers: any[]) {
    if (!candleSeries) {
      return;
    }

    if (!markers || markers.length === 0) {
      candleSeries.setMarkers([]);
      return;
    }

    try {
      candleSeries.setMarkers(markers);
    } catch (error) {
    }
  }

  export function clearMarkers() {
    if (!candleSeries) {
      return;
    }
    candleSeries.setMarkers([]);
  }

  export function resetToDefaultView() {
    if (!chart) return;

    // Reset interaction tracking
    interactionTracker?.resetInteractionState();

    // Apply default positioning
    applyOptimalPositioning();
  }

  export async function loadMoreHistoricalData(): Promise<boolean> {
    if (historicalDataLoader) {
      return await historicalDataLoader.loadMoreHistoricalData();
    }
    return false;
  }

  // 🔧 FIX: Called by ChartCore after loading data to render it
  export function updateChartDisplay() {
    if (!candleSeries || !dataStore.candles.length) {
      return;
    }
    dataManager?.updateChartData();
    dataManager?.updateVolumeData();
    prevCandleCount = dataStore.candles.length;
  }

  /**
   * 🔧 FIX: Reset chart data state and update display for granularity changes
   * This is called when granularity changes to force a complete redraw
   */
  export function resetAndUpdateDisplay(pluginManager?: any) {
    if (!dataManager) {
      return;
    }

    // Reset internal state
    dataManager.resetForNewTimeframe();

    // Reset volume plugin state (clear stale data before relayout)
    let volumePlugin: any = null;
    if (pluginManager) {
      try {
        volumePlugin = pluginManager.get('volume');
        if (volumePlugin && typeof volumePlugin.resetForNewTimeframe === 'function') {
          volumePlugin.resetForNewTimeframe();
        }
      } catch (error) {
      }
    }

    // Update candle data FIRST — this triggers chart relayout with new price ranges
    if (!candleSeries || !dataStore.candles.length) {
      return;
    }

    dataManager.updateChartData();
    prevCandleCount = dataStore.candles.length;

    // Rebuild volume AFTER candle relayout so price scale config survives
    if (volumePlugin && typeof volumePlugin.forceShow === 'function') {
      volumePlugin.forceShow();
    }

    // 🔧 FIX: Recalculate bar spacing after granularity change
    // This ensures candles fill the chart width properly
    // ⚡ CRITICAL FIX: Use actual candle count for positioning, not expected
    // If we only loaded 8 candles but expect 120, use 8 to avoid gaps
    const config = chartStore.config;
    const expectedCandles = getCandleCount(config.granularity, config.timeframe);
    const totalCandles = dataStore.candles.length;

    // Use the actual candles we have, capped at expected (never show more than we have)
    const candlesToShow = Math.min(totalCandles, expectedCandles);

    if (positioningService && totalCandles > 0 && candlesToShow > 0) {
      setTimeout(() => {
        positioningService.showNCandles(candlesToShow, candlesToShow);
      }, 100);
    }
  }
</script>

<div
  bind:this={container}
  class="chart-container"
  style="width: {width ? width + 'px' : '100%'}; height: {height ? height + 'px' : '100%'};"
>
  {#if !chartCreated}
    <div class="chart-loading">
      <div class="loading-spinner"></div>
      <span>Loading chart...</span>
    </div>
  {/if}
</div>

<ChartInitializer bind:this={chartInitializer} {container} {width} {height} />
<ChartDataManager
  bind:this={dataManager}
  {chart}
  bind:candleSeries
/>

<!-- Debug info -->
{#if chartStore.config.showDebug}
  <div class="debug-info">
    <small>
      Init: {initCalled} | Container: {containerExists} | Chart: {chartCreated}
    </small>
  </div>
{/if}

<style>
  .chart-container {
    position: relative;
    background: var(--surface-base);
    width: 100%;
    height: 100%;
    min-width: 0;
    max-width: 100%;
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  .chart-loading {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-md);
    color: var(--text-secondary);
  }

  .loading-spinner {
    width: 32px;
    height: 32px;
    border: 3px solid var(--border-primary);
    border-top-color: var(--color-primary);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .debug-info {
    position: absolute;
    bottom: var(--space-xs);
    right: var(--space-xs);
    padding: var(--space-xs);
    background: var(--surface-elevated);
    border-radius: var(--radius-sm);
    font-size: var(--font-size-xs);
    color: var(--text-muted);
  }
</style>
