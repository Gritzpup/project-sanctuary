<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { createChart, type IChartApi, type ISeriesApi, ColorType, type Time, type CandlestickSeriesOptions, CandlestickSeries } from 'lightweight-charts';
  import { ChartDataFeed } from '../services/chartDataFeed';
  import type { CandleData } from '../types/coinbase';

  let chartContainer: HTMLDivElement;
  let chart: IChartApi | null = null;
  let candleSeries: ISeriesApi<'Candlestick'> | any = null; // Using 'any' for v4/v5 compatibility
  let dataFeed: ChartDataFeed | null = null;

  export let status: 'connected' | 'disconnected' | 'error' | 'loading' = 'loading';
  export let granularity: string = '1m';
  export let period: string = '1H';
  
  // Internal state for auto-granularity
  let currentGranularity: string = granularity;
  let isAutoGranularity = true;
  let loadingNewGranularity = false;
  let cacheStatus = 'initializing';
  let loadProgress = 0;
  let isChangingPeriod = false; // Flag to prevent range changes during period switches
  let isAutoPeriod = true; // Flag for automatic period switching
  let currentPeriod: string = period;
  
  // Cleanup handlers
  let resizeHandler: (() => void) | null = null;
  let rangeChangeTimeout: any = null;
  
  // Map periods to days
  const periodToDays: Record<string, number> = {
    '1H': 1/24,
    '4H': 4/24,
    '5D': 5,
    '1M': 30,
    '3M': 90,
    '6M': 180,
    '1Y': 365,
    '5Y': 1825
  };
  
  // Map granularities to seconds - ONLY Coinbase supported values
  const granularityToSeconds: Record<string, number> = {
    '1m': 60,
    '5m': 300,
    '15m': 900,
    '1h': 3600,
    '6h': 21600,
    '1D': 86400
  };
  
  // Ordered arrays for easier navigation
  const periodOrder = ['1H', '4H', '5D', '1M', '3M', '6M', '1Y', '5Y'];
  const granularityOrder = ['1m', '5m', '15m', '1h', '6h', '1D'];
  
  // Function to load data based on granularity and period
  async function loadChartData(useGranularity?: string) {
    if (!candleSeries || !dataFeed || !chart) return;
    
    try {
      if (!loadingNewGranularity) {
        status = 'loading';
      }
      const days = periodToDays[period] || 30;
      const granularityToUse = useGranularity || currentGranularity;
      const seconds = granularityToSeconds[granularityToUse] || 86400;
      
      // Set the active granularity in the data feed
      dataFeed.setActiveGranularity(seconds);
      
      // Load more data than visible period to allow scrolling
      // For short periods, load at least 7 days; for longer periods, load 3x the period
      const daysToLoad = Math.max(days * 3, 7); // Load 3x period or minimum 7 days
      console.log(`Loading ${daysToLoad} days of data with ${granularityToUse} candles (${period} period)`);
      console.log(`Granularity: ${granularityToUse} (${seconds}s), Expected candles: ~${Math.floor(daysToLoad * 24 * 3600 / seconds)}`);
      
      const historicalData = await dataFeed.loadHistoricalDataWithGranularity(seconds, daysToLoad);
      console.log('Historical data loaded:', historicalData.length, 'candles');
      
      if (historicalData.length === 0) {
        console.error('No historical data received!');
        status = 'error';
        return;
      }
      
      // Convert time to proper format for lightweight-charts
      const chartData = historicalData.map(candle => ({
        ...candle,
        time: candle.time as Time
      }));
      
      candleSeries.setData(chartData);
      
      // Set visible range to show only the selected period
      if (!loadingNewGranularity) {
        const now = Math.floor(Date.now() / 1000);
        const periodSeconds = days * 24 * 60 * 60;
        const startTime = now - periodSeconds;
        
        // Set the visible range to show exactly the selected period
        chart.timeScale().setVisibleRange({
          from: startTime as Time,
          to: now as Time
        });
        
        console.log(`Set visible range: ${new Date(startTime * 1000).toISOString()} to ${new Date(now * 1000).toISOString()}`);
      }
      
      status = 'connected';
      loadingNewGranularity = false;
    } catch (error) {
      console.error('Error loading chart data:', error);
      status = 'error';
      loadingNewGranularity = false;
    }
  }
  
  // Function to handle zoom events and load more data
  let isLoadingMore = false;
  async function handleVisibleRangeChange() {
    if (!chart || !dataFeed || !candleSeries || isLoadingMore || loadingNewGranularity || manualGranularityLock || manualPeriodLock || isChangingPeriod) {
      if (isChangingPeriod) {
        console.log('Skipping handleVisibleRangeChange - period is changing');
      }
      return;
    }
    
    const timeScale = chart.timeScale();
    const visibleRange = timeScale.getVisibleRange();
    
    if (!visibleRange) return;
    
    const visibleFrom = Number(visibleRange.from);
    const visibleTo = Number(visibleRange.to);
    const visibleRangeSeconds = visibleTo - visibleFrom;
    
    // Check if we need to switch period (auto-period mode)
    if (isAutoPeriod) {
      const optimalPeriod = getOptimalPeriodForRange(visibleRangeSeconds);
      
      if (optimalPeriod !== currentPeriod) {
        console.log(`Auto-switching period from ${currentPeriod} to ${optimalPeriod}`);
        currentPeriod = optimalPeriod;
        period = optimalPeriod; // Update the exported prop
        
        // Also switch granularity when period changes
        const optimalGranularity = getOptimalGranularityForRange(visibleRangeSeconds);
        if (optimalGranularity !== currentGranularity) {
          currentGranularity = optimalGranularity;
          granularity = optimalGranularity; // Update the exported prop
        }
        
        isChangingPeriod = true;
        loadingNewGranularity = true;
        
        // Set the active granularity in the data feed
        dataFeed.setActiveGranularity(granularityToSeconds[currentGranularity]);
        
        // Load data for the new period and granularity
        await loadChartData(currentGranularity);
        
        // Restore the view to the same range
        timeScale.setVisibleRange(visibleRange);
        
        setTimeout(() => {
          isChangingPeriod = false;
          loadingNewGranularity = false;
        }, 500);
        
        return;
      }
    }
    
    // Check if we need to switch granularity (auto-granularity mode)
    if (isAutoGranularity) {
      const optimalGranularity = getOptimalGranularityForRange(visibleRangeSeconds);
      
      if (optimalGranularity !== currentGranularity) {
        console.log(`Switching granularity from ${currentGranularity} to ${optimalGranularity}`);
        loadingNewGranularity = true;
        currentGranularity = optimalGranularity;
        
        // Set the active granularity in the data feed
        dataFeed.setActiveGranularity(granularityToSeconds[optimalGranularity]);
        
        // Calculate days based on visible range
        const visibleDays = Math.ceil(visibleRangeSeconds / 86400);
        const daysToLoad = Math.max(visibleDays * 3, 7); // Load 3x visible range or minimum 7 days
        
        // Load data with new granularity
        await loadChartDataForRange(visibleFrom - visibleRangeSeconds, visibleTo + visibleRangeSeconds, optimalGranularity);
        
        // Restore the view to the same range
        timeScale.setVisibleRange(visibleRange);
        return;
      }
    }
    
    // Check if we need to load more historical data
    const allData = dataFeed.getAllData();
    if (allData.length > 0) {
      const firstDataTime = allData[0].time;
      const lastDataTime = allData[allData.length - 1].time;
      
      // Load more data if we're near the left edge
      if (visibleFrom < firstDataTime + (granularityToSeconds[currentGranularity] * 10)) {
        console.log('Near left edge, loading more historical data...');
        isLoadingMore = true;
        
        try {
          // Calculate how many days to load based on visible range
          const visibleDays = Math.ceil(visibleRangeSeconds / 86400);
          const daysToLoad = Math.max(visibleDays * 3, 30); // Load at least 30 days or 3x visible range
          
          const moreData = await dataFeed.loadMoreHistoricalData(
            granularityToSeconds[currentGranularity],
            daysToLoad
          );
          
          if (moreData.length > 0) {
            // Refresh all data from the feed
            const updatedData = dataFeed.getAllData().map(candle => ({
              ...candle,
              time: candle.time as Time
            }));
            
            // Remember current visible range
            const currentRange = timeScale.getVisibleRange();
            
            // Update data
            candleSeries.setData(updatedData);
            
            // Restore visible range
            if (currentRange) {
              timeScale.setVisibleRange(currentRange);
            }
          }
        } finally {
          isLoadingMore = false;
        }
      }
    }
  }
  
  // Get optimal granularity for a time range
  function getOptimalGranularityForRange(rangeSeconds: number): string {
    const optimal = dataFeed?.getOptimalGranularity(rangeSeconds) || 86400;
    
    // Map seconds back to string format
    for (const [key, value] of Object.entries(granularityToSeconds)) {
      if (value === optimal) {
        return key;
      }
    }
    return '1D';
  }
  
  // Get optimal period for a time range
  function getOptimalPeriodForRange(rangeSeconds: number): string {
    const rangeDays = rangeSeconds / 86400;
    
    // Find the smallest period that can contain the visible range
    // We want the period to be at least 1.5x the visible range for good context
    for (const period of periodOrder) {
      const periodDays = periodToDays[period];
      if (periodDays >= rangeDays * 0.5) {
        return period;
      }
    }
    return '5Y'; // Default to max if range is very large
  }
  
  // Load data for a specific time range
  async function loadChartDataForRange(startTime: number, endTime: number, granularityStr: string) {
    if (!candleSeries || !dataFeed || !chart) return;
    
    try {
      const seconds = granularityToSeconds[granularityStr] || 86400;
      
      // Set the active granularity in the data feed
      dataFeed.setActiveGranularity(seconds);
      
      const days = Math.ceil((endTime - startTime) / 86400);
      
      console.log(`Loading ${days} days for range with ${granularityStr} granularity`);
      
      const historicalData = await dataFeed.loadHistoricalDataWithGranularity(seconds, days);
      
      if (historicalData.length > 0) {
        const chartData = historicalData.map(candle => ({
          ...candle,
          time: candle.time as Time
        }));
        
        candleSeries.setData(chartData);
      }
      
      loadingNewGranularity = false;
    } catch (error) {
      console.error('Error loading chart data for range:', error);
      loadingNewGranularity = false;
    }
  }
  
  // Track previous values to detect changes
  let manualGranularityLock = false;
  let manualPeriodLock = false;
  let previousGranularity = granularity;
  let previousPeriod = period;
  
  // Watch for granularity changes
  $: if (candleSeries && dataFeed && chart && granularity !== previousGranularity) {
    handleGranularityChange();
  }
  
  // Watch for period changes
  $: if (candleSeries && dataFeed && chart && period !== previousPeriod) {
    handlePeriodChange();
  }
  
  function handleGranularityChange() {
    console.log(`Manual granularity change: ${previousGranularity} -> ${granularity}`);
    previousGranularity = granularity;
    isAutoGranularity = false;
    manualGranularityLock = true;
    currentGranularity = granularity;
    isChangingPeriod = true;
    
    loadChartData().then(() => {
      // Maintain visible range after manual granularity change
      const now = Math.floor(Date.now() / 1000);
      const days = periodToDays[period] || 1/24;
      const periodSeconds = days * 24 * 60 * 60;
      const startTime = now - periodSeconds;
      
      chart?.timeScale().setVisibleRange({
        from: startTime as Time,
        to: now as Time
      });
      manualGranularityLock = false;
      
      setTimeout(() => {
        isChangingPeriod = false;
      }, 500);
    });
  }
  
  function handlePeriodChange() {
    console.log('Period changed to:', period, 'days:', periodToDays[period]);
    
    // Check if this was a manual change or auto change
    const wasManualChange = period !== currentPeriod;
    
    previousPeriod = period;
    currentPeriod = period;
    
    if (wasManualChange) {
      console.log('Manual period change detected');
      isAutoPeriod = false;
      manualPeriodLock = true;
    }
    
    // Re-enable auto-granularity on period change unless manually locked
    if (!manualGranularityLock) {
      isAutoGranularity = true;
    }
    
    // Set flag to prevent handleVisibleRangeChange from interfering
    isChangingPeriod = true;
    
    // Force reload with new period
    loadChartData().then(() => {
      // Reset flag after a delay to ensure range is set
      setTimeout(() => {
        isChangingPeriod = false;
        if (wasManualChange) {
          manualPeriodLock = false;
        }
      }, 500);
    });
  }

  // Force initial data load
  async function forceLoadHistoricalData() {
    if (!dataFeed) return;
    
    cacheStatus = 'loading';
    console.log('Force loading historical data for all granularities...');
    
    // Access the loader through dataFeed
    try {
      // Start loading all historical data
      await dataFeed.loader.loadAllHistoricalData();
      cacheStatus = 'ready';
      // Reload current view
      await loadChartData();
    } catch (error) {
      console.error('Error force loading data:', error);
      cacheStatus = 'error';
    }
  }
  
  onMount(async () => {
    console.log('Chart component mounting...');
    console.log('Chart container size:', chartContainer?.clientWidth, 'x', chartContainer?.clientHeight);
    
    if (!chartContainer) {
      console.error('Chart container not found!');
      status = 'error';
      return;
    }
    
    if (chartContainer.clientWidth === 0 || chartContainer.clientHeight === 0) {
      console.error('Chart container has no size!');
      status = 'error';
      return;
    }
    
    // Initialize chart
    try {
      console.log('Creating chart...');
      
      chart = createChart(chartContainer, {
      width: chartContainer.clientWidth,
      height: chartContainer.clientHeight,
      layout: {
        background: { type: ColorType.Solid, color: '#1a1a1a' },
        textColor: '#d1d4dc',
      },
      grid: {
        vertLines: { color: '#2a2a2a' },
        horzLines: { color: '#2a2a2a' },
      },
      crosshair: {
        mode: 1,
      },
      rightPriceScale: {
        borderColor: '#2a2a2a',
      },
      timeScale: {
        borderColor: '#2a2a2a',
        timeVisible: true,
        secondsVisible: false,
      },
    });
      console.log('Chart created successfully:', chart);
      console.log('Available chart methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(chart)));
      
      // Check which API version we're using
      const chartMethods = Object.getOwnPropertyNames(Object.getPrototypeOf(chart));
      console.log('Chart methods available:', chartMethods.filter(m => m.includes('add')));
    } catch (error) {
      console.error('Failed to create chart:', error);
      status = 'error';
      return;
    }

    try {
      console.log('Adding candlestick series...');
      
      const seriesOptions = {
        upColor: '#26a69a',
        downColor: '#ef5350',
        borderVisible: false,
        wickUpColor: '#26a69a',
        wickDownColor: '#ef5350',
      };
      
      // v5 API: Use CandlestickSeries as first parameter
      console.log('Using v5 API: chart.addSeries(CandlestickSeries, options)');
      candleSeries = chart.addSeries(CandlestickSeries, seriesOptions);
      console.log('Candlestick series added successfully');
    } catch (error) {
      console.error('Failed to add candlestick series:', error);
      status = 'error';
      return;
    }

    // Initialize data feed
    console.log('Initializing data feed...');
    dataFeed = new ChartDataFeed();
    
    // Set initial active granularity
    dataFeed.setActiveGranularity(granularityToSeconds[currentGranularity] || 60);
    
    // Set loading status
    status = 'loading';

    try {
      // Load initial data based on timeframe
      await loadChartData();

      // Subscribe to real-time updates
      dataFeed.subscribe('chart', (candle: CandleData) => {
        candleSeries?.update({
          ...candle,
          time: candle.time as Time
        });
      });

      // Update status based on WebSocket connection
      dataFeed.ws.onStatus((wsStatus) => {
        status = wsStatus;
      });

      // Configure time scale for better zoom experience with large datasets
      chart.timeScale().applyOptions({
        rightOffset: 0, // No offset to show exact range
        barSpacing: 6,
        minBarSpacing: 0.1,
        fixLeftEdge: true, // Fix edges to show exact period
        fixRightEdge: true, // Fix edges to show exact period
        lockVisibleTimeRangeOnResize: true,
        rightBarStaysOnScroll: false, // Don't keep right bar on scroll
        borderVisible: false,
        borderColor: '#2a2a2a',
        visible: true,
        timeVisible: true,
        secondsVisible: granularityToSeconds[granularity] < 3600, // Show seconds for < 1h granularity
        allowBoldLabels: true,
        shiftVisibleRangeOnNewBar: false, // Don't shift on new bar to maintain exact period
      });

      // Don't use fitContent - we want to respect the period constraints
      // Instead, set the visible range to match the selected period
      const now = Math.floor(Date.now() / 1000);
      const days = periodToDays[period] || 1/24;
      const periodSeconds = days * 24 * 60 * 60;
      const startTime = now - periodSeconds;
      
      chart.timeScale().setVisibleRange({
        from: startTime as Time,
        to: now as Time
      });
      
      console.log(`Initial range set to ${period}: ${new Date(startTime * 1000).toISOString()} to ${new Date(now * 1000).toISOString()}`);
      
      // Subscribe to visible range changes for batch loading
      // Add a delay to prevent immediate triggering from initial range set
      setTimeout(() => {
        chart.timeScale().subscribeVisibleTimeRangeChange(() => {
          // Debounce the range change handler
          clearTimeout(rangeChangeTimeout);
          rangeChangeTimeout = setTimeout(handleVisibleRangeChange, 300);
        });
      }, 1000);
    } catch (error) {
      console.error('Error loading chart data:', error);
      console.error('Error stack:', (error as any).stack);
      status = 'error';
    }

    // Handle resize
    const handleResize = () => {
      if (chart && chartContainer) {
        chart.applyOptions({
          width: chartContainer.clientWidth,
          height: chartContainer.clientHeight,
        });
      }
    };
    
    resizeHandler = handleResize;
    window.addEventListener('resize', handleResize);
  });
  
  onDestroy(() => {
    if (rangeChangeTimeout) {
      clearTimeout(rangeChangeTimeout);
    }
    if (resizeHandler) {
      window.removeEventListener('resize', resizeHandler);
    }
    if (dataFeed) {
      dataFeed.disconnect();
    }
    if (chart) {
      chart.remove();
    }
  });
</script>

<div class="chart-container" bind:this={chartContainer}>
  {#if isAutoPeriod && currentPeriod !== period}
    <div class="auto-period-indicator">
      Auto Period: {currentPeriod}
    </div>
  {/if}
  {#if isAutoGranularity && currentGranularity !== granularity}
    <div class="auto-granularity-indicator">
      Auto Granularity: {currentGranularity}
    </div>
  {/if}
  
  <div class="cache-status">
    <span class="status-dot {cacheStatus}"></span>
    Cache: {cacheStatus}
    {#if cacheStatus === 'loading'}
      <button class="cache-btn" on:click={forceLoadHistoricalData} disabled>
        Loading...
      </button>
    {:else}
      <button class="cache-btn" on:click={forceLoadHistoricalData}>
        Load 5Y Data
      </button>
    {/if}
  </div>
</div>

<style>
  .chart-container {
    width: 100%;
    height: 100%;
    min-height: 400px;
    position: relative;
    background-color: #1a1a1a;
  }

  .auto-period-indicator {
    position: absolute;
    top: 10px;
    right: 10px;
    background: rgba(74, 0, 224, 0.6);
    color: #a78bfa;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 12px;
    z-index: 5;
  }
  
  .auto-granularity-indicator {
    position: absolute;
    top: 35px;
    right: 10px;
    background: rgba(74, 0, 224, 0.6);
    color: #a78bfa;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 12px;
    z-index: 5;
  }
  
  .cache-status {
    position: absolute;
    bottom: 10px;
    left: 10px;
    background: rgba(0, 0, 0, 0.8);
    color: #9ca3af;
    padding: 6px 12px;
    border-radius: 4px;
    font-size: 12px;
    z-index: 5;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  
  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #6b7280;
  }
  
  .status-dot.loading {
    background: #f59e0b;
    animation: pulse 1s infinite;
  }
  
  .status-dot.ready {
    background: #10b981;
  }
  
  .cache-btn {
    background: rgba(74, 0, 224, 0.6);
    border: 1px solid rgba(74, 0, 224, 0.8);
    color: #a78bfa;
    padding: 2px 8px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 11px;
    transition: all 0.2s;
  }
  
  .cache-btn:hover:not(:disabled) {
    background: rgba(74, 0, 224, 0.8);
  }
  
  .cache-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
</style>