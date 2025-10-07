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
  let lastCandleCount: number = 0; // Track last candle count to prevent redundant positioning
  
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
    
    if (chart) {
      chart.remove();
      chart = null;
    }
    
    candleSeries = null;
    volumeSeries = null;
  }
  
  // Reactive updates with debounced positioning
  let positioningTimeout: NodeJS.Timeout | null = null;
  
  $: if (chart && dataStore.candles.length > 0) {
    dataManager.updateChartData();
    dataManager.updateVolumeData();
    
    // Only apply positioning if candle count changed AND not 1m chart
    const currentCandleCount = dataStore.candles.length;
    const currentGranularity = chartStore.config.granularity;
    
    if (currentCandleCount !== lastCandleCount && currentGranularity !== '1m') {
      lastCandleCount = currentCandleCount;
      
      // Debounce positioning to prevent race conditions
      if (positioningTimeout) {
        clearTimeout(positioningTimeout);
      }
      
      positioningTimeout = setTimeout(() => {
        applyOptimalPositioning();
        positioningTimeout = null;
      }, 200);
    } else if (currentGranularity === '1m') {
      // For 1m charts, just update the lastCandleCount without positioning
      lastCandleCount = currentCandleCount;
    }
  }
  
  function applyOptimalPositioning() {
    if (!chart) return;
    
    const candles = dataStore.candles;
    if (candles.length === 0) return;
    
    try {
      if (candles.length <= 30) {
        console.log(`🎯 ChartCanvas: Applying fitContent for SMALL dataset (${candles.length} candles)`);
        fitContent();
      } else {
        console.log(`ChartCanvas: Applying 60 candle view for normal dataset (${candles.length} candles)`);
        show60Candles();
      }
    } catch (error) {
      console.error('Error applying chart positioning:', error);
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
  
  // Fetch additional historical candles via Coinbase API
  async function fetchAdditionalHistoricalData(additionalCandles: number) {
    try {
      const currentCandles = dataStore.candles;
      if (currentCandles.length === 0) return;
      
      const coinbaseApi = new CoinbaseAPI();
      const granularityStr = chartStore.config.granularity;
      const granularitySeconds = getGranularitySeconds(granularityStr);
      
      // Calculate start time for additional historical data
      const firstCandleTime = currentCandles[0].time as number;
      const startTime = firstCandleTime - (additionalCandles * granularitySeconds);
      const endTime = firstCandleTime - 1; // End just before first existing candle
      
      console.log(`Fetching ${additionalCandles} additional candles from ${new Date(startTime * 1000)} to ${new Date(endTime * 1000)}`);
      
      // Fetch historical data
      const historicalData = await coinbaseApi.getCandles(
        'BTC-USD',
        granularitySeconds,
        startTime.toString(),
        endTime.toString()
      );
      
      if (historicalData && historicalData.length > 0) {
        // Convert to chart format and prepend to existing data
        const formattedCandles = historicalData.map(candle => ({
          time: candle.time as any,
          open: candle.open,
          high: candle.high,
          low: candle.low,
          close: candle.close,
          volume: candle.volume || 0
        }));
        
        // Merge with existing data (prepend historical data)
        const mergedCandles = [...formattedCandles, ...currentCandles];
        dataStore.setCandles(mergedCandles);
        
        console.log(`Added ${formattedCandles.length} historical candles. Total: ${mergedCandles.length}`);
      }
    } catch (error) {
      console.error('Failed to fetch additional historical data:', error);
    }
  }
  
  export function fitContent() {
    if (!chart) return;
    
    const candles = dataStore.candles;
    const currentGranularity = chartStore.config.granularity;
    
    // Always use standard fitContent for 1m charts - no special logic
    if (currentGranularity === '1m') {
      console.log(`ChartCanvas: 1m chart - using standard fitContent only`);
      chart.timeScale().fitContent();
      return;
    }
    
    // For small datasets (non-1m charts), use wide spacing
    if (candles.length <= 30 && candles.length > 0) {
      
      console.log(`🔍 ChartCanvas: Applying WIDE SPACING for ${candles.length} candles (${currentGranularity})`);
      
      // Get actual chart dimensions
      const chartWidth = chart.options().width || container?.clientWidth || 800;
      const chartHeight = chart.options().height || container?.clientHeight || 400;
      
      // Calculate very wide bar spacing to ensure visibility
      const availableWidth = chartWidth * 0.85; // Use 85% of chart width, leave margins
      const minBarSpacing = 25; // Minimum 25px per candle
      const maxBarSpacing = 80; // Maximum 80px per candle for readability
      let optimalBarSpacing = Math.floor(availableWidth / candles.length);
      
      // Ensure we're within reasonable bounds
      optimalBarSpacing = Math.max(minBarSpacing, Math.min(maxBarSpacing, optimalBarSpacing));
      
      console.log(`🔍 ChartCanvas: Dimensions ${chartWidth}x${chartHeight}, Available: ${availableWidth}px, Target spacing: ${optimalBarSpacing}px`);
      
      // Force apply wider bar spacing with aggressive settings
      chart.timeScale().applyOptions({
        barSpacing: optimalBarSpacing,
        minBarSpacing: 1, // Remove minimum constraint
        rightOffset: Math.max(2, Math.floor(chartWidth * 0.05)), // 5% margin
        leftOffset: Math.max(2, Math.floor(chartWidth * 0.05)),  // 5% margin
        shiftVisibleRangeOnNewBar: true, // Allow auto-scrolling for real-time data
        rightBarStaysOnScroll: true // Keep latest bar visible
      });
      
      // Force visible range to show all candles evenly distributed
      const totalLogicalWidth = candles.length + 4; // Add padding
      chart.timeScale().setVisibleLogicalRange({
        from: -2, // Left padding
        to: candles.length + 2 // Right padding
      });
      
      console.log(`✅ ChartCanvas: FORCED wide spacing - ${optimalBarSpacing}px per candle, logical range: -2 to ${candles.length + 2}`);
      
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