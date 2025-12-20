<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import { createChart, type IChartApi, type DeepPartial, type ChartOptions, type ISeriesApi } from 'lightweight-charts';
  
  /**
   * Shared Base Chart Component
   * Eliminates duplicate chart initialization code across components
   */
  
  // Props
  export let width: number = 800;
  export let height: number = 300;
  export let chartOptions: DeepPartial<ChartOptions> = {};
  export let seriesType: 'candlestick' | 'line' | 'area' = 'line';
  export let data: any[] = [];
  export let autoResize: boolean = true;
  export let theme: 'dark' | 'light' = 'dark';
  
  // Component state
  let chartContainer: HTMLDivElement;
  let chart: IChartApi | null = null;
  let series: ISeriesApi<any> | null = null;
  let resizeObserver: ResizeObserver | null = null;
  
  // Events
  const dispatch = createEventDispatcher<{
    chartReady: { chart: IChartApi; series: ISeriesApi<any> };
    dataUpdated: { data: any[] };
    resize: { width: number; height: number };
  }>();
  
  // Default chart configuration
  const getDefaultOptions = (): DeepPartial<ChartOptions> => ({
    width,
    height,
    layout: {
      background: { color: theme === 'dark' ? 'transparent' : '#ffffff' },
      textColor: theme === 'dark' ? '#9ca3af' : '#374151'
    },
    grid: {
      vertLines: { color: theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' },
      horzLines: { color: theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }
    },
    rightPriceScale: {
      borderColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)'
    },
    timeScale: {
      borderColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)',
      timeVisible: true,
      secondsVisible: false
    },
    crosshair: {
      mode: 1 // Normal crosshair
    },
    handleScroll: true,
    handleScale: true
  });
  
  // Initialize chart
  function initializeChart() {
    if (!chartContainer || chart) return;
    
    try {
      // Merge default options with provided options
      const finalOptions = { ...getDefaultOptions(), ...chartOptions };
      
      // Create chart
      chart = createChart(chartContainer, finalOptions);
      
      // Create series based on type
      switch (seriesType) {
        case 'candlestick':
          series = chart.addCandlestickSeries({
            upColor: '#26a69a',
            downColor: '#ef5350',
            borderVisible: false,
            wickUpColor: '#26a69a',
            wickDownColor: '#ef5350'
          });
          break;
        case 'area':
          series = chart.addAreaSeries({
            lineColor: '#4CAF50',
            topColor: 'rgba(76, 175, 80, 0.4)',
            bottomColor: 'rgba(76, 175, 80, 0.0)'
          });
          break;
        case 'line':
        default:
          series = chart.addLineSeries({
            color: '#4CAF50',
            lineWidth: 2
          });
          break;
      }
      
      // Set initial data if provided
      if (data.length > 0) {
        series.setData(data);
      }
      
      // Setup auto-resize if enabled
      if (autoResize) {
        setupAutoResize();
      }
      
      // Dispatch ready event
      dispatch('chartReady', { chart, series });
      
    } catch (error) {
      console.error('Failed to initialize chart:', error);
    }
  }
  
  // Setup automatic resizing
  function setupAutoResize() {
    if (!chartContainer || !chart) return;
    
    resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width: newWidth, height: newHeight } = entry.contentRect;
        
        if (newWidth > 0 && newHeight > 0) {
          chart?.applyOptions({ 
            width: Math.floor(newWidth), 
            height: Math.floor(newHeight) 
          });
          
          dispatch('resize', { width: newWidth, height: newHeight });
        }
      }
    });
    
    resizeObserver.observe(chartContainer);
  }
  
  // Update chart data
  function updateData(newData: any[]) {
    if (series && newData.length > 0) {
      series.setData(newData);
      dispatch('dataUpdated', { data: newData });
    }
  }
  
  // Update chart theme
  function updateTheme(newTheme: 'dark' | 'light') {
    if (!chart) return;
    
    const themeOptions = getDefaultOptions();
    chart.applyOptions(themeOptions);
  }
  
  // Reactive updates
  $: if (chart && data) {
    updateData(data);
  }
  
  $: if (chart && theme) {
    updateTheme(theme);
  }
  
  $: if (chart && (width || height)) {
    chart.applyOptions({ width, height });
  }
  
  // Lifecycle
  onMount(() => {
    // Initialize chart after a brief delay to ensure DOM is ready
    setTimeout(initializeChart, 50);
  });
  
  onDestroy(() => {
    if (resizeObserver) {
      resizeObserver.disconnect();
    }
    
    if (chart) {
      chart.remove();
      chart = null;
      series = null;
    }
  });
  
  // Expose methods for parent components
  export function getChart(): IChartApi | null {
    return chart;
  }
  
  export function getSeries(): ISeriesApi<any> | null {
    return series;
  }
  
  export function fitContent() {
    if (chart) {
      chart.timeScale().fitContent();
    }
  }
  
  export function addData(newPoint: any) {
    if (series) {
      series.update(newPoint);
    }
  }
</script>

<div 
  bind:this={chartContainer}
  class="chart-container"
  style="width: {width}px; height: {height}px;"
>
  <slot name="loading">
    <div class="chart-loading">Loading chart...</div>
  </slot>
</div>

<style>
  .chart-container {
    position: relative;
    background: transparent;
    border-radius: 4px;
    overflow: hidden;
  }
  
  .chart-loading {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    color: #9ca3af;
    font-size: 14px;
    font-weight: 500;
  }
  
  /* Ensure chart fills container */
  .chart-container :global(div) {
    border-radius: inherit;
  }
</style>