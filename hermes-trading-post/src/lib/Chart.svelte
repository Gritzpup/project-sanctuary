<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { createChart, ColorType, CandlestickSeries } from 'lightweight-charts';
  import type { IChartApi, ISeriesApi, Time } from 'lightweight-charts';
  import { ChartDataFeed } from '../services/chartDataFeed';
  import type { CandleData } from '../types/coinbase';

  let chartContainer: HTMLDivElement;
  let chart: IChartApi | null = null;
  let candleSeries: ISeriesApi<'Candlestick'> | any = null;
  let dataFeed: ChartDataFeed | null = null;

  export let status: 'connected' | 'disconnected' | 'error' | 'loading' = 'loading';
  export let granularity: string = '1m';
  export let period: string = '1H';
  export let onGranularityChange: ((g: string) => void) | undefined = undefined;
  
  // Debug prop changes
  $: console.log('Chart props changed:', { period, granularity, isInitialized });
  
  // Cache and loading state
  export let cacheStatus = 'initializing';
  let displayStatus = 'initializing'; // Combined status for display
  let statusResetTimer: number;
  let isLoadingData = false;
  
  // Update display status whenever cache status changes
  $: if (!statusResetTimer) displayStatus = cacheStatus;
  
  // Granularity state
  let effectiveGranularity = granularity;
  let isAutoGranularity = true;
  let autoGranularityTimer: any = null;
  
  // Clock and countdown state
  let currentTime = '';
  let countdown = '';
  let clockInterval: any = null;
  
  // Redis subscription cleanup
  // let redisUnsubscribe: (() => void) | null = null;
  
  // Visible candle count - exported for debug
  export let visibleCandleCount = 0;
  export let totalCandleCount = 0;
  
  // Error handling
  let errorMessage = '';
  
  // Date range display - exported for debug
  export let dateRangeInfo = {
    expectedFrom: '',
    expectedTo: '',
    actualFrom: '',
    actualTo: '',
    expectedCandles: 0,
    actualCandles: 0,
    requestedFrom: 0,
    requestedTo: 0,
    dataDebug: ''
  };
  
  // Cleanup handlers
  let resizeHandler: (() => void) | null = null;
  
  // Track previous period to detect changes
  let previousPeriod = period;
  let isInitialized = false;
  
  // Map periods to days
  const periodToDays: Record<string, number> = {
    '1H': 1/24,    // 1 hour = 1/24 day
    '4H': 4/24,    // 4 hours = 4/24 day
    '1D': 1,       // 1 day
    '1W': 7,       // 1 week = 7 days
    '5D': 5,       // 5 days
    '1M': 30,      // 1 month ~= 30 days
    '3M': 90,      // 3 months ~= 90 days
    '6M': 180,     // 6 months ~= 180 days
    '1Y': 365,     // 1 year = 365 days
    '5Y': 1825     // 5 years = 1825 days
  };
  
  // Map granularities to seconds
  const granularityToSeconds: Record<string, number> = {
    '1m': 60,
    '5m': 300,
    '15m': 900,
    '1h': 3600,
    '6h': 21600,
    '1D': 86400
  };
  
  // Track previous values
  let previousGranularity = granularity;
  let updateTimer: any = null;
  let reloadDebounceTimer: any = null;
  
  // Watch for external granularity or period changes
  $: if (isInitialized && chart && dataFeed && (granularity !== previousGranularity || period !== previousPeriod)) {
    console.log(`Props changed - Period: ${previousPeriod} → ${period}, Granularity: ${previousGranularity} → ${granularity}`);
    
    // Clear any pending update
    clearTimeout(updateTimer);
    
    // Update tracking variables
    previousPeriod = period;
    previousGranularity = granularity;
    
    // Debounce the update slightly to handle rapid changes
    updateTimer = setTimeout(() => {
      // Handle granularity change
      if (granularity !== effectiveGranularity) {
        effectiveGranularity = granularity;
        handleManualGranularityChange(granularity);
      } else {
        // Just period changed, reload data
        debouncedReloadData();
      }
    }, 50); // Small delay to let both props settle
  }
  
  function handleManualGranularityChange(newGranularity: string) {
    if (!dataFeed || !chart || !candleSeries) return;
    
    console.log(`Manual granularity change to: ${newGranularity}`);
    
    // Update granularity using ChartDataFeed API
    effectiveGranularity = newGranularity;
    dataFeed.setManualGranularity(newGranularity);
    
    // Note: We don't need to re-subscribe here because the main subscription 
    // in onMount already handles all real-time updates for any granularity
    
    // Update countdown display
    updateClock();
    
    // Update visible candle count
    const visibleRange = chart.timeScale().getVisibleRange();
    if (visibleRange) {
      updateVisibleCandleCount(Number(visibleRange.from), Number(visibleRange.to));
    }
    
    // Reload data with new granularity
    debouncedReloadData();
  }

  onMount(async () => {
    try {
      // Ensure container is ready
      if (!chartContainer) {
        console.error('Chart container not ready');
        return;
      }
      
      // Create chart
      chart = createChart(chartContainer, {
        width: chartContainer.clientWidth,
        height: chartContainer.clientHeight,
        layout: {
          background: { type: ColorType.Solid, color: '#0f1419' },
          textColor: '#d1d4dc',
        },
        grid: {
          vertLines: { color: '#1f2937', style: 1 },
          horzLines: { color: '#1f2937', style: 1 },
        },
        crosshair: {
          mode: 0,
          vertLine: {
            width: 1,
            color: 'rgba(224, 227, 235, 0.1)',
            style: 0,
          },
          horzLine: {
            width: 1,
            color: 'rgba(224, 227, 235, 0.1)',
            style: 0,
          },
        },
        rightPriceScale: {
          borderColor: '#2a2a2a',
          scaleMargins: {
            top: 0.1,
            bottom: 0.2,
          },
        },
        timeScale: {
          rightOffset: 5,
          barSpacing: 3,
          minBarSpacing: 1,
          fixLeftEdge: true,  // Lock left edge (no zoom)
          fixRightEdge: true, // Lock right edge (no zoom)
          lockVisibleTimeRangeOnResize: true,
          timeVisible: true,
          secondsVisible: false,
          borderColor: '#2a2a2a',
        },
        handleScroll: {
          mouseWheel: false,  // DISABLED - NO ZOOM
          pressedMouseMove: false,  // DISABLED - NO DRAG
          horzTouchDrag: false,  // DISABLED - NO TOUCH
          vertTouchDrag: false,  // DISABLED
        },
        handleScale: {
          mouseWheel: false,  // DISABLED - NO ZOOM
          pinch: false,  // DISABLED - NO PINCH
          axisPressedMouseMove: false,  // DISABLED - NO AXIS SCALE
        },
        localization: {
          priceFormatter: (price: number) => {
            return price.toFixed(2);
          },
        }
      });

      // Ensure chart was created successfully
      if (!chart) {
        console.error('Failed to create chart');
        return;
      }

      // Create candle series using the new v5 API
      candleSeries = chart.addSeries(CandlestickSeries, {
        upColor: '#26a69a',
        downColor: '#ef5350',
        borderUpColor: '#26a69a',
        borderDownColor: '#ef5350',
        wickUpColor: '#26a69a',
        wickDownColor: '#ef5350',
        priceScaleId: 'right',
        priceFormat: {
          type: 'price',
          precision: 2,
          minMove: 0.01
        }
      });

      // Ensure candleSeries was created successfully
      if (!candleSeries) {
        console.error('Failed to create candle series');
        return;
      }
      
      console.log('Chart: Successfully created chart and candle series');

      // Initialize data feed with real Coinbase data
      dataFeed = new ChartDataFeed();
      
      // IMPORTANT: Subscribe IMMEDIATELY before any data arrives
      dataFeed.subscribe('chart', (candle, isNew) => {
        console.log('Chart: Received candle update', { 
          time: new Date(candle.time * 1000).toISOString(),
          price: candle.close,
          isNew, 
          candleSeries: !!candleSeries,
          isLoadingData,
          chart: !!chart,
          effectiveGranularity
        });
        
        if (candleSeries && !isLoadingData) {
          console.log('Chart: Processing candle update for', effectiveGranularity);
          
          // Set display status based on update type
          displayStatus = isNew ? 'new-candle' : 'price-update';
          
          // Clear any existing timer
          if (statusResetTimer) {
            clearTimeout(statusResetTimer);
          }
          
          // Always update the candle
          const chartCandle = {
            time: candle.time as Time,
            open: candle.open,
            high: candle.high,
            low: candle.low,
            close: candle.close
          };
          
          if (isNew) {
            console.log(`Chart: Received new ${effectiveGranularity} candle at ${new Date(candle.time * 1000).toISOString()}`);
          } else {
            console.log(`Chart: Updating existing ${effectiveGranularity} candle at ${new Date(candle.time * 1000).toISOString()}`);
          }
          
          console.log('Chart: Candle data:', chartCandle);
          
          try {
            candleSeries.update(chartCandle);
            console.log('Chart: Successfully updated candle');
            
            // Reset to base status after a delay
            statusResetTimer = setTimeout(() => {
              displayStatus = cacheStatus;
              statusResetTimer = null;
            }, isNew ? 3000 : 1500); // Stay visible longer - 1.5s for price, 3s for new candle
            
            // No need to force redraw - lightweight-charts handles updates automatically
          } catch (error) {
            console.error('Chart: Error updating candle:', error);
            // If update fails, try adding it as new data
            try {
              const currentData = candleSeries.data();
              const existingIndex = currentData.findIndex(c => c.time === chartCandle.time);
              if (existingIndex === -1) {
                console.log('Chart: Candle not found, adding as new');
                candleSeries.setData([...currentData, chartCandle].sort((a, b) => (a.time as number) - (b.time as number)));
              }
            } catch (e) {
              console.error('Chart: Failed to add candle:', e);
            }
          }
        }
      });

      // Set up granularity change callback AFTER subscribing
      if (onGranularityChange) {
        dataFeed.onGranularityChange(onGranularityChange);
      }

      // Load initial data
      await loadInitialData();
      
      // Mark as initialized after initial load
      isInitialized = true;
      
      // Start clock
      updateClock();
      clockInterval = setInterval(updateClock, 1000);
      
      // Subscribe to Redis ticker updates for real-time price display
      // redisUnsubscribe = await redisService.subscribeTicker('BTC-USD', (ticker) => {
      //   console.log(`Chart: Received ticker from Redis - price: ${ticker.price}`);
      //   // You can use this for real-time price display if needed
      // });
      
      // Update total candle count
      updateTotalCandleCount();
      setInterval(updateTotalCandleCount, 30000); // Update every 30s
      
      // Subscribe to visible range changes to keep candle count accurate
      chart.timeScale().subscribeVisibleTimeRangeChange(() => {
        const visibleRange = chart.timeScale().getVisibleRange();
        if (visibleRange) {
          updateVisibleCandleCount(Number(visibleRange.from), Number(visibleRange.to));
        }
      });
      
      // Set cache status
      cacheStatus = 'ready';
      
    } catch (error: any) {
      console.error('Error initializing chart:', error);
      status = 'error';
      errorMessage = `Failed to initialize chart: ${error.message || 'Unknown error'}`;
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

  // Load initial data
  async function loadInitialData() {
    console.log('=== loadInitialData called ===');
    console.log('chart:', !!chart, 'dataFeed:', !!dataFeed, 'candleSeries:', !!candleSeries);
    
    if (!chart || !dataFeed || !candleSeries) {
      console.error('Missing required components:', { chart: !!chart, dataFeed: !!dataFeed, candleSeries: !!candleSeries });
      return;
    }
    
    try {
      status = 'loading';
      cacheStatus = 'loading';
      
      // Calculate initial time range based on period - USE FRESH DATE
      const now = Math.floor(Date.now() / 1000);
      const currentDateTime = new Date();
      console.log(`🕐 CURRENT TIME: ${currentDateTime.toLocaleString()} (Unix: ${now})`);
      const days = periodToDays[period] || 1;
      const periodSeconds = days * 86400;
      
      // Calculate exact number of candles needed
      const granularitySeconds = granularityToSeconds[effectiveGranularity] || 60;
      
      // Align times to granularity boundaries for exact candle counts
      let alignedNow = Math.floor(now / granularitySeconds) * granularitySeconds;
      
      // For daily candles, don't align to past midnight
      if (effectiveGranularity === '1D') {
        // Use current time for daily candles to include today's data
        // Aligning to midnight would exclude today's candle
        alignedNow = now;
      }
      
      const visibleStartTime = alignedNow - periodSeconds;
      
      // Calculate exact number of candles for this period and granularity
      const expectedCandles = Math.ceil(periodSeconds / granularitySeconds);
      
      // For 1H with 1m granularity, enforce exactly 60 candles
      let adjustedStartTime = visibleStartTime;
      let adjustedExpectedCandles = expectedCandles;
      
      if (period === '1H' && effectiveGranularity === '1m') {
        adjustedExpectedCandles = 60;
        adjustedStartTime = alignedNow - (60 * 60); // Exactly 60 minutes back
        console.log(`Enforcing 60 candles for 1H/1m view: ${new Date(adjustedStartTime * 1000).toISOString()} to ${new Date(alignedNow * 1000).toISOString()}`);
      }
      
      // Update date range info
      dateRangeInfo = {
        expectedFrom: new Date(adjustedStartTime * 1000).toLocaleString(),
        expectedTo: new Date(alignedNow * 1000).toLocaleString(),
        actualFrom: '',
        actualTo: '',
        expectedCandles: adjustedExpectedCandles,
        actualCandles: 0,
        requestedFrom: adjustedStartTime,
        requestedTo: alignedNow
      };
      
      console.log(`Initial load for ${period} with ${effectiveGranularity}:`, {
        periodDays: days,
        periodSeconds,
        granularitySeconds,
        expectedCandles: adjustedExpectedCandles,
        visibleRange: `${new Date(adjustedStartTime * 1000).toISOString()} to ${new Date(now * 1000).toISOString()}`,
        visibleStartTime: adjustedStartTime,
        alignedNow,
        rangeInSeconds: alignedNow - adjustedStartTime
      });
      
      // Load exact data for the period - no extra padding
      const dataStartTime = adjustedStartTime; // Use adjusted start time
      
      // Ensure we use the selected granularity
      dataFeed.setManualGranularity(effectiveGranularity);
      
      console.log(`Fetching data from ${new Date(dataStartTime * 1000).toISOString()} to ${new Date(alignedNow * 1000).toISOString()}`);
      
      // Load data using the ChartDataFeed API
      const data = await dataFeed.getDataForVisibleRange(dataStartTime, alignedNow);
      
      console.log('Data received:', data.length > 0 ? `${data.length} candles` : 'NO DATA');
      
      // CRITICAL: Filter data to only include candles within our time range
      let filteredData = data.filter(candle => 
        candle.time >= adjustedStartTime && candle.time <= alignedNow
      );
      
      // For 1H with 1m granularity, ensure we only keep the last 60 candles
      if (period === '1H' && effectiveGranularity === '1m' && filteredData.length > 60) {
        console.log(`Trimming from ${filteredData.length} to last 60 candles for 1H/1m view`);
        filteredData = filteredData.slice(-60);
      }
      
      console.log(`Filtered from ${data.length} to ${filteredData.length} candles within our time range`);
      console.log(`Loaded ${filteredData.length} candles (expected ${adjustedExpectedCandles}) for ${period} with ${effectiveGranularity}`);
      
      // Update actual candle count
      dateRangeInfo.actualCandles = filteredData.length;
      
      // LOG THE ACTUAL DATA
      if (data.length > 0) {
        console.log('FIRST 5 CANDLES:', data.slice(0, 5).map(c => ({
          time: c.time,
          date: new Date(c.time * 1000).toLocaleString(),
          close: c.close
        })));
        console.log('LAST 5 CANDLES:', data.slice(-5).map(c => ({
          time: c.time,
          date: new Date(c.time * 1000).toLocaleString(),
          close: c.close
        })));
      }
      
      // Verify candle count
      if (Math.abs(filteredData.length - expectedCandles) > 1) {
        console.warn(`⚠️ Candle count mismatch! Expected ${expectedCandles}, got ${filteredData.length}`);
      } else {
        console.log(`✅ Correct candle count for ${period} with ${effectiveGranularity}`);
      }
      
      if (filteredData.length === 0) {
        console.error('No data received from API!');
        errorMessage = 'No data available. Please check your connection and try again.';
        status = 'error';
        cacheStatus = 'error';
        return;
      }
      
      if (filteredData.length > 0) {
        // Update actual date range from filtered data
        const firstCandle = filteredData[0];
        const lastCandle = filteredData[filteredData.length - 1];
        dateRangeInfo.actualFrom = new Date(firstCandle.time * 1000).toLocaleString();
        dateRangeInfo.actualTo = new Date(lastCandle.time * 1000).toLocaleString();
        
        console.log('Converting data to chart format...');
        const chartData = filteredData.map(candle => ({
          ...candle,
          time: candle.time as Time
        }));
        
        console.log('Setting chart data...');
        candleSeries.setData(chartData);
        
        // IMPORTANT: Force the visible range to show ONLY the requested period
        console.log('Setting visible range to REQUESTED time period...');
        console.log(`FORCING visible range: ${visibleStartTime} to ${alignedNow + 30} (with 30s buffer for last candle)`);
        
        // Use setTimeout to ensure the range is set after the data
        setTimeout(() => {
          // Use adjusted start time if we have one (for 1H/1m)
          const rangeStart = period === '1H' && effectiveGranularity === '1m' && filteredData.length > 0 
            ? filteredData[0].time 
            : adjustedStartTime;
          
          // Add 30 seconds buffer to ensure the last candle is visible
          chart.timeScale().setVisibleRange({
            from: rangeStart as Time,
            to: (alignedNow + 30) as Time
          });
          
          // Check what happened
          const actualRange = chart.timeScale().getVisibleRange();
          if (actualRange) {
            console.log(`Actual visible range after setting: ${actualRange.from} to ${actualRange.to} (${(actualRange.to - actualRange.from)/60} minutes)`);
            
            // If the range is wrong, try again!
            if (Math.abs((actualRange.to - actualRange.from) - (alignedNow - rangeStart)) > 60) {
              console.log('Range is wrong, forcing it again...');
              chart.timeScale().setVisibleRange({
                from: rangeStart as Time,
                to: (alignedNow + 30) as Time
              });
            }
          }
        }, 50);
        
        
        // Update visible candle count for the actual visible range
        updateVisibleCandleCount(adjustedStartTime, alignedNow);
        
        // Log what the chart thinks the visible range is and update count
        setTimeout(() => {
          const actualRange = chart?.timeScale().getVisibleRange();
          if (actualRange) {
            const actualRangeSeconds = Number(actualRange.to) - Number(actualRange.from);
            const actualCandles = Math.ceil(actualRangeSeconds / granularitySeconds);
            
            console.log('Chart visible range verification:', {
              actualCandles,
              expectedCandles,
              matches: Math.abs(actualCandles - expectedCandles) <= 1 ? '✅' : '❌',
              period,
              granularity: effectiveGranularity
            });
            
            // Always update the visible candle count with the actual range
            updateVisibleCandleCount(Number(actualRange.from), Number(actualRange.to));
          }
        }, 200); // Slightly longer delay to ensure chart has settled
      }
      
      status = 'connected';
      cacheStatus = 'ready';
      errorMessage = ''; // Clear any previous errors
    } catch (error: any) {
      console.error('Error loading initial data:', error);
      console.error('Error stack:', error.stack);
      status = 'error';
      cacheStatus = 'error';
      if (error?.response?.status === 429) {
        errorMessage = 'Rate limit exceeded. Please wait a moment and try again.';
      } else {
        errorMessage = `Failed to load chart data: ${error.message || 'Unknown error'}`;
      }
      // Log more details
      console.error('Full error details:', {
        name: error.name,
        message: error.message,
        response: error.response,
        config: error.config
      });
    }
  }


  // Reload data with current period and granularity
  // Debounced reload data function to prevent rapid successive calls
  function debouncedReloadData() {
    clearTimeout(reloadDebounceTimer);
    reloadDebounceTimer = setTimeout(() => {
      reloadData();
    }, 100); // 100ms debounce
  }
  
  export async function reloadData() {
    if (!chart || !dataFeed || !candleSeries || isLoadingData) return;
    
    isLoadingData = true;
    
    try {
      // Clear cache on reload to ensure fresh data
      console.log('Clearing cache before reload...');
      await clearCache(true); // Skip page reload since we're just refreshing data
      
      // Small delay to ensure cache is cleared
      await new Promise(resolve => setTimeout(resolve, 100));
      // Calculate time range based on period - USE FRESH DATE
      const now = Math.floor(Date.now() / 1000);
      const currentDateTime = new Date();
      console.log(`🕐 RELOAD TIME: ${currentDateTime.toLocaleString()} (Unix: ${now})`);
      const days = periodToDays[period] || 1;
      const periodSeconds = days * 86400;
      
      // Get granularity for alignment
      const granularitySeconds = granularityToSeconds[effectiveGranularity] || 60;
      
      // Align times to granularity boundaries for exact candle counts
      let alignedNow = Math.floor(now / granularitySeconds) * granularitySeconds;
      
      // For daily candles, don't align to past midnight
      if (effectiveGranularity === '1D') {
        // Use current time for daily candles to include today's data
        // Aligning to midnight would exclude today's candle
        alignedNow = now;
      }
      
      let startTime = alignedNow - periodSeconds;
      
      // For 1H with 1m granularity, enforce exactly 60 candles
      let expectedCandles = Math.ceil(periodSeconds / granularitySeconds);
      if (period === '1H' && effectiveGranularity === '1m') {
        expectedCandles = 60;
        startTime = alignedNow - (60 * 60); // Exactly 60 minutes back
        console.log(`Enforcing 60 candles for 1H/1m view on reload: ${new Date(startTime * 1000).toISOString()} to ${new Date(alignedNow * 1000).toISOString()}`);
      }
      
      // Force manual mode to ensure our selected granularity is used
      dataFeed.setManualGranularity(effectiveGranularity);
      
      // Get data for the period using ChartDataFeed API
      console.log(`Loading ${period} data with ${effectiveGranularity} candles...`);
      const data = await dataFeed.getDataForVisibleRange(startTime, alignedNow);
      
      // CRITICAL: Filter data to only include candles within our time range
      let filteredData = data.filter(candle => 
        candle.time >= startTime && candle.time <= alignedNow
      );
      
      // For 1H with 1m granularity, ensure we only keep the last 60 candles
      if (period === '1H' && effectiveGranularity === '1m' && filteredData.length > 60) {
        console.log(`Trimming from ${filteredData.length} to last 60 candles for 1H/1m view on reload`);
        filteredData = filteredData.slice(-60);
      }
      
      // Update date range info for reload
      dateRangeInfo.expectedFrom = new Date(startTime * 1000).toLocaleString();
      dateRangeInfo.expectedTo = new Date(alignedNow * 1000).toLocaleString();
      dateRangeInfo.expectedCandles = expectedCandles;
      dateRangeInfo.actualCandles = filteredData.length;
      dateRangeInfo.requestedFrom = startTime;
      dateRangeInfo.requestedTo = alignedNow;
      
      if (filteredData.length > 0) {
        const firstCandle = filteredData[0];
        const lastCandle = filteredData[filteredData.length - 1];
        dateRangeInfo.actualFrom = new Date(firstCandle.time * 1000).toLocaleString();
        dateRangeInfo.actualTo = new Date(lastCandle.time * 1000).toLocaleString();
        dateRangeInfo.dataDebug = `First: ${firstCandle.time}, Last: ${lastCandle.time}`;
      }
      
      console.log(`Reloading: ${filteredData.length} candles (expected ${expectedCandles}) for ${period} with ${effectiveGranularity}`);
      
      // Verify candle count and update status
      if (filteredData.length === 0) {
        console.warn(`⚠️ No data available yet for ${period}. Data may still be loading...`);
        status = 'loading';
      } else if (filteredData.length < expectedCandles * 0.5) {
        console.warn(`⚠️ Only ${filteredData.length} of ${expectedCandles} candles loaded. Historical data is still downloading...`);
        // Still show what we have but indicate loading
        status = 'loading';
      } else if (Math.abs(filteredData.length - expectedCandles) > 1) {
        console.warn(`⚠️ Candle count mismatch on reload! Expected ${expectedCandles}, got ${filteredData.length}`);
      } else {
        status = 'connected';
        errorMessage = ''; // Clear any previous errors
      }
      
      if (filteredData.length > 0) {
        const chartData = filteredData.map(candle => ({
          ...candle,
          time: candle.time as Time
        }));
        
        // Update chart data
        candleSeries.setData(chartData);
        
        // Force the specific range we want
        setTimeout(() => {
          chart.timeScale().setVisibleRange({
            from: startTime as Time,
            to: alignedNow as Time
          });
        }, 50);
        
        // Update visible candle count
        updateVisibleCandleCount(startTime, alignedNow);
        
        // Verify the range after a short delay
        setTimeout(() => {
          const actualRange = chart?.timeScale().getVisibleRange();
          if (actualRange) {
            // Always update with the actual visible range
            updateVisibleCandleCount(Number(actualRange.from), Number(actualRange.to));
          }
        }, 100);
      }
    } catch (error: any) {
      console.error('Error reloading data:', error);
      if (error?.response?.status === 429) {
        errorMessage = 'Rate limit exceeded. Please wait a moment and try again.';
      } else {
        errorMessage = `Failed to reload data: ${error.message || 'Unknown error'}`;
      }
    } finally {
      isLoadingData = false;
    }
  }


  // Update visible candle count
  function updateVisibleCandleCount(fromTime: number, toTime: number) {
    if (!dataFeed) {
      visibleCandleCount = 0;
      return;
    }
    
    // Calculate actual candle count based on granularity
    const range = toTime - fromTime;
    const granularitySeconds = granularityToSeconds[effectiveGranularity] || 60;
    visibleCandleCount = Math.ceil(range / granularitySeconds);
    
    // Debug logging
    // Show expected counts for common scenarios
    const expectedCounts: Record<string, Record<string, number>> = {
      '1H': { '1m': 60, '5m': 12, '15m': 4, '1h': 1 },
      '4H': { '1m': 240, '5m': 48, '15m': 16, '1h': 4 },
      '5D': { '1m': 7200, '5m': 1440, '15m': 480, '1h': 120, '6h': 20, '1d': 5 },
      '1M': { '1h': 720, '6h': 120, '1d': 30 },
      '3M': { '1h': 2160, '6h': 360, '1d': 90 },
      '6M': { '1d': 180 },
      '1Y': { '1d': 365 },
      '5Y': { '1d': 1825 }
    };
    
    const expected = expectedCounts[period]?.[effectiveGranularity];
    
    console.log('Visible candle count:', {
      period,
      granularity: effectiveGranularity,
      visibleCount: visibleCandleCount,
      expected: expected || 'calculated',
      isCorrect: expected ? Math.abs(visibleCandleCount - expected) <= 1 : 'N/A'
    });
  }

  // Update total candle count
  async function updateTotalCandleCount() {
    if (!dataFeed) return;
    
    // Use expected counts instead of cache total
    const expectedCounts: Record<string, Record<string, number>> = {
      '1H': { '1m': 60, '5m': 12, '15m': 4, '1h': 1 },
      '4H': { '1m': 240, '5m': 48, '15m': 16, '1h': 4 },
      '5D': { '1m': 7200, '5m': 1440, '15m': 480, '1h': 120, '6h': 20, '1d': 5 },
      '1M': { '1h': 720, '6h': 120, '1d': 30 },
      '3M': { '1h': 2160, '6h': 360, '1d': 90 },
      '6M': { '1d': 180 },
      '1Y': { '1d': 365 },
      '5Y': { '1d': 1825 }
    };
    
    const expected = expectedCounts[period]?.[effectiveGranularity];
    totalCandleCount = expected || visibleCandleCount;
  }

  // Update clock and countdown
  function updateClock() {
    const now = new Date();
    const nowSeconds = Math.floor(now.getTime() / 1000);
    
    // Format current time
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const seconds = now.getSeconds().toString().padStart(2, '0');
    currentTime = `${hours}:${minutes}:${seconds}`;
    
    // Calculate countdown to next candle using effective granularity
    const granularitySeconds = granularityToSeconds[effectiveGranularity] || 60;
    const currentMinuteBoundary = Math.floor(nowSeconds / 60) * 60;
    const nextMinuteBoundary = currentMinuteBoundary + 60;
    
    // For 1m granularity, countdown to next minute boundary
    let secondsUntilNextCandle;
    if (effectiveGranularity === '1m') {
      secondsUntilNextCandle = nextMinuteBoundary - nowSeconds;
    } else {
      // For other granularities, calculate based on period boundaries
      const secondsIntoCurrentCandle = nowSeconds % granularitySeconds;
      secondsUntilNextCandle = granularitySeconds - secondsIntoCurrentCandle;
    }
    
    // Format countdown
    if (secondsUntilNextCandle >= 3600) {
      const h = Math.floor(secondsUntilNextCandle / 3600);
      const m = Math.floor((secondsUntilNextCandle % 3600) / 60);
      const s = secondsUntilNextCandle % 60;
      countdown = `${h}h ${m.toString().padStart(2, '0')}m ${s.toString().padStart(2, '0')}s`;
    } else if (secondsUntilNextCandle >= 60) {
      const m = Math.floor(secondsUntilNextCandle / 60);
      const s = secondsUntilNextCandle % 60;
      countdown = `${m}m ${s.toString().padStart(2, '0')}s`;
    } else {
      countdown = `${secondsUntilNextCandle}s`;
    }
  }

  async function clearCache(skipPageReload = false) {
    console.log('Clearing cache...');
    try {
      // Clear IndexedDB
      const databases = await indexedDB.databases();
      for (const db of databases) {
        if (db.name?.includes('coinbase') || db.name?.includes('chart')) {
          await indexedDB.deleteDatabase(db.name);
          console.log(`Deleted database: ${db.name}`);
        }
      }
      
      // Clear localStorage
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.includes('coinbase') || key.includes('chart'))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
      
      // Only reload the page if not skipped
      if (!skipPageReload) {
        window.location.reload();
      }
    } catch (error) {
      console.error('Error clearing cache:', error);
      errorMessage = 'Failed to clear cache: ' + error.message;
    }
  }

  onDestroy(() => {
    if (clockInterval) {
      clearInterval(clockInterval);
    }
    if (updateTimer) {
      clearTimeout(updateTimer);
    }
    if (reloadDebounceTimer) {
      clearTimeout(reloadDebounceTimer);
    }
    if (statusResetTimer) {
      clearTimeout(statusResetTimer);
    }
    if (resizeHandler) {
      window.removeEventListener('resize', resizeHandler);
    }
    // if (redisUnsubscribe) {
    //   redisUnsubscribe();
    // }
    if (dataFeed) {
      dataFeed.unsubscribe('chart');
      dataFeed.disconnect();
    }
    if (chart) {
      chart.remove();
    }
  });
</script>

<div class="chart-container" bind:this={chartContainer}>
  {#if errorMessage}
    <div class="error-message">
      <span class="error-icon">⚠️</span>
      <span class="error-text">{errorMessage}</span>
      <button class="error-retry" on:click={() => { errorMessage = ''; reloadData(); }}>
        Retry
      </button>
    </div>
  {/if}
  
  <div class="candle-count">
    {visibleCandleCount} / {totalCandleCount} candles
  </div>
  
  <div class="status-container">
    <span class="status-dot {displayStatus}"></span>
    <span class="status-label">
      {#if displayStatus === 'initializing'}
        Initializing...
      {:else if displayStatus === 'loading'}
        Loading data...
      {:else if displayStatus === 'ready'}
        Ready
      {:else if displayStatus === 'updating'}
        Updating...
      {:else if displayStatus === 'error'}
        Error!
      {:else if displayStatus === 'price-update'}
        Price Update
      {:else if displayStatus === 'new-candle'}
        New Candle! 🕯️
      {/if}
    </span>
  </div>
  
  <div class="clock-container">
    <div class="clock-time">{currentTime}</div>
    <div class="clock-countdown">
      <span class="countdown-label">Next {effectiveGranularity}:</span>
      <span class="countdown-value">{countdown}</span>
    </div>
  </div>
</div>

<style>
  .chart-container {
    width: 100%;
    height: 100%;
    position: relative;
    background-color: #1a1a1a;
    z-index: 1;
  }
  
  /* Ensure the actual chart canvas is properly layered */
  .chart-container :global(canvas) {
    z-index: 2;
    position: relative;
  }
  
  .candle-count {
    position: absolute;
    top: 10px;
    left: 10px;
    background: rgba(0, 0, 0, 0.8);
    color: #26a69a;
    padding: 6px 12px;
    border-radius: 4px;
    font-size: 14px;
    font-weight: 600;
    z-index: 5;
    font-family: 'Monaco', 'Consolas', monospace;
  }
  
  .status-container {
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
  
  .status-label {
    font-weight: 500;
  }
  
  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #6b7280;
  }
  
  .status-dot.initializing {
    background: #8b5cf6;
    animation: pulse 1s infinite;
  }
  
  .status-dot.loading {
    background: #f59e0b;
    animation: pulse 1s infinite;
  }
  
  .status-dot.ready {
    background: #10b981;
  }
  
  .status-dot.updating {
    background: #3b82f6;
    animation: pulse-scale 0.5s infinite;
    box-shadow: 0 0 10px #3b82f6;
  }
  
  .status-dot.error {
    background: #ef4444;
    animation: pulse 0.5s infinite;
    box-shadow: 0 0 10px #ef4444;
  }
  
  .status-dot.price-update {
    background: #60a5fa;
    animation: pulse 0.8s infinite;
    box-shadow: 0 0 8px #60a5fa;
  }
  
  .status-dot.new-candle {
    background: #fbbf24;
    animation: pulse-glow 1s ease-out;
    box-shadow: 0 0 20px #fbbf24;
  }
  
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
  
  @keyframes pulse-scale {
    0% { 
      transform: scale(1);
      opacity: 1;
      box-shadow: 0 0 5px #3b82f6;
    }
    50% { 
      transform: scale(1.5);
      opacity: 0.8;
      box-shadow: 0 0 15px #3b82f6;
    }
    100% { 
      transform: scale(1);
      opacity: 1;
      box-shadow: 0 0 5px #3b82f6;
    }
  }
  
  
  
  @keyframes pulse-glow {
    0% { 
      transform: scale(1);
      box-shadow: 0 0 5px #fbbf24;
    }
    50% { 
      transform: scale(2);
      box-shadow: 0 0 30px #fbbf24;
    }
    100% { 
      transform: scale(1);
      box-shadow: 0 0 10px #fbbf24;
    }
  }
  
  .clock-container {
    position: absolute;
    bottom: 10px;
    right: 10px;
    background: rgba(0, 0, 0, 0.8);
    color: #d1d4dc;
    padding: 8px 12px;
    border-radius: 4px;
    font-size: 12px;
    z-index: 5;
    text-align: right;
  }
  
  .clock-time {
    font-size: 16px;
    font-weight: 600;
    margin-bottom: 4px;
    font-family: 'Monaco', 'Consolas', monospace;
  }
  
  .clock-countdown {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
  }
  
  .countdown-label {
    color: #9ca3af;
  }
  
  .countdown-value {
    color: #26a69a;
    font-weight: 600;
    font-family: 'Monaco', 'Consolas', monospace;
  }
  
  .error-message {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background-color: #2a2020;
    border: 1px solid #ef5350;
    border-radius: 8px;
    padding: 20px 30px;
    display: flex;
    align-items: center;
    gap: 12px;
    z-index: 1000;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  }
  
  .error-icon {
    font-size: 24px;
  }
  
  .error-text {
    color: #e0e0e0;
    font-size: 14px;
    max-width: 400px;
  }
  
  .error-retry {
    background-color: #26a69a;
    color: white;
    border: none;
    border-radius: 4px;
    padding: 8px 16px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: background-color 0.2s;
    margin-left: 12px;
  }
  
  .error-retry:hover {
    background-color: #2db67f;
  }
</style>