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
  import { getGranularitySeconds } from '../utils/granularityHelpers';
  import { useDataLoader } from '../hooks/useDataLoader.svelte';
  import { useRealtimeSubscription } from '../hooks/useRealtimeSubscription.svelte';
  
  export let pair: string = 'BTC-USD';
  export let granularity: string = '1m';
  export let period: string = '1H';
  export let enablePlugins: boolean = true;
  export let onReady: ((chart: IChartApi) => void) | undefined = undefined;
  
  let chartCanvas: ChartCanvas;
  let pluginManager: PluginManager | null = null;
  let isInitialized = false;

  // Initialize data loader hook
  const dataLoader = useDataLoader({
    onDataLoaded: (candles) => {
      ChartDebug.log(`Data loaded: ${candles.length} candles`);
    },
    onGapFilled: (gapData) => {
      ChartDebug.log(`Gap filled with ${gapData.length} candles`);
    },
    onError: (error) => {
      ChartDebug.error('Data loader error:', error);
    }
  });
  
  // Initialize realtime subscription hook
  const realtimeSubscription = useRealtimeSubscription({
    onPriceUpdate: (price) => {
      // Price updates are handled internally by the hook
    },
    onNewCandle: (candle) => {
    },
    onReconnect: () => {
      ChartDebug.log('Real-time connection reconnected');
    },
    onError: (error) => {
      ChartDebug.error('Real-time subscription error:', error);
    }
  });
  
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

  // Reload data when granularity or period changes (after initial mount)
  $: if (isInitialized && (granularity || period)) {
    reloadDataForNewTimeframe();
  }

  async function reloadDataForNewTimeframe() {
    try {
      console.log(`Reloading data for ${granularity} + ${period}`);
      statusStore.setLoading('Updating timeframe...');
      
      // Unsubscribe from current real-time updates
      realtimeSubscription.unsubscribeFromRealtime();
      
      // Reload data with new timeframe
      await dataLoader.loadData({
        pair,
        granularity,
        timeframe: period,
        chart: chartCanvas?.getChart(),
        series: chartCanvas?.getSeries()
      });
      
      // Apply proper positioning for small datasets
      setTimeout(() => {
        if (chartCanvas) {
          chartCanvas.fitContent();
        }
      }, 100);
      
      // Resubscribe to real-time updates with new granularity
      realtimeSubscription.subscribeToRealtime({
        pair,
        granularity
      }, chartCanvas?.getSeries(), chartCanvas?.getVolumeSeries());
      
      statusStore.setReady();
      console.log(`Data reloaded for ${granularity} + ${period}`);
    } catch (error) {
      console.error('Failed to reload data for new timeframe:', error);
      statusStore.setError('Failed to update timeframe');
    }
  }
  
  async function handleChartReady(chart: IChartApi) {
    
    // Initialize plugin manager if plugins are enabled
    if (enablePlugins) {
      pluginManager = new PluginManager();
      
      await pluginManager.setContext({
        chart,
        dataStore,
        chartStore,
        statusStore
      });
    }
    
    // Notify parent component that chart is ready
    if (onReady) {
      onReady(chart);
    }
  }

  onMount(async () => {
    
    try {
      // Initialize chart with proper data flow
      statusStore.setInitializing('Loading chart...');
      
      // Force status to ready after a short delay if we don't get data updates
      setTimeout(() => {
        statusStore.setReady();
      }, 3000);
      
      // Wait for canvas to be available
      await new Promise(resolve => setTimeout(resolve, 200));
      
      statusStore.setInitializing('Loading chart data...');
      
      // Use the data loader hook
      await dataLoader.loadData({
        pair,
        granularity,
        timeframe: period,
        chart: chartCanvas?.getChart(),
        series: chartCanvas?.getSeries()
      });
      
      // Check for data gaps and fill them
      await dataLoader.checkAndFillDataGaps(chartCanvas?.getChart(), chartCanvas?.getSeries());
      
      // Subscribe to real-time updates
      realtimeSubscription.subscribeToRealtime({
        pair,
        granularity
      }, chartCanvas?.getSeries(), chartCanvas?.getVolumeSeries());
      
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
      
    } catch (error) {
      console.error('Chart initialization failed:', error);
      statusStore.setError('Failed to initialize chart: ' + error.message);
    }
  });
  
  onDestroy(async () => {
    performanceStore.stopMonitoring();
    realtimeSubscription.unsubscribeFromRealtime();
    
    if (pluginManager) {
      await pluginManager.destroy();
    }
    
    chartStore.reset();
    dataStore.reset();
    statusStore.reset();
  });
  
  
  export function getPluginManager(): PluginManager | null {
    return pluginManager;
  }
  
  export function fitContent() {
    const chart = chartCanvas?.getChart();
    if (!chart) return;
    
    const candleCount = getCandleCount(granularity, period) || 60;
    
    if (candleCount <= 20) {
      // For small datasets like 5m+1H (12 candles), spread across 2/3 of chart width
      const candles = dataStore.candles;
      if (candles.length > 0) {
        const firstTime = candles[0].time as number;
        const lastTime = candles[candles.length - 1].time as number;
        const dataRange = lastTime - firstTime;
        
        // Extend the range so candles fill most of chart, with proper right gap
        const extendedRange = dataRange * 1.2; // Spread data wider
        const rightGap = dataRange * 0.3; // Add gap after last candle
        
        chart.timeScale().setVisibleRange({
          from: firstTime as any,
          to: (lastTime + rightGap) as any
        });
        
        console.log(`5m chart positioned: ${candles.length} candles across 2/3 width`);
      }
    } else {
      // For normal datasets, use default fitContent
      chartCanvas?.fitContent();
    }
  }

  export function scrollToCurrentCandle() {
    chartCanvas?.scrollToCurrentCandle();
  }
  
  export function getChart(): IChartApi | null {
    return chartCanvas?.getChart() || null;
  }
  
  export function addMarkers(markers: any[]) {
    if (!chartCanvas) {
      console.error('ChartCore: ChartCanvas not available for adding markers');
      return;
    }
    console.log('ChartCore: Forwarding addMarkers to ChartCanvas with', markers.length, 'markers');
    chartCanvas.addMarkers(markers);
  }
  
  export function addMarker(marker: any) {
    addMarkers([marker]);
  }
  
  export function clearMarkers() {
    if (!chartCanvas) {
      console.error('ChartCore: ChartCanvas not available for clearing markers');
      return;
    }
    console.log('ChartCore: Forwarding clearMarkers to ChartCanvas');
    chartCanvas.clearMarkers();
  }

  export function show60Candles() {
    if (!chartCanvas) {
      console.error('ChartCore: ChartCanvas not available for show60Candles');
      return;
    }
    
    // Check dataset size and use appropriate positioning
    const candles = dataStore.candles;
    if (candles.length <= 20) {
      console.log('ChartCore: Small dataset detected, using fitContent with right gap');
      chartCanvas.fitContent();
    } else {
      console.log('ChartCore: Normal dataset, using 60 candle view');
      chartCanvas.show60Candles();
    }
  }
</script>

<div class="chart-core">
  <ChartCanvas 
    bind:this={chartCanvas}
    onChartReady={handleChartReady}
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
    min-width: 0;
    max-width: 100%;
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }
</style>