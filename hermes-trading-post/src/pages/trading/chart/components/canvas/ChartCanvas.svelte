<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { type IChartApi, type ISeriesApi } from 'lightweight-charts';
  import ChartInitializer from './ChartInitializer.svelte';
  import ChartDataManager from './ChartDataManager.svelte';
  import { chartStore } from '../../stores/chartStore.svelte';
  import { dataStore } from '../../stores/dataStore.svelte';
  import { statusStore } from '../../stores/statusStore.svelte';
  
  export let width: number | undefined = undefined;
  export let height: number | undefined = undefined;
  export let onChartReady: ((chart: IChartApi) => void) | undefined = undefined;
  
  let container: HTMLDivElement;
  let chart: IChartApi | null = null;
  let candleSeries: ISeriesApi<'Candlestick'> | null = null;
  let volumeSeries: ISeriesApi<'Histogram'> | null = null;
  let resizeObserver: ResizeObserver | null = null;
  
  let chartInitializer: ChartInitializer;
  let dataManager: ChartDataManager;
  
  // Debug state
  let initCalled: boolean = false;
  let containerExists: boolean = false;
  let chartCreated: boolean = false;
  
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
      
      chart.applyOptions({
        width: Math.floor(newWidth),
        height: Math.floor(newHeight),
      });
    });
    
    resizeObserver.observe(container);
    
    // Force an initial resize after a short delay to ensure proper sizing
    setTimeout(() => {
      if (chart && container) {
        const rect = container.getBoundingClientRect();
        chart.applyOptions({
          width: Math.floor(rect.width),
          height: Math.floor(rect.height),
        });
      }
    }, 100);
  }
  
  function cleanup() {
    if (resizeObserver) {
      resizeObserver.disconnect();
      resizeObserver = null;
    }
    
    if (chart) {
      chart.remove();
      chart = null;
    }
    
    candleSeries = null;
    volumeSeries = null;
    
  }
  
  // Reactive updates
  $: if (chart && dataStore.candles.length > 0) {
    dataManager.updateChartData();
    dataManager.updateVolumeData();
    
    // Set the chart to show exactly 60 candles after data updates
    setTimeout(() => {
      show60Candles();
    }, 100);
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
    if (chart) {
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
        // Get the data from the series
        const data = dataStore.candles;
        if (data.length >= 60) {
          // Calculate optimal bar spacing to show ~60 candles
          const chartWidth = chart.options().width;
          const optimalBarSpacing = Math.max(8, Math.floor(chartWidth / 60 * 0.9));
          
          
          // Just adjust bar spacing, let auto-scroll handle the rest
          chart.timeScale().applyOptions({
            barSpacing: optimalBarSpacing
          });
          
          // Scroll to show the most recent data
          chart.timeScale().scrollToRealTime();
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