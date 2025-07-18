<script lang="ts">
  import { onMount, onDestroy, setContext } from 'svelte';
  import type { IChartApi } from 'lightweight-charts';
  import { chartStore } from '../stores/chartStore.svelte';
  import { dataStore } from '../stores/dataStore.svelte';
  import { statusStore } from '../stores/statusStore.svelte';
  import { performanceStore } from '../stores/performanceStore.svelte';
  import { PluginManager } from '../plugins/base/PluginManager';
  import ChartCanvas from '../components/canvas/ChartCanvas.svelte';
  import { ChartDebug } from '../utils/debug';
  import { perfTest } from '../utils/performanceTest';
  
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
          ChartDebug.log(`Config change event received: ${event.type}`, event.data);
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
      ChartDebug.error('Initialization error:', error);
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
      }, 10); // Reduced from 100ms to 10ms for faster chart detection
      
      // Timeout after 1 second (reduced from 5 seconds)
      setTimeout(() => {
        clearInterval(checkInterval);
        resolve();
      }, 1000);
    });
  }
  
  async function loadData() {
    const loadStartTime = performance.now();
    perfTest.reset();
    perfTest.mark('loadData-start');
    
    const config = chartStore.config;
    if (config.timeframe === '3M' && config.granularity === '1d') {
      ChartDebug.critical(`[PERF FLOW START] Loading 3M/1d data at ${new Date().toISOString()}`);
      ChartDebug.critical(`[PERF] Step 1: Starting loadData()`);
    }
    
    statusStore.setLoading('Loading chart data...');
    chartStore.setLoading(true);
    
    try {
      const now = Math.floor(Date.now() / 1000);
      
      // Calculate time range based on period
      const periodSeconds = getPeriodSeconds(config.timeframe);
      const startTime = now - periodSeconds;
      
      // Consolidated debug for 3M/1d (reduce multiple log calls)
      if (config.timeframe === '3M' && config.granularity === '1d') {
        const debugInfo = {
          period: `${config.timeframe} = ${periodSeconds} seconds = ${periodSeconds / 86400} days`,
          now: `${now} (${new Date(now * 1000).toISOString()})`,
          start: `${startTime} (${new Date(startTime * 1000).toISOString()})`,
          expectedCandles: Math.ceil(periodSeconds / 86400)
        };
        ChartDebug.critical('Loading 3M/1d data:', debugInfo);
      }
      
      // Load data
      perfTest.mark('dataStore-loadData-start');
      await dataStore.loadData(
        pair,
        config.granularity,
        startTime,
        now
      );
      perfTest.measure('dataStore.loadData', 'dataStore-loadData-start');
      
      // Set visible range
      if (chartCanvas) {
        // Debug visible range setting (consolidated)
        if (config.timeframe === '3M' && config.granularity === '1d') {
          const visibleDays = ((now + 30) - startTime) / 86400;
          ChartDebug.critical('Setting visible range', {
            from: new Date(startTime * 1000).toISOString(),
            to: new Date((now + 30) * 1000).toISOString(),
            visibleDays: visibleDays.toFixed(1),
            note: "'+30' adds 30 seconds to end time for last candle visibility"
          });
        }
        chartCanvas.setVisibleRange(startTime, now + 30);
        
        // After setting, immediately check what candles are visible
        if (config.timeframe === '3M' && config.granularity === '1d') {
          // Remove setTimeout delays - execute immediately
          ChartDebug.critical(`After setVisibleRange, visible candles: ${dataStore.stats.visibleCount}`);
          ChartDebug.critical(`Total candles loaded: ${dataStore.stats.totalCount}`);
          
          // If not all candles are visible, force fit content
          if (dataStore.stats.visibleCount < dataStore.stats.totalCount) {
            ChartDebug.critical(`Not all candles visible! Calling fitContent() to show all ${dataStore.stats.totalCount} candles`);
            chartCanvas.fitContent();
            
            // Check again immediately
            ChartDebug.critical(`After fitContent, visible candles: ${dataStore.stats.visibleCount}`);
            
            // If still not showing all candles, manually calculate and set range
            if (dataStore.stats.visibleCount < dataStore.stats.totalCount && dataStore.candles.length > 0) {
              const firstCandle = dataStore.candles[0];
              const lastCandle = dataStore.candles[dataStore.candles.length - 1];
              const buffer = 86400; // 1 day buffer on each side
              
              ChartDebug.critical(`Manually setting range from first to last candle`);
              ChartDebug.critical(`First candle: ${new Date((firstCandle.time as number) * 1000).toISOString()}`);
              ChartDebug.critical(`Last candle: ${new Date((lastCandle.time as number) * 1000).toISOString()}`);
              
              // Use the new showAllCandles method
              chartCanvas.showAllCandles();
              ChartDebug.critical(`Called showAllCandles() to display all candles`);
            }
          }
        }
      }
      
      performanceStore.recordDataLoadTime(performance.now() - loadStartTime);
      statusStore.setReady();
      
      if (config.timeframe === '3M' && config.granularity === '1d') {
        const totalTime = performance.now() - loadStartTime;
        ChartDebug.critical(`[PERF FLOW END] Total loadData() time: ${totalTime}ms`);
        
        if (totalTime > 2000) {
          ChartDebug.critical(`[PERF WARNING] Loading took ${(totalTime/1000).toFixed(1)}s - this is too slow!`);
          ChartDebug.critical(`[PERF] Check the console for [PERF] logs to identify the bottleneck`);
        }
      }
      
      // Print performance report for 3M/1d
      if (config.timeframe === '3M' && config.granularity === '1d') {
        perfTest.measure('Total loadData', 'loadData-start');
        perfTest.getReport();
      }
    } catch (error) {
      ChartDebug.error('Error loading data:', error);
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