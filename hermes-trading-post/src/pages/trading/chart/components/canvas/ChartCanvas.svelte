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

  // Handle granularity changes via subscription (not reactive effect to avoid loops)
  let unsubscribeFromGranularityChanges: (() => void) | null = null;

  // ⚡ PHASE 13: Only trigger when candle COUNT changes, not on every price update
  // Subscribe to dataStore updates only when candle count changes
  $effect.pre(() => {
    // Get candle count directly without $derived to avoid reactive loops
    const currentCandleCount = dataStore.candles.length;

    // Only proceed if we have chart, series, and data
    if (chart && candleSeries && currentCandleCount > 0) {
      // Check if candle count changed
      const candleCountChanged = currentCandleCount !== lastCandleCount;

      // Apply positioning ONLY if:
      // 1. Candle count changed (new candle arrived), OR
      // 2. This is the first time we have data (lastCandleCount === 0)
      if (candleCountChanged || lastCandleCount === 0) {
        lastCandleCount = currentCandleCount;

        // dataManager will handle price updates via direct L2 subscription
        // This effect only handles structural changes (new candles)
        dataManager?.updateChartData();

        // Don't auto-position if user has interacted recently
        if (interactionTracker && positioningService) {
          const timeSinceInteraction =
            Date.now() - interactionTracker.getLastInteractionTime();
          if (!interactionTracker.hasUserInteracted() || timeSinceInteraction > 10000) {
            // Debounce positioning
            if (positioningTimeout) {
              clearTimeout(positioningTimeout);
            }

            positioningTimeout = setTimeout(() => {
              applyOptimalPositioning();
              positioningTimeout = null;

              // Ensure we scroll to real-time after rendering
              setTimeout(() => {
                if (chart && !interactionTracker?.hasUserInteracted()) {
                  positioningService?.scrollToRealTime();
                }
              }, 150);
            }, 50);
          }
        }
      }
    }
  });

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

    // Load cached candles from Redis first - use current granularity from store
    const pair = 'BTC-USD';
    const granularity = chartStore.config.granularity;

    // Wait for cache to load before updating chart
    dataStore.hydrateFromCache(pair, granularity, 24).then(() => {
      // Cache loaded successfully, update chart with data
      dataManager.updateChartData();
      dataManager.updateVolumeData();
    }).catch(error => {
      console.error('Cache hydration failed, will use WebSocket data:', error);
      // Still update chart even if cache fails
      dataManager.updateChartData();
      dataManager.updateVolumeData();
    });

    // Subscribe to real-time candle updates with current granularity
    dataStore.subscribeToRealtime(pair, granularity, (candle) => {
      dataManager.handleRealtimeUpdate(candle);
    });

    // Initialize historical data loader
    historicalDataLoader = useHistoricalDataLoader({
      chart,
      candleSeries,
      loadThreshold: 0.1,
      loadAmount: 300,
      debounceMs: 500
    });

    // Subscribe to granularity changes and reload data when they occur
    unsubscribeFromGranularityChanges = chartStore.subscribeToEvents((event: any) => {
      if ((event.type === 'granularity-change' || event.type === 'period-change') && chart && candleSeries && dataManager) {
        // Reset chart data for clean reload
        lastCandleCount = 0;

        // Reload data with new granularity/timeframe
        const newGranularity = chartStore.config.granularity;
        const newTimeframe = chartStore.config.timeframe;
        const now = Math.floor(Date.now() / 1000);

        const getPeriodSeconds = (period: string): number => {
          const periodMap: Record<string, number> = {
            '1H': 3600, '4H': 14400, '6H': 21600, '1D': 86400, '5D': 432000,
            '1W': 604800, '1M': 2592000, '3M': 7776000, '6M': 15552000, '1Y': 31536000, '5Y': 157680000
          };
          return periodMap[period] || 3600;
        };

        const timeRange = getPeriodSeconds(newTimeframe);
        const startTime = now - timeRange;

        dataStore.loadData(pair, newGranularity, startTime, now).then(() => {
          dataManager?.updateChartData();
          dataManager?.updateVolumeData();
        }).catch(err => console.error('Failed to reload data on granularity change:', err));
      }
    });

    // Notify parent component
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

    // Cleanup granularity subscription
    if (unsubscribeFromGranularityChanges) {
      unsubscribeFromGranularityChanges();
      unsubscribeFromGranularityChanges = null;
    }

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
