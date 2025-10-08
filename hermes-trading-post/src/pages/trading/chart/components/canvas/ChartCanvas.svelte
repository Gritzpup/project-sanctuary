<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { type IChartApi, type ISeriesApi } from 'lightweight-charts';
  import ChartInitializer from './ChartInitializer.svelte';
  import ChartDataManager from './ChartDataManager.svelte';
  import { chartStore } from '../../stores/chartStore.svelte';
  import { dataStore } from '../../stores/dataStore.svelte';
  import { statusStore } from '../../stores/statusStore.svelte';
  import { CoinbaseAPI } from '../../../../../services/api/coinbaseApi';
  import { getGranularitySeconds } from '../../utils/granularityHelpers';
  import { getCandleCount } from '../../../../../lib/chart/TimeframeCompatibility';
  import { useHistoricalDataLoader } from '../../hooks/useHistoricalDataLoader.svelte';
  
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
  let resizeObserver: ResizeObserver | null = null;
  
  let chartInitializer: ChartInitializer;
  let dataManager: ChartDataManager;
  
  // Historical data loader
  let historicalDataLoader: ReturnType<typeof useHistoricalDataLoader>;
  
  // Debug state
  let initCalled: boolean = $state(false);
  let containerExists: boolean = $state(false);
  let chartCreated: boolean = $state(false);
  let lastCandleCount: number = 0; // Track last candle count to prevent redundant positioning
  
  // Track user interaction to prevent auto-repositioning
  let userHasInteracted = $state(false);
  let lastUserInteraction = 0;
  
  // Simple reactive update when dataStore changes
  $effect(() => {
    // Only update if we have chart, series, and data
    if (chart && candleSeries && dataStore.candles.length > 0) {
      console.log(`📊 [ChartCanvas] Setting ${dataStore.candles.length} candles on chart`);
      dataManager?.updateChartData();
      
      // Only apply positioning if candle count actually changed AND user hasn't recently interacted
      if (dataStore.candles.length !== lastCandleCount) {
        lastCandleCount = dataStore.candles.length;
        
        // Don't auto-position if user has interacted in the last 10 seconds
        const timeSinceInteraction = Date.now() - lastUserInteraction;
        if (!userHasInteracted || timeSinceInteraction > 10000) {
          applyOptimalPositioning();
        } else {
          console.log(`📊 ChartCanvas: Skipping auto-positioning - user interacted ${(timeSinceInteraction/1000).toFixed(1)}s ago`);
        }
      }
    }
  });

  onMount(() => {
    initializeChart();
    setupResizeObserver();
    setupUserInteractionTracking();
  });
  
  onDestroy(() => {
    cleanup();
  });
  
  function initializeChart() {
    if (initCalled) {
      console.warn('⚠️ initializeChart called multiple times');
      return;
    }
    
    initCalled = true;
    containerExists = !!container;
    
    if (!container) {
      console.error('❌ Container not found');
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
    
    // Setup series
    const seriesCreated = dataManager.setupSeries();
    if (!seriesCreated) {
      statusStore.setError('Failed to create chart series');
      return;
    }
    
    // Initial data load
    dataManager.updateChartData();
    dataManager.updateVolumeData();
    
    // Initialize historical data loader
    historicalDataLoader = useHistoricalDataLoader({
      chart,
      candleSeries,
      loadThreshold: 0.1, // Load more data when scrolled to within 10% of the beginning
      loadAmount: 300, // Load 300 additional candles at a time
      debounceMs: 500 // Debounce scrolling events by 500ms
    });
    
    // Notify parent component
    if (onChartReady) {
      onChartReady(chart);
    }
    
    statusStore.setReady();
  }
  
  function setupResizeObserver() {
    if (!container) return;
    
    resizeObserver = new ResizeObserver((entries) => {
      if (!chart) return;
      
      const { width: newWidth, height: newHeight } = entries[0].contentRect;
      
      // Only resize dimensions, don't reapply all chart options which resets timeScale
      chart.resize(Math.floor(newWidth), Math.floor(newHeight));
    });
    
    resizeObserver.observe(container);
    
    // Force an initial resize after a short delay to ensure proper sizing
    setTimeout(() => {
      if (chart && container) {
        const rect = container.getBoundingClientRect();
        // Only resize dimensions, don't reapply all chart options which resets timeScale
        chart.resize(Math.floor(rect.width), Math.floor(rect.height));
      }
    }, 100);
  }
  
  function setupUserInteractionTracking() {
    if (!chart || !container) return;
    
    const markUserInteraction = () => {
      userHasInteracted = true;
      lastUserInteraction = Date.now();
      console.log(`📊 ChartCanvas: User interaction detected`);
    };
    
    // Track mouse events on the chart
    container.addEventListener('mousedown', markUserInteraction);
    container.addEventListener('wheel', markUserInteraction);
    container.addEventListener('touchstart', markUserInteraction);
    
    // Track chart-specific zoom/pan events
    chart.timeScale().subscribeVisibleLogicalRangeChange(() => {
      markUserInteraction();
    });
  }
  
  function cleanup() {
    if (positioningTimeout) {
      clearTimeout(positioningTimeout);
      positioningTimeout = null;
    }
    
    if (resizeObserver) {
      resizeObserver.disconnect();
      resizeObserver = null;
    }
    
    // Clean up user interaction event listeners
    if (container) {
      container.removeEventListener('mousedown', () => {});
      container.removeEventListener('wheel', () => {});
      container.removeEventListener('touchstart', () => {});
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
  }
  
  // Reactive updates with debounced positioning
  let positioningTimeout: NodeJS.Timeout | null = null;
  let isApplyingPositioning = $state(false); // Prevent infinite positioning loops
  
  // Removed complex reactive logic that was causing conflicts
  
  function applyOptimalPositioning() {
    if (!chart || isApplyingPositioning) return;
    
    const candles = dataStore.candles;
    if (candles.length === 0) return;
    
    const currentGranularity = chartStore.config.granularity;
    const currentTimeframe = chartStore.config.timeframe;
    isApplyingPositioning = true;
    
    try {
      // Calculate expected candles for this timeframe
      const expectedCandles = getCandleCount(currentGranularity, currentTimeframe);
      
      console.log(`📊 ChartCanvas: Positioning ${candles.length} candles for ${currentGranularity}/${currentTimeframe} (expected: ${expectedCandles})`);
      
      // If user has interacted, be much less aggressive with positioning
      const timeSinceInteraction = Date.now() - lastUserInteraction;
      const recentlyInteracted = userHasInteracted && timeSinceInteraction < 30000; // 30 seconds
      
      if (recentlyInteracted) {
        // Just ensure data is available, don't force repositioning
        console.log(`📊 ChartCanvas: User recently interacted (${(timeSinceInteraction/1000).toFixed(1)}s ago) - minimal positioning`);
        // Only update data, preserve user's view
        return;
      }
      
      // For timeframes that should show specific candle counts, limit the view
      if (currentTimeframe === '1H' && expectedCandles > 0) {
        // Show only the most recent candles that fit the timeframe
        const showCandles = Math.min(candles.length, expectedCandles + 5); // +5 buffer for live candle
        const startIndex = Math.max(0, candles.length - showCandles);
        
        console.log(`🎯 ChartCanvas: Showing last ${showCandles} candles (${startIndex} to ${candles.length-1})`);
        
        // Set visible range to show only the recent candles
        chart.timeScale().setVisibleLogicalRange({
          from: startIndex,
          to: candles.length - 1
        });
        
        // Apply appropriate bar spacing
        const chartWidth = chart.options().width || container?.clientWidth || 800;
        const barSpacing = Math.max(8, Math.floor(chartWidth / showCandles));
        chart.timeScale().applyOptions({
          barSpacing: barSpacing,
          rightOffset: 12
        });
      } else {
        // For other timeframes, use standard fitContent
        console.log(`📊 ChartCanvas: Using standard fitContent for ${currentGranularity}/${currentTimeframe}`);
        chart.timeScale().fitContent();
      }
      
      // Only scroll to real-time if user hasn't interacted recently
      if (!recentlyInteracted) {
        chart.timeScale().scrollToRealTime();
      }
    } catch (error) {
      console.error('Error applying chart positioning:', error);
    } finally {
      setTimeout(() => {
        isApplyingPositioning = false;
      }, 50);
    }
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
    if (!chart) return;
    
    console.log(`📊 ChartCanvas: Simple fitContent for ${dataStore.candles.length} candles`);
    chart.timeScale().fitContent();
  }

  export function scrollToCurrentCandle() {
    if (chart) {
      chart.timeScale().scrollToRealTime();
    }
  }
  
  export function setVisibleRange(from: number, to: number) {
    if (chart) {
      chart.timeScale().setVisibleRange({ from: from as any, to: to as any });
    }
  }

  export function show60Candles() {
    if (!chart) return;
    
    const candles = dataStore.candles;
    const currentGranularity = chartStore.config.granularity;
    const currentTimeframe = chartStore.config.timeframe;
    
    console.log(`📊 ChartCanvas: show60Candles for ${candles.length} candles (${currentGranularity}/${currentTimeframe})`);
    
    // For 1H timeframe, show timeframe-appropriate candles
    if (currentTimeframe === '1H') {
      const expectedCandles = getCandleCount(currentGranularity, currentTimeframe);
      const showCandles = Math.min(candles.length, expectedCandles + 5);
      
      if (showCandles < candles.length) {
        const startIndex = Math.max(0, candles.length - showCandles);
        chart.timeScale().setVisibleLogicalRange({
          from: startIndex,
          to: candles.length - 1
        });
        console.log(`🎯 ChartCanvas: Limited view to ${showCandles} recent candles`);
      } else {
        chart.timeScale().fitContent();
      }
    } else {
      chart.timeScale().fitContent();
    }
    
    chart.timeScale().scrollToRealTime();
  }

  export function addMarker(marker: any) {
    if (!candleSeries) {
      console.log('ChartCanvas: Cannot add marker - series not ready');
      return;
    }
    console.log('ChartCanvas: Adding single marker to candlestick series');
    candleSeries.setMarkers([marker]);
  }

  export function addMarkers(markers: any[]) {
    if (!candleSeries) {
      console.log('ChartCanvas: Cannot add markers - series not ready');
      return;
    }
    
    if (!markers || markers.length === 0) {
      console.log('ChartCanvas: Clearing all markers from chart');
      candleSeries.setMarkers([]);
      console.log('✅ ChartCanvas: All markers cleared from chart');
      return;
    }
    
    console.log('ChartCanvas: Adding', markers.length, 'markers to candlestick series');
    try {
      candleSeries.setMarkers(markers);
      console.log('✅ ChartCanvas: Successfully added markers to chart');
    } catch (error) {
      console.error('❌ ChartCanvas: Error setting markers:', error);
    }
  }

  export function clearMarkers() {
    if (!candleSeries) {
      console.log('ChartCanvas: Cannot clear markers - series not ready');
      return;
    }
    console.log('ChartCanvas: Clearing all markers from chart');
    candleSeries.setMarkers([]);
    console.log('✅ ChartCanvas: All markers cleared from chart');
  }

  export function resetToDefaultView() {
    if (!chart) return;
    
    console.log('📊 ChartCanvas: Manually resetting to default view');
    // Reset user interaction tracking
    userHasInteracted = false;
    lastUserInteraction = 0;
    
    // Apply default positioning
    applyOptimalPositioning();
  }

  export async function loadMoreHistoricalData(): Promise<boolean> {
    if (historicalDataLoader) {
      return await historicalDataLoader.loadMoreHistoricalData();
    }
    console.warn('Historical data loader not initialized');
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