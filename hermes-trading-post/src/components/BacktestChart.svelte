<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { createChart, ColorType } from 'lightweight-charts';
  import type { IChartApi, ISeriesApi } from 'lightweight-charts';
  import type { CandleData } from '../types/coinbase';
  
  export let data: CandleData[] = [];
  export let trades: any[] = [];
  
  let chartContainer: HTMLDivElement;
  let chart: IChartApi | null = null;
  let candleSeries: ISeriesApi<'Candlestick'> | null = null;
  let markerSeries: any[] = [];
  
  function initChart() {
    if (!chartContainer) return;
    
    // Create chart
    chart = createChart(chartContainer, {
      width: chartContainer.clientWidth,
      height: chartContainer.clientHeight || 400,
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
    });
    
    // Create candlestick series
    candleSeries = chart.addCandlestickSeries({
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderUpColor: '#26a69a',
      borderDownColor: '#ef5350',
      wickUpColor: '#26a69a',
      wickDownColor: '#ef5350',
    });
    
    updateChart();
    
    // Handle resize
    const handleResize = () => {
      if (chart && chartContainer) {
        chart.applyOptions({ 
          width: chartContainer.clientWidth,
          height: chartContainer.clientHeight || 400
        });
      }
    };
    
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }
  
  function updateChart() {
    console.log('updateChart called:', { candleSeries: !!candleSeries, dataLength: data?.length || 0 });
    
    if (!candleSeries || !data || data.length === 0) {
      console.log('updateChart: Early return - missing requirements');
      return;
    }
    
    // Log sample data to verify format
    if (data.length > 0) {
      console.log('updateChart: Sample data item:', data[0]);
      console.log('updateChart: Data item keys:', Object.keys(data[0]));
    }
    
    try {
      // Set candlestick data
      candleSeries.setData(data);
      console.log('updateChart: Data set on series successfully');
    } catch (error) {
      console.error('updateChart: Error setting data:', error);
    }
    
    // Add trade markers if available
    if (trades && trades.length > 0) {
      const markers = trades.map(trade => ({
        time: trade.timestamp / 1000, // Convert to seconds
        position: trade.type === 'buy' ? 'belowBar' : 'aboveBar',
        color: trade.type === 'buy' ? '#26a69a' : '#ef5350',
        shape: trade.type === 'buy' ? 'arrowUp' : 'arrowDown',
        text: `${trade.type.toUpperCase()} @ ${trade.price.toFixed(2)}`,
      }));
      
      candleSeries.setMarkers(markers);
    }
    
    // Fit content
    if (chart) {
      chart.timeScale().fitContent();
      console.log('updateChart: Chart fitted to content');
    }
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
  $: if (chart && candleSeries && data) {
    console.log('BacktestChart: Data changed, updating chart with', data.length, 'candles');
    updateChart();
  }
  
  // Log when data prop changes
  $: console.log('BacktestChart: data prop updated:', data?.length || 0, 'candles', 'chart ready:', !!chart);
</script>

<div bind:this={chartContainer} class="backtest-chart-container">
  {#if !data || data.length === 0}
    <div class="no-data">
      <p>No data to display</p>
      <p class="hint">Run a backtest to see results</p>
    </div>
  {/if}
</div>

<style>
  .backtest-chart-container {
    width: 100%;
    height: 100%;
    min-height: 400px;
    position: relative;
    background: #0f1419;
    border-radius: 8px;
    overflow: hidden;
  }
  
  .no-data {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    text-align: center;
    color: #9ca3af;
  }
  
  .no-data p {
    margin: 10px 0;
  }
  
  .hint {
    font-size: 14px;
    color: #6b7280;
  }
</style>