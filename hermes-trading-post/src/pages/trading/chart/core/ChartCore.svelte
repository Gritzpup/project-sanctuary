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
      ChartDebug.log('New candle created:', candle);
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
      console.log('🔥 ChartCore: About to call subscribeToRealtime');
      realtimeSubscription.subscribeToRealtime({
        pair,
        granularity
      }, chartCanvas?.getSeries());
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
    chartCanvas?.fitContent();
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