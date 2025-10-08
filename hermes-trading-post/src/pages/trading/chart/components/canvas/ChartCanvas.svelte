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
  
  // Simple reactive update when dataStore changes
  $effect(() => {
    // Only update if we have chart, series, and data
    if (chart && candleSeries && dataStore.candles.length > 0) {
      console.log(`📊 [ChartCanvas] Setting ${dataStore.candles.length} candles on chart`);
      dataManager?.updateChartData();
      
      // Only apply positioning if candle count actually changed
      if (dataStore.candles.length !== lastCandleCount) {
        lastCandleCount = dataStore.candles.length;
        applyOptimalPositioning();
      }
    }
  });

  onMount(() => {
    initializeChart();
    setupResizeObserver();
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
  
  function cleanup() {
    if (positioningTimeout) {
      clearTimeout(positioningTimeout);
      positioningTimeout = null;
    }
    
    if (resizeObserver) {
      resizeObserver.disconnect();
      resizeObserver = null;
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
    isApplyingPositioning = true;
    
    try {
      // For 1m charts, prioritize 60-candle view when we have enough data
      if (currentGranularity === '1m' && candles.length >= 60) {
        console.log(`🎯 ChartCanvas: 1m chart with ${candles.length} candles - applying 60 candle view`);
        show60Candles();
      } else if (candles.length <= 30) {
        console.log(`🎯 ChartCanvas: Applying fitContent for SMALL dataset (${candles.length} candles)`);
        fitContent();
      } else {
        console.log(`ChartCanvas: Applying 60 candle view for normal dataset (${candles.length} candles)`);
        show60Candles();
      }
    } catch (error) {
      console.error('Error applying chart positioning:', error);
    } finally {
      // Reset flag quickly to allow other positioning calls
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
    
    const candles = dataStore.candles;
    const currentGranularity = chartStore.config.granularity;
    
    // For 1m charts, show only 1H timeframe (60 candles)
    if (currentGranularity === '1m') {
      console.log(`ChartCanvas: 1m chart with ${candles.length} candles - showing 1H timeframe`);
      show60Candles();
      return;
    }
    
    // For small datasets (non-1m charts), use wide spacing
    if (candles.length <= 30 && candles.length > 0) {
      
      console.log(`🔍 ChartCanvas: Applying WIDE SPACING for ${candles.length} candles (${currentGranularity})`);
      
      // Get actual chart dimensions
      const chartWidth = chart.options().width || container?.clientWidth || 800;
      const chartHeight = chart.options().height || container?.clientHeight || 400;
      
      // Calculate smaller bar spacing and shift left by one candle width
      const rightGapPercent = 0.20; // 20% gap on right side  
      const availableWidth = chartWidth * (1 - rightGapPercent);
      let optimalBarSpacing = Math.floor(availableWidth / (candles.length + 1)); // +1 for spacing
      
      console.log(`🔍 ChartCanvas: Fitting ${candles.length} candles with ${optimalBarSpacing}px spacing, shifted left`);
      
      chart.timeScale().applyOptions({
        barSpacing: optimalBarSpacing,
        rightOffset: Math.floor(chartWidth * rightGapPercent),
        leftOffset: 0
      });
      
      chart.timeScale().setVisibleLogicalRange({
        from: 0, // Start from first candle
        to: candles.length + 2 // Show all candles plus right space
      });
      
      console.log(`✅ ChartCanvas: Set ${candles.length} candles, spacing: ${optimalBarSpacing}px, range: 0 to ${candles.length + 2}`);
      
      // Double-check and force again after a brief delay to override any competing updates
      setTimeout(() => {
        if (chart) {
          chart.timeScale().applyOptions({ barSpacing: optimalBarSpacing });
          console.log(`🔄 ChartCanvas: RE-APPLIED bar spacing: ${optimalBarSpacing}px`);
        }
      }, 100);
      
    } else {
      // For normal datasets, use standard fitContent
      console.log(`ChartCanvas: Using standard fitContent for ${candles.length} candles`);
      chart.timeScale().fitContent();
    }
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
    if (chart && candleSeries) {
      try {
        const data = dataStore.candles;
        if (data.length > 0) {
          console.log(`🎯 ChartCanvas: show60Candles - configuring for ${data.length} total candles`);
          
          // Calculate barSpacing to show approximately 60 candles
          const chartWidth = chart.options().width || container?.clientWidth || 800;
          const targetCandles = Math.min(60, data.length); // Don't exceed available data
          const rightOffsetSpace = 50; // Reserve space for right offset
          const availableWidth = chartWidth - rightOffsetSpace;
          const optimalBarSpacing = Math.max(8, Math.floor(availableWidth / targetCandles));
          
          console.log(`🎯 ChartCanvas: chartWidth: ${chartWidth}, optimalBarSpacing: ${optimalBarSpacing} for ${targetCandles} candles (of ${data.length} total)`);
          
          // Apply the settings to show candles with proper spacing
          chart.timeScale().applyOptions({
            barSpacing: optimalBarSpacing,
            rightOffset: 12
          });
          
          // Scroll to show most recent data
          chart.timeScale().scrollToRealTime();
          
          console.log(`✅ ChartCanvas: Applied barSpacing: ${optimalBarSpacing}px with rightOffset: 12 for ${targetCandles} candles`);
        }
      } catch (error) {
        console.error('Error setting 60 candle view:', error);
      }
    }
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