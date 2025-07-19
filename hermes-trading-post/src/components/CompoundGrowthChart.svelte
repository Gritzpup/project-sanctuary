<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { createChart, ColorType } from 'lightweight-charts';
  import type { IChartApi, ISeriesApi, LineData } from 'lightweight-charts';
  
  export let vaultData: Array<{time: number; value: number}> = [];
  export let btcData: Array<{time: number; value: number}> = [];
  export let totalValueData: Array<{time: number; value: number}> = [];
  export let initialBalance: number = 10000;
  
  let chartContainer: HTMLDivElement;
  let chart: IChartApi | null = null;
  let vaultSeries: ISeriesApi<'Line'> | null = null;
  let btcSeries: ISeriesApi<'Line'> | null = null;
  let totalSeries: ISeriesApi<'Line'> | null = null;
  let buyHoldSeries: ISeriesApi<'Line'> | null = null;
  
  function initChart() {
    if (!chartContainer) return;
    
    // Create chart
    chart = createChart(chartContainer, {
      width: chartContainer.clientWidth,
      height: 300,
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
        mouseWheel: false,
        pressedMouseMove: false,
        horzTouchDrag: false,
        vertTouchDrag: false
      },
      handleScale: {
        mouseWheel: false,
        pinch: false,
        axisPressedMouseMove: false
      }
    });
    
    // Create series
    vaultSeries = chart.addLineSeries({
      color: '#a78bfa',
      lineWidth: 2,
      title: 'Vault (USDC)',
    });
    
    btcSeries = chart.addLineSeries({
      color: '#fbbf24',
      lineWidth: 2,
      title: 'BTC Holdings Value',
    });
    
    totalSeries = chart.addLineSeries({
      color: '#26a69a',
      lineWidth: 3,
      title: 'Total Portfolio',
    });
    
    buyHoldSeries = chart.addLineSeries({
      color: '#6b7280',
      lineWidth: 1,
      lineStyle: 2, // Dashed
      title: 'Buy & Hold',
    });
    
    updateChart();
    
    // Handle resize
    const handleResize = () => {
      if (chart && chartContainer) {
        chart.applyOptions({ 
          width: chartContainer.clientWidth,
          height: 300
        });
      }
    };
    
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }
  
  function updateChart() {
    if (!chart || !vaultSeries || !btcSeries || !totalSeries || !buyHoldSeries) return;
    if (!vaultData || vaultData.length === 0) return;
    
    // Set vault data
    vaultSeries.setData(vaultData);
    
    // Set BTC value data (in USD)
    btcSeries.setData(btcData);
    
    // Set total portfolio value
    totalSeries.setData(totalValueData);
    
    // Create buy & hold comparison line
    if (btcData.length > 0) {
      const firstPrice = btcData[0].value;
      const buyHoldData = btcData.map(point => ({
        time: point.time,
        value: initialBalance * (point.value / firstPrice)
      }));
      buyHoldSeries.setData(buyHoldData);
    }
    
    // Fit content
    chart.timeScale().fitContent();
  }
  
  onMount(() => {
    const cleanup = initChart();
    return cleanup;
  });
  
  onDestroy(() => {
    if (chart) {
      chart.remove();
      chart = null;
    }
  });
  
  // Update chart when data changes
  $: if (chart && vaultData) {
    updateChart();
  }
</script>

<div bind:this={chartContainer} class="compound-growth-chart">
  {#if !vaultData || vaultData.length === 0}
    <div class="no-data">
      <p>Run a backtest to see compound growth visualization</p>
    </div>
  {/if}
</div>

<style>
  .compound-growth-chart {
    width: 100%;
    height: 300px;
    position: relative;
    background: #0f1419;
    border-radius: 8px;
    margin-top: 20px;
  }
  
  .no-data {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    text-align: center;
    color: #9ca3af;
  }
</style>