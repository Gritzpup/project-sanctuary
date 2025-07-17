<script lang="ts">
  import { onMount, onDestroy, setContext } from 'svelte';
  import type { IChartApi } from 'lightweight-charts';
  import { chartStore } from '../stores/chartStore.svelte';
  import { dataStore } from '../stores/dataStore.svelte';
  import { statusStore } from '../stores/statusStore.svelte';
  import { performanceStore } from '../stores/performanceStore.svelte';
  import { PluginManager } from '../plugins/base/PluginManager';
  import ChartCanvas from '../components/canvas/ChartCanvas.svelte';
  
  export let pair: string = 'BTC-USD';
  export let enablePlugins: boolean = true;
  export let onReady: ((chart: IChartApi) => void) | undefined = undefined;
  
  let chartCanvas: ChartCanvas;
  let pluginManager: PluginManager | null = null;
  let isInitialized = false;
  
  // Set up chart context for child components
  const chartContext = {
    getChart: () => chartCanvas?.getChart(),
    getSeries: () => chartCanvas?.getSeries(),
    getPluginManager: () => pluginManager,
    stores: {
      chart: chartStore,
      data: dataStore,
      status: statusStore,
      performance: performanceStore
    }
  };
  
  setContext('chart', chartContext);
  
  onMount(async () => {
    performanceStore.startMonitoring();
    statusStore.setInitializing('Initializing chart core...');
    
    try {
      // Initialize plugin manager if enabled
      if (enablePlugins) {
        pluginManager = new PluginManager();
        
        // Set plugin context after chart is ready
        const unsubscribe = await waitForChart();
        
        if (chartCanvas) {
          await pluginManager.setContext({
            chart: chartCanvas.getChart()!,
            dataStore,
            chartStore,
            statusStore
          });
        }
      }
      
      // Load initial data
      await loadData();
      
      // Subscribe to real-time updates
      subscribeToRealtime();
      
      // Subscribe to configuration changes
      const unsubscribeConfig = chartStore.subscribeToEvents(async (event) => {
        if (event.type === 'period-change' || event.type === 'granularity-change') {
          await loadData();
        }
      });
      
      isInitialized = true;
      statusStore.setReady();
      
      // Notify parent that chart is ready
      if (onReady && chartCanvas) {
        const chart = chartCanvas.getChart();
        if (chart) {
          onReady(chart);
        }
      }
      
      // Cleanup
      return () => {
        unsubscribeConfig();
      };
    } catch (error) {
      console.error('ChartCore: Initialization error:', error);
      statusStore.setError(error instanceof Error ? error.message : 'Failed to initialize chart');
      chartStore.setError(error instanceof Error ? error.message : 'Unknown error');
    }
  });
  
  onDestroy(async () => {
    performanceStore.stopMonitoring();
    dataStore.unsubscribeFromRealtime();
    
    if (pluginManager) {
      await pluginManager.destroy();
    }
    
    chartStore.reset();
    dataStore.reset();
    statusStore.reset();
  });
  
  async function waitForChart(): Promise<void> {
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (chartCanvas?.getChart()) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);
      
      // Timeout after 5 seconds
      setTimeout(() => {
        clearInterval(checkInterval);
        resolve();
      }, 5000);
    });
  }
  
  async function loadData() {
    const startTime = performance.now();
    statusStore.setLoading('Loading chart data...');
    chartStore.setLoading(true);
    
    try {
      const config = chartStore.config;
      const now = Math.floor(Date.now() / 1000);
      
      // Calculate time range based on period
      const periodSeconds = getPeriodSeconds(config.timeframe);
      const startTime = now - periodSeconds;
      
      // Load data
      await dataStore.loadData(
        pair,
        config.granularity,
        startTime,
        now
      );
      
      // Set visible range
      if (chartCanvas) {
        chartCanvas.setVisibleRange(startTime, now + 30);
      }
      
      performanceStore.recordDataLoadTime(performance.now() - startTime);
      statusStore.setReady();
    } catch (error) {
      console.error('ChartCore: Error loading data:', error);
      statusStore.setError('Failed to load data');
      chartStore.setError(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      chartStore.setLoading(false);
    }
  }
  
  function subscribeToRealtime() {
    dataStore.subscribeToRealtime(
      pair,
      chartStore.config.granularity,
      (candle) => {
        if (chartCanvas) {
          const series = chartCanvas.getSeries();
          if (series) {
            const startTime = performance.now();
            series.update(candle);
            performanceStore.recordRenderTime(performance.now() - startTime);
            performanceStore.recordCandleUpdate();
            
            // Update status for new candles
            const existingCandle = dataStore.candles.find(c => c.time === candle.time);
            if (!existingCandle) {
              statusStore.setNewCandle();
            } else {
              statusStore.setPriceUpdate();
            }
          }
        }
      }
    );
  }
  
  function getPeriodSeconds(period: string): number {
    const periodMap: Record<string, number> = {
      '1H': 3600,
      '6H': 21600,
      '1D': 86400,
      '1W': 604800,
      '1M': 2592000,
      '3M': 7776000,
      '1Y': 31536000
    };
    return periodMap[period] || 3600;
  }
  
  // Public methods for parent components
  export function getPluginManager(): PluginManager | null {
    return pluginManager;
  }
  
  export function fitContent() {
    chartCanvas?.fitContent();
  }
  
  export function getChart(): IChartApi | null {
    return chartCanvas?.getChart() || null;
  }
</script>

<div class="chart-core">
  <ChartCanvas 
    bind:this={chartCanvas}
    onChartReady={(chart) => {
      console.log('ChartCore: Canvas ready');
    }}
  />
  
  <slot name="overlays" />
  <slot name="controls" />
</div>

<style>
  .chart-core {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
  }
</style>