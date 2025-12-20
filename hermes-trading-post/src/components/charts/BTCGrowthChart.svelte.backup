<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { createChart, type IChartApi, type ISeriesApi } from 'lightweight-charts';
  
  export let data: Array<{time: number; value: number}>;
  
  let chartContainer: HTMLDivElement;
  let chart: IChartApi;
  let lineSeries: ISeriesApi<"Line">;
  
  onMount(() => {
    // Create chart
    chart = createChart(chartContainer, {
      width: chartContainer.clientWidth,
      height: 300,
      layout: {
        background: { color: 'transparent' },
        textColor: '#9ca3af',
      },
      grid: {
        vertLines: { color: 'rgba(255, 168, 0, 0.2)' },
        horzLines: { color: 'rgba(255, 168, 0, 0.2)' },
      },
      timeScale: {
        borderColor: 'rgba(255, 168, 0, 0.3)',
        timeVisible: true,
        secondsVisible: false,
      },
      rightPriceScale: {
        borderColor: 'rgba(255, 168, 0, 0.3)',
      },
    });
    
    // Add line series with Bitcoin orange color
    lineSeries = chart.addLineSeries({
      color: '#ffa800',
      lineWidth: 2,
      priceFormat: {
        type: 'price',
        precision: 8,
        minMove: 0.00000001,
      },
    });
    
    // Format data for lightweight-charts
    const formattedData = data.map(d => ({
      time: d.time / 1000, // Convert to seconds
      value: d.value
    }));
    
    lineSeries.setData(formattedData);
    
    // Fit content
    chart.timeScale().fitContent();
    
    // Handle resize
    const handleResize = () => {
      chart.applyOptions({ width: chartContainer.clientWidth });
    };
    
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  });
  
  onDestroy(() => {
    if (chart) {
      chart.remove();
    }
  });
</script>

<div bind:this={chartContainer} class="btc-growth-chart"></div>

<style>
  .btc-growth-chart {
    width: 100%;
    height: 300px;
  }
</style>