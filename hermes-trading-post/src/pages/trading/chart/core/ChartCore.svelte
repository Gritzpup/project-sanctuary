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
    console.log('🚀🚀🚀 ChartCore onMount called - VERSION 6.0 - MEGA STATUS FORCE 🚀🚀🚀');
    
    try {
      // Initialize chart with proper data flow
      statusStore.setInitializing('Loading chart...');
      
      // Force status to ready after a short delay if we don't get data updates
      setTimeout(() => {
        console.log('[ChartCore] Fallback - forcing status to ready after 3 seconds');
        statusStore.setReady();
      }, 3000);
      
      // Wait for canvas to be available
      await new Promise(resolve => setTimeout(resolve, 200));
      
      console.log('Loading chart data using proper data flow...');
      statusStore.setInitializing('Loading chart data...');
      
      // Use the existing sophisticated data loading system
      await loadData();
      
      // Check for data gaps and fill them
      await checkAndFillDataGaps();
      
      // Subscribe to real-time updates
      console.log('🔥 ChartCore: About to call subscribeToRealtime');
      subscribeToRealtime();
      console.log('✅ ChartCore: subscribeToRealtime called');
      
      // Set status to ready after data loads and chart is updated
      setTimeout(() => {
        isInitialized = true;
        statusStore.setReady();
      }, 100);
      
      // Additional safety check - set status again after a longer delay if still initializing
      setTimeout(() => {
        if (statusStore.status === 'initializing' || statusStore.status === 'loading') {
          console.log('Status still initializing after 1 second, forcing to ready');
          statusStore.setReady();
        }
      }, 1000);
      
      // Notify parent
      if (onReady && chartCanvas?.getChart()) {
        onReady(chartCanvas.getChart()!);
      }
      
    } catch (error) {
      console.error('Chart initialization failed:', error);
      statusStore.setError('Failed to initialize chart: ' + error.message);
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
      
      // Force chart update immediately after data loads
      if (chartCanvas && !dataStore.isEmpty) {
        console.log('Forcing chart update after data load...');
        const series = chartCanvas.getSeries();
        const chart = chartCanvas.getChart();
        
        if (series && chart) {
          console.log('Setting data directly to chart series:', dataStore.candles.length, 'candles');
          series.setData(dataStore.candles);
          chart.timeScale().fitContent();
          console.log('Chart data set successfully!');
        } else {
          console.warn('Chart or series not available for direct update');
        }
      }
      
      // Set visible range after a small delay to ensure chart is ready
      if (chartCanvas) {
        setTimeout(() => {
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
        }, 100);
        
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
    if (candles.length === 0) {
      console.log('[ChartCore] No candles to check for gaps');
      return;
    }
    
    const lastCandle = candles[candles.length - 1];
    const lastCandleTime = lastCandle.time as number;
    const currentTime = Math.floor(Date.now() / 1000);
    const config = chartStore.config;
    
    // Calculate expected time gap based on granularity
    const candleInterval = getGranularitySeconds(config.granularity);
    const timeDiff = currentTime - lastCandleTime;
    
    console.log(`[ChartCore] Gap check: Last candle ${new Date(lastCandleTime * 1000).toISOString()}, Current ${new Date(currentTime * 1000).toISOString()}, Gap: ${timeDiff}s`);
    
    // If gap is more than 1 candle interval, we need to fill it (reduced threshold)
    if (timeDiff > candleInterval) {
      ChartDebug.log(`Data gap detected: ${timeDiff} seconds (${Math.floor(timeDiff / candleInterval)} candles)`);
      statusStore.setLoading('Filling data gap...');
      
      try {
        // Try to fetch missing data from API
        const gapData = await dataStore.fetchGapData(lastCandleTime, currentTime);
        
        if (gapData.length > 0) {
          console.log(`[ChartCore] Filled gap with ${gapData.length} API candles`);
          
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
        } else {
          // If no API data available, create bridge candles to connect to real-time
          console.log(`[ChartCore] No API data for gap, creating bridge candles`);
          const bridgeCandles = createBridgeCandles(lastCandleTime, currentTime, candleInterval);
          
          if (bridgeCandles.length > 0) {
            const mergedCandles = [...candles, ...bridgeCandles].sort(
              (a, b) => (a.time as number) - (b.time as number)
            );
            
            dataStore.setCandles(mergedCandles);
            
            if (chartCanvas) {
              const series = chartCanvas.getSeries();
              if (series) {
                series.setData(mergedCandles);
              }
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
  
  function createBridgeCandles(lastCandleTime: number, currentTime: number, interval: number) {
    const bridgeCandles = [];
    const lastCandle = dataStore.candles[dataStore.candles.length - 1];
    
    if (!lastCandle) return bridgeCandles;
    
    let nextTime = lastCandleTime + interval;
    const lastPrice = lastCandle.close;
    
    console.log(`[ChartCore] Creating bridge candles from ${new Date(nextTime * 1000).toISOString()} to ${new Date(currentTime * 1000).toISOString()}`);
    
    // Create bridge candles with flat price data (no movement)
    while (nextTime < currentTime) {
      bridgeCandles.push({
        time: nextTime,
        open: lastPrice,
        high: lastPrice,
        low: lastPrice,
        close: lastPrice,
        volume: 0 // Zero volume for bridge candles
      });
      nextTime += interval;
    }
    
    console.log(`[ChartCore] Created ${bridgeCandles.length} bridge candles`);
    return bridgeCandles;
  }
  
  function subscribeToRealtime() {
    console.log('🔌 Setting up real-time chart updates via backend WebSocket...');
    console.log('🔌 Calling dataStore.subscribeToRealtime with:', pair, granularity);
    
    // Use dataStore to connect to backend WebSocket instead of Coinbase directly
    dataStore.subscribeToRealtime(
      pair,
      granularity,
      (candleData) => {
        console.log('📊 Received candle update from backend:', candleData);
        updateLiveCandleWithPrice(candleData.close);
        statusStore.setPriceUpdate();
      },
      () => {
        console.log('🔄 Backend WebSocket reconnected');
        statusStore.setReady();
      }
    );
    
    console.log('✅ Backend WebSocket subscription active');
    
    // Also keep Coinbase for price updates but don't use it for status
    import('../../../../services/api/coinbaseWebSocket').then(({ coinbaseWebSocket }) => {
      console.log('📡 Also subscribing to Coinbase for additional price data');
      
      // Don't update status based on Coinbase - only use backend WebSocket for status
      coinbaseWebSocket.subscribeTicker('BTC-USD');
      
      // Subscribe to ticker updates as backup price source
      const unsubscribe = coinbaseWebSocket.subscribe((tickerData) => {
        if (tickerData.product_id === 'BTC-USD' && tickerData.price) {
          updateLiveCandleWithPrice(parseFloat(tickerData.price));
          // Update status to show we're receiving real-time data
          statusStore.setReady();
        }
      });
      
      // Store unsubscribe function for cleanup
      dataStore.realtimeUnsubscribe = unsubscribe;
    });
  }
  
  function updateLiveCandleWithPrice(price: number) {
    if (!chartCanvas) return;
    
    const series = chartCanvas.getSeries();
    if (!series) return;
    
    const candles = dataStore.candles;
    if (candles.length === 0) return;
    
    // Get current minute timestamp
    const now = Date.now();
    const currentMinute = Math.floor(now / 60000) * 60; // Round down to minute in seconds
    const lastCandle = candles[candles.length - 1];
    const lastCandleTime = lastCandle.time as number;
    
    if (currentMinute > lastCandleTime) {
      // New candle needed
      const newCandle = {
        time: currentMinute,
        open: price,
        high: price,
        low: price,
        close: price,
        volume: 0.1
      };
      
      console.log('[ChartCore] Creating new real-time candle at', new Date(currentMinute * 1000).toISOString());
      
      // Add to dataStore
      const updatedCandles = [...candles, newCandle];
      dataStore.setCandles(updatedCandles);
      
      // Update chart
      series.setData(updatedCandles);
      statusStore.setNewCandle();
    } else {
      // Update current candle
      const updatedCandles = [...candles];
      const currentCandle = updatedCandles[updatedCandles.length - 1];
      
      const updatedCandle = {
        ...currentCandle,
        high: Math.max(currentCandle.high, price),
        low: Math.min(currentCandle.low, price),
        close: price,
        volume: currentCandle.volume + 0.01
      };
      
      updatedCandles[updatedCandles.length - 1] = updatedCandle;
      dataStore.setCandles(updatedCandles);
      
      // Update chart with live candle
      series.update(updatedCandle);
      statusStore.setPriceUpdate();
      
      // Ensure status stays ready during price updates
      if (statusStore.status !== 'ready') {
        statusStore.setReady();
      }
    }
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