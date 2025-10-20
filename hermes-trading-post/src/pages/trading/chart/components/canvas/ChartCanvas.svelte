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

  let container: HTMLDivElement = $state();
  let chart: IChartApi | null = $state(null);
  let candleSeries: ISeriesApi<'Candlestick'> | null = $state(null);
  let volumeSeries: ISeriesApi<'Histogram'> | null = $state(null);

  let chartInitializer: ChartInitializer;
  let dataManager: ChartDataManager;

  // Service instances
  let positioningService: ChartPositioningService | null = null;
  let resizeManager: ChartResizeManager | null = null;
  let interactionTracker: ChartInteractionTracker | null = null;

  // Historical data loader
  let historicalDataLoader: ReturnType<typeof useHistoricalDataLoader>;

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

    initCalled = true;
    containerExists = !!container;

    if (!container) {
      console.error('Container not found');
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

    // Initialize historical data loader for scrolling to load more
    historicalDataLoader = useHistoricalDataLoader({
      chart,
      candleSeries,
      loadThreshold: 0.1,
      loadAmount: 300,
      debounceMs: 500
    });

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
      console.error('Error setting markers:', error);
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
</script>

<ChartInitializer bind:this={chartInitializer} {container} {width} {height} />
<ChartDataManager
  bind:this={dataManager}
  {chart}
  bind:candleSeries
  bind:volumeSeries
/>

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
