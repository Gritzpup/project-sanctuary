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
  let resizeObserver: ResizeObserver | null = null;
  
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
    
    // Also observe container size changes (for sidebar collapse/expand)
    resizeObserver = new ResizeObserver(() => {
      handleResize();
    });
    resizeObserver.observe(chartContainer);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      if (resizeObserver) {
        resizeObserver.disconnect();
        resizeObserver = null;
      }
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
      console.log('updateChart: First candle time:', data[0].time);
      console.log('updateChart: Last candle time:', data[data.length - 1].time);
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
      console.log('updateChart: Processing trades for markers:', trades);
      
      // Debug: Log candle time range
      const candleTimeRange = {
        first: data[0]?.time,
        last: data[data.length - 1]?.time,
        firstDate: data[0] ? new Date(data[0].time * 1000).toISOString() : 'none',
        lastDate: data[data.length - 1] ? new Date(data[data.length - 1].time * 1000).toISOString() : 'none'
      };
      console.log('Candle time range:', candleTimeRange);
      console.log('Trade timestamps:', trades.map(t => ({
        timestamp: t.timestamp,
        date: new Date(t.timestamp * 1000).toISOString(),
        type: t.type,
        price: t.price
      })));
      
      // Verify trade timestamps are within candle range
      const tradesOutOfRange = trades.filter(t => t.timestamp < candleTimeRange.first || t.timestamp > candleTimeRange.last);
      if (tradesOutOfRange.length > 0) {
        console.error('WARNING: Found trades outside of candle time range:', tradesOutOfRange);
      }
      
      // Create markers for candlestick series
      const markers = trades.map((trade, index) => {
        // Trade timestamp is already in seconds (same as candle.time)
        const time = trade.timestamp;
        
        console.log(`Trade ${index}: timestamp=${trade.timestamp}, type=${trade.type}, price=${trade.price}`);
        
        // Check if trade time is within candle range
        if (time < candleTimeRange.first || time > candleTimeRange.last) {
          console.warn(`Trade ${index} time ${time} is outside candle range [${candleTimeRange.first}, ${candleTimeRange.last}]`);
        }
        
        return {
          time: time,
          position: trade.type === 'buy' ? 'belowBar' : 'aboveBar',
          color: trade.type === 'buy' ? '#26a69a' : '#ef5350',  // Match candle colors
          shape: trade.type === 'buy' ? 'arrowUp' : 'arrowDown',
          size: 2,  // Standard size
          text: `${trade.type.toUpperCase()} @ $${trade.price.toLocaleString()}`
        };
      });
      
      console.log('updateChart: Setting markers:', markers);
      candleSeries.setMarkers(markers);
    } else {
      console.log('updateChart: No trades to display as markers');
      // Clear any existing markers
      if (candleSeries) candleSeries.setMarkers([]);
    }
    
    // Fit content with a small delay to ensure markers are rendered
    if (chart) {
      setTimeout(() => {
        chart.timeScale().fitContent();
        console.log('updateChart: Chart fitted to content');
      }, 100);
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
  
  // Update chart when trades change
  $: if (chart && candleSeries && trades) {
    console.log('BacktestChart: Trades changed, updating chart with', trades.length, 'trades');
    updateChart();
  }
  
  // Log when data prop changes
  $: console.log('BacktestChart: data prop updated:', data?.length || 0, 'candles', 'chart ready:', !!chart);
  
  // Log when trades prop changes
  $: console.log('BacktestChart: trades prop updated:', trades?.length || 0, 'trades');
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