<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { createChart, type IChartApi, type ISeriesApi } from 'lightweight-charts';
  
  export let distribution: {
    daily: Map<string, number>;
    weekly: Map<string, number>;
    monthly: Map<string, number>;
  };
  
  let chartContainer: HTMLDivElement;
  let chart: IChartApi;
  let histogramSeries: ISeriesApi<"Histogram">;
  let currentView: 'daily' | 'weekly' | 'monthly' = 'daily';
  
  const updateChart = () => {
    if (!histogramSeries) return;
    
    let data: Array<{time: string; value: number; color: string}> = [];
    const selectedData = distribution[currentView];
    
    // Convert Map to array and format for chart
    selectedData.forEach((count, date) => {
      data.push({
        time: date,
        value: count,
        color: count > 10 ? '#26a69a' : count > 5 ? '#ffa726' : '#a78bfa'
      });
    });
    
    // Sort by date
    data.sort((a, b) => a.time.localeCompare(b.time));
    
    histogramSeries.setData(data);
    chart.timeScale().fitContent();
  };
  
  onMount(() => {
    // Create chart
    chart = createChart(chartContainer, {
      width: chartContainer.clientWidth,
      height: 250,
      layout: {
        background: { color: 'transparent' },
        textColor: '#9ca3af',
      },
      grid: {
        vertLines: { color: 'rgba(74, 0, 224, 0.2)' },
        horzLines: { color: 'rgba(74, 0, 224, 0.2)' },
      },
      timeScale: {
        borderColor: 'rgba(74, 0, 224, 0.3)',
        timeVisible: true,
        secondsVisible: false,
      },
      rightPriceScale: {
        borderColor: 'rgba(74, 0, 224, 0.3)',
      },
    });
    
    // Add histogram series
    histogramSeries = chart.addHistogramSeries({
      priceFormat: {
        type: 'price',
        precision: 0,
        minMove: 1,
      },
    });
    
    updateChart();
    
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
  
  $: if (chart && histogramSeries) {
    updateChart();
  }
</script>

<div class="distribution-chart">
  <div class="view-controls">
    <button 
      class="view-btn" 
      class:active={currentView === 'daily'}
      on:click={() => currentView = 'daily'}
    >
      Daily
    </button>
    <button 
      class="view-btn" 
      class:active={currentView === 'weekly'}
      on:click={() => currentView = 'weekly'}
    >
      Weekly
    </button>
    <button 
      class="view-btn" 
      class:active={currentView === 'monthly'}
      on:click={() => currentView = 'monthly'}
    >
      Monthly
    </button>
  </div>
  <div bind:this={chartContainer} class="chart-container"></div>
</div>

<style>
  .distribution-chart {
    width: 100%;
  }
  
  .view-controls {
    display: flex;
    gap: 10px;
    margin-bottom: 15px;
  }
  
  .view-btn {
    padding: 6px 12px;
    background: rgba(74, 0, 224, 0.2);
    border: 1px solid rgba(74, 0, 224, 0.3);
    color: #9ca3af;
    border-radius: 4px;
    font-size: 12px;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .view-btn:hover {
    background: rgba(74, 0, 224, 0.3);
    color: #d1d4dc;
  }
  
  .view-btn.active {
    background: rgba(74, 0, 224, 0.4);
    color: #a78bfa;
    border-color: #a78bfa;
  }
  
  .chart-container {
    width: 100%;
    height: 250px;
  }
</style>