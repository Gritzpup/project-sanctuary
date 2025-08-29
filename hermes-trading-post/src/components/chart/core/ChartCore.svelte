<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { createChart, ColorType } from 'lightweight-charts';
  import type { IChartApi, ISeriesApi } from 'lightweight-charts';
  
  export let width: number = 800;
  export let height: number = 400;
  export let data: any[] = [];
  export let enableZoom: boolean = true;
  export let autoScroll: boolean = true;
  
  // Chart instances exported for parent components
  export let chartInstance: IChartApi | null = null;
  export let candleSeriesInstance: ISeriesApi<'Candlestick'> | null = null;
  
  let chartContainer: HTMLDivElement;
  let resizeObserver: ResizeObserver | null = null;
  
  function initChart() {
    if (!chartContainer) return;
    
    // Create chart with dark theme
    chartInstance = createChart(chartContainer, {
      width: chartContainer.clientWidth,
      height: chartContainer.clientHeight || height,
      layout: {
        background: { type: ColorType.Solid, color: '#0f1419' },
        textColor: '#d1d4dc',
      },
      grid: {
        vertLines: { color: '#1f2937' },
        horzLines: { color: '#1f2937' },
      },
      timeScale: {
        borderColor: '#1f2937',
        timeVisible: true,
        secondsVisible: false,
      },
      rightPriceScale: {
        borderColor: '#1f2937',
      },
      handleScroll: {
        mouseWheel: enableZoom,
        pressedMouseMove: enableZoom,
        horzTouchDrag: enableZoom,
        vertTouchDrag: false
      },
      handleScale: {
        mouseWheel: enableZoom,
        pinch: enableZoom,
        axisPressedMouseMove: false
      }
    });
    
    // Create candlestick series
    candleSeriesInstance = chartInstance.addCandlestickSeries({
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderUpColor: '#26a69a',
      borderDownColor: '#ef5350',
      wickUpColor: '#26a69a',
      wickDownColor: '#ef5350',
    });
    
    // Set initial data if available
    if (data && data.length > 0) {
      updateData(data);
    }
    
    // Handle resize
    const handleResize = () => {
      if (chartInstance && chartContainer) {
        chartInstance.applyOptions({ 
          width: chartContainer.clientWidth,
          height: chartContainer.clientHeight || height
        });
      }
    };
    
    window.addEventListener('resize', handleResize);
    
    // Observe container size changes
    resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(chartContainer);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      if (resizeObserver) {
        resizeObserver.disconnect();
        resizeObserver = null;
      }
    };
  }
  
  export function updateData(newData: any[]) {
    if (!candleSeriesInstance || !newData || newData.length === 0) return;
    
    // Ensure data is properly formatted
    const formattedData = newData.map(candle => ({
      time: candle.time > 1000000000000 ? Math.floor(candle.time / 1000) : candle.time,
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close
    }));
    
    candleSeriesInstance.setData(formattedData);
    
    // Auto-scroll to latest candle if enabled
    if (autoScroll && chartInstance) {
      chartInstance.timeScale().scrollToPosition(0, false);
    }
  }
  
  export function addMarker(marker: any) {
    if (!candleSeriesInstance) return;
    candleSeriesInstance.setMarkers([marker]);
  }
  
  export function fitContent() {
    if (!chartInstance) return;
    chartInstance.timeScale().fitContent();
  }
  
  export function scrollToPosition(position: number) {
    if (!chartInstance) return;
    chartInstance.timeScale().scrollToPosition(position, false);
  }
  
  // React to data changes
  $: if (candleSeriesInstance && data) {
    updateData(data);
  }
  
  onMount(() => {
    const cleanup = initChart();
    return cleanup;
  });
  
  onDestroy(() => {
    if (chartInstance) {
      chartInstance.remove();
      chartInstance = null;
    }
    if (resizeObserver) {
      resizeObserver.disconnect();
    }
  });
</script>

<div class="chart-container" bind:this={chartContainer}></div>

<style>
  .chart-container {
    width: 100%;
    height: 100%;
    position: relative;
  }
</style>