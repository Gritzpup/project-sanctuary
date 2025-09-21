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
  export let granularity: string = '1m';
  export let period: string = '1H';
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
  
  // Initialize chart configuration with props
  $: {
    chartStore.updateConfig({ 
      granularity,
      timeframe: period
    });
  }
  
  onMount(async () => {
    console.log('ChartCore onMount called');
    
    try {
      // Initialize with real data first
      statusStore.setInitializing('Initializing chart...');
      
      // Wait for canvas to be available
      await new Promise(resolve => setTimeout(resolve, 200));
      
      console.log('Attempting to load real data...');
      statusStore.setInitializing('Loading real data...');
      
      try {
        // Try to load real data first
        await loadData();
        console.log('Real data loaded successfully');
        
        // Subscribe to real-time updates
        subscribeToRealtime();
        console.log('Real-time updates subscribed');
        
      } catch (realDataError) {
        console.warn('Real data failed, falling back to sample data:', realDataError);
        statusStore.setInitializing('Loading sample data...');
        await loadSampleData();
        console.log('Sample data loaded as fallback');
      }
      
      isInitialized = true;
      statusStore.setReady();
      console.log('Chart initialization complete');
      
      // Notify parent
      if (onReady && chartCanvas?.getChart()) {
        onReady(chartCanvas.getChart()!);
      }
      
    } catch (error) {
      console.error('Chart initialization failed:', error);
      statusStore.setError('Failed to initialize chart');
      
      // Try to set ready anyway
      isInitialized = true;
      statusStore.setReady();
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
  
  async function checkAndFillDataGaps() {
    const candles = dataStore.candles;
    if (candles.length === 0) return;
    
    const lastCandle = candles[candles.length - 1];
    const lastCandleTime = lastCandle.time as number;
    const currentTime = Math.floor(Date.now() / 1000);
    const config = chartStore.config;
    
    // Calculate expected time gap based on granularity
    const candleInterval = getGranularitySeconds(config.granularity);
    const timeDiff = currentTime - lastCandleTime;
    
    // If gap is more than 2 candle intervals, we need to fill it
    if (timeDiff > candleInterval * 2) {
      ChartDebug.log(`Data gap detected: ${timeDiff} seconds (${Math.floor(timeDiff / candleInterval)} candles)`);
      statusStore.setLoading('Filling data gap...');
      
      try {
        // Fetch missing data from last candle time to current time
        const gapData = await dataStore.fetchGapData(lastCandleTime, currentTime);
        
        if (gapData.length > 0) {
          ChartDebug.log(`Filled gap with ${gapData.length} candles`);
          
          // Merge gap data with existing candles
          const mergedCandles = [...candles, ...gapData].sort(
            (a, b) => (a.time as number) - (b.time as number)
          );
          
          dataStore.setCandles(mergedCandles);
          
          // Update chart series
          if (chartCanvas) {
            const series = chartCanvas.getSeries();
            if (series) {
              series.setData(mergedCandles);
            }
          }
        }
        
        statusStore.setReady();
      } catch (error) {
        ChartDebug.error('Error filling data gap:', error);
        statusStore.setError('Failed to fill data gap');
      }
    }
  }
  
  function getGranularitySeconds(granularity: string): number {
    const map: Record<string, number> = {
      '1m': 60,
      '5m': 300,
      '15m': 900,
      '1h': 3600,
      '4h': 14400,
      '1d': 86400,
      '1D': 86400
    };
    return map[granularity] || 60;
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
      },
      // onReconnect callback to handle data gaps
      async () => {
        ChartDebug.log('WebSocket reconnected, checking for data gaps...');
        await checkAndFillDataGaps();
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


  function subscribeToRealtime() {
    console.log('Subscribing to real-time data...');
    
    try {
      dataStore.subscribeToRealtime(
        (candle) => {
          console.log('Real-time candle update received:', candle);
          // The dataStore handles updating the chart automatically
        },
        (error) => {
          console.error('Real-time data error:', error);
        },
        () => {
          console.log('Real-time connection reconnected');
        }
      );
    } catch (error) {
      console.error('Failed to subscribe to real-time data:', error);
    }
  }

  async function loadSampleData() {
    console.log('Loading sample data...');
    
    // Generate simple sample data - just 50 candles for testing
    const now = Math.floor(Date.now() / 1000);
    const startTime = now - 3000; // 50 minutes ago (60 seconds per candle)
    const sampleCandles = [];
    
    let basePrice = 50000;
    
    for (let i = 0; i < 50; i++) {
      const time = startTime + (i * 60); // 1 minute intervals
      const volatility = 0.01;
      const change = (Math.random() - 0.5) * volatility;
      const price = basePrice * (1 + change);
      
      sampleCandles.push({
        time: time,
        open: basePrice,
        high: Math.max(basePrice, price) * (1 + Math.random() * 0.005),
        low: Math.min(basePrice, price) * (1 - Math.random() * 0.005),
        close: price,
        volume: Math.random() * 50 + 10
      });
      
      basePrice = price;
    }
    
    console.log(`Generated ${sampleCandles.length} sample candles`);
    
    // Set the data directly
    dataStore.setCandles(sampleCandles);
    
    // Force chart update - wait a bit then directly update the chart
    if (chartCanvas) {
      console.log('Forcing direct chart update...');
      
      setTimeout(() => {
        try {
          const chart = chartCanvas.getChart();
          const series = chartCanvas.getSeries();
          
          console.log('Direct update attempt:', {
            chart: !!chart,
            series: !!series,
            sampleDataLength: sampleCandles.length
          });
          
          if (chart && series) {
            console.log('Setting data directly to chart series');
            series.setData(sampleCandles);
            chart.timeScale().fitContent();
            console.log('Direct chart update successful - candles should be visible now!');
            
            // Update status to ready now that candles are visible
            statusStore.setReady();
            console.log('Chart status set to ready');
          } else {
            console.warn('Could not get chart or series for direct update');
          }
        } catch (e) {
          console.error('Error in direct chart update:', e);
        }
      }, 300);
    }
    
    console.log('Sample data loaded successfully');
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