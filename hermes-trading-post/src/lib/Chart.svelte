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
  // Start with auto-granularity disabled since Dashboard provides manual selection
  let isAutoGranularity = false;
  let loadingNewGranularity = false;
  let cacheStatus = 'initializing';
  let loadProgress = 0;
  let isChangingPeriod = false; // Flag to prevent range changes during period switches
  let isAutoPeriod = true; // Flag for automatic period switching
  let currentPeriod: string = period;
  let cacheUpdateTimeout: any = null; // For flashing cache status
  
  // Clock and countdown state
  let currentTime = '';
  let countdown = '';
  let clockInterval: any = null;
  let dataCheckInterval: any = null; // For periodic data freshness checks
  
  // Cleanup handlers
  let resizeHandler: (() => void) | null = null;
  let rangeChangeTimeout: any = null;
  
  // Track previous visible range for zoom detection
  let previousVisibleRange: { from: number; to: number } | null = null;
  let chartCanvasElement: HTMLCanvasElement | null = null;
  let isZooming = false;
  
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
      
      // Force fetch the latest candle to ensure we have real-time data
      console.log('Fetching latest candle to ensure up-to-date data...');
      await dataFeed.fetchLatestCandle();
      
      // Get all data including the latest candle
      const allData = dataFeed.getAllData();
      console.log('Total data after fetching latest:', allData.length, 'candles');
      
      // Convert time to proper format for lightweight-charts
      const chartData = allData.map(candle => ({
        ...candle,
        time: candle.time as Time
      }));
      
      candleSeries.setData(chartData);
      
      // Debug: Log the actual data time range
      if (chartData.length > 0) {
        const firstCandle = chartData[0];
        const lastCandle = chartData[chartData.length - 1];
        console.log(`Loaded data range: ${new Date(firstCandle.time * 1000).toISOString()} to ${new Date(lastCandle.time * 1000).toISOString()}`);
        console.log(`Last candle time: ${new Date(lastCandle.time * 1000).toISOString()}, Current time: ${new Date().toISOString()}`);
      }
      
      // Set visible range to show only the selected period
      if (!loadingNewGranularity) {
        const now = Math.floor(Date.now() / 1000);
        const periodSeconds = days * 24 * 60 * 60;
        const startTime = now - periodSeconds;
        
        // Set the visible range to show exactly the selected period with padding
        const padding = granularityToSeconds[granularityToUse] || 60; // Add one candle width as padding
        
        // If we have data, use the actual data range to set visible range
        if (chartData.length > 0) {
          const lastCandleTime = chartData[chartData.length - 1].time;
          const visibleEndTime = Math.max(lastCandleTime + padding, now + padding);
          chart.timeScale().setVisibleRange({
            from: startTime as Time,
            to: visibleEndTime as Time
          });
          console.log(`Set visible range: ${new Date(startTime * 1000).toISOString()} to ${new Date(visibleEndTime * 1000).toISOString()}`);
        } else {
          chart.timeScale().setVisibleRange({
            from: startTime as Time,
            to: (now + padding) as Time
          });
          console.log(`Set visible range: ${new Date(startTime * 1000).toISOString()} to ${new Date(now * 1000).toISOString()}`);
        }
      }
      
      status = 'connected';
      loadingNewGranularity = false;
    } catch (error) {
      console.error('Error loading chart data:', error);
      status = 'error';
      loadingNewGranularity = false;
    }
  }
  
  // Custom zoom handler to keep right edge anchored
  function handleZoom(event: WheelEvent): boolean {
    if (!chart || !dataFeed) return false;
    
    // Prevent default zoom behavior
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    
    console.log('=== ZOOM EVENT START ===');
    console.log('Raw wheel event:', {
      deltaY: event.deltaY,
      deltaMode: event.deltaMode,
      ctrlKey: event.ctrlKey,
      shiftKey: event.shiftKey,
      metaKey: event.metaKey
    });
    
    // Set zooming flag to prevent range change handler from interfering
    isZooming = true;
    
    const timeScale = chart.timeScale();
    const visibleRange = timeScale.getVisibleRange();
    if (!visibleRange) return false;
    
    const currentFrom = Number(visibleRange.from);
    const currentTo = Number(visibleRange.to);
    const currentRange = currentTo - currentFrom;
    
    // Check if we're near the right edge
    const currentTime = Math.floor(Date.now() / 1000);
    const allData = dataFeed.getAllData();
    const latestDataTime = allData.length > 0 ? allData[allData.length - 1].time : currentTime;
    // Improved detection: within 1 candle of the latest data
    const isNearRightEdge = currentTo >= latestDataTime - (granularityToSeconds[currentGranularity] || 60);
    
    // Normalize deltaY based on deltaMode
    // deltaMode: 0 = pixels, 1 = lines, 2 = pages
    let normalizedDeltaY = event.deltaY;
    if (event.deltaMode === 1) {
      // Lines mode: multiply by 40 (typical line height)
      normalizedDeltaY = event.deltaY * 40;
    } else if (event.deltaMode === 2) {
      // Pages mode: multiply by 800 (typical page height)
      normalizedDeltaY = event.deltaY * 800;
    }
    
    const isZoomingOut = normalizedDeltaY > 0;
    
    console.log('Zoom data:', {
      currentRange,
      isNearRightEdge,
      isZoomingOut,
      latestDataTime: new Date(latestDataTime * 1000).toISOString(),
      currentTo: new Date(currentTo * 1000).toISOString(),
      deltaY: event.deltaY,
      deltaMode: event.deltaMode,
      normalizedDeltaY
    });
    
    // More gradual zoom factors for smoother experience
    const baseZoomSpeed = 0.0015; // Reduced base zoom speed
    const zoomIntensity = Math.min(Math.abs(normalizedDeltaY) * baseZoomSpeed, 0.3); // Max 30% change per wheel event
    
    // More gradual zoom factor
    const zoomFactor = isZoomingOut 
      ? 1 + zoomIntensity     // Zoom out: increase range gradually
      : 1 - zoomIntensity;    // Zoom in: decrease range gradually
    
    const newRange = currentRange * zoomFactor;
    
    console.log('Zoom calculation:', {
      deltaY: event.deltaY,
      normalizedDeltaY,
      zoomIntensity,
      zoomFactor,
      currentRange: currentRange / 3600 + ' hours',
      newRange: newRange / 3600 + ' hours'
    });
    
    // Limit zoom range (min 3 candles, max 5 years)
    const minRange = (granularityToSeconds[currentGranularity] || 60) * 3; // At least 3 candles
    const maxRange = 5 * 365 * 24 * 60 * 60; // 5 years
    const clampedRange = Math.max(minRange, Math.min(maxRange, newRange));
    
    // Check if we're trying to zoom out but being limited
    if (normalizedDeltaY > 0 && newRange > currentRange && clampedRange <= currentRange) {
      console.warn('Zoom out blocked by range limits!', {
        currentRange: currentRange / 3600 + ' hours',
        requestedRange: newRange / 3600 + ' hours',
        clampedRange: clampedRange / 3600 + ' hours'
      });
    }
    
    console.log('Range limits:', {
      minRange: minRange / 3600 + ' hours',
      maxRange: maxRange / (365 * 24 * 60 * 60) + ' years',
      clampedRange: clampedRange / 3600 + ' hours',
      wasClamped: clampedRange !== newRange
    });
    
    let newFrom: number;
    let newTo: number;
    const rightPadding = granularityToSeconds[currentGranularity] || 60;
    
    // Only anchor to right edge when:
    // 1. Already viewing near the right edge (isNearRightEdge)
    // 2. Shift key is pressed (manual override to anchor)
    // 3. Alt key is NOT pressed (Alt allows free zoom even at right edge)
    const shouldAnchorRight = (isNearRightEdge || event.shiftKey) && !event.altKey;
    
    if (shouldAnchorRight) {
      // Keep right edge anchored when already viewing recent data
      const rightEdge = currentTime + rightPadding;
      newTo = rightEdge;
      newFrom = rightEdge - clampedRange;
      console.log('Anchoring to right edge (already at edge or shift pressed)');
    } else {
      // When viewing historical data, zoom around mouse position
      // Ensure we have the canvas element
      if (!chartCanvasElement) {
        chartCanvasElement = chartContainer.querySelector('canvas');
      }
      
      if (chartCanvasElement) {
        const rect = chartCanvasElement.getBoundingClientRect();
        const mouseX = event.clientX - rect.left;
        const chartWidth = rect.width;
        const mouseRatio = mouseX / chartWidth;
      
        // Calculate the time at mouse position
        const mouseTime = currentFrom + (currentRange * mouseRatio);
        
        // Zoom around the mouse position
        const leftRatio = (mouseTime - currentFrom) / currentRange;
        const rightRatio = (currentTo - mouseTime) / currentRange;
        
        newFrom = mouseTime - (clampedRange * leftRatio);
        newTo = mouseTime + (clampedRange * rightRatio);
        
        // Ensure we don't go beyond current time
        if (newTo > currentTime + rightPadding) {
          const shift = newTo - (currentTime + rightPadding);
          newTo = currentTime + rightPadding;
          newFrom -= shift;
        }
      } else {
        // Fallback if we can't find the canvas - zoom from center
        console.warn('Canvas element not found, zooming from center');
        const center = (currentFrom + currentTo) / 2;
        const halfRange = clampedRange / 2;
        newFrom = center - halfRange;
        newTo = center + halfRange;
      }
    }
    
    // Apply the new range with smooth animation
    console.log('Setting visible range:', {
      from: new Date(newFrom * 1000).toISOString(),
      to: new Date(newTo * 1000).toISOString(),
      clampedRange: clampedRange / 3600 + ' hours'
    });
    
    // Simply clamp to available data without adjustments that cause jumping
    const firstDataTime = allData.length > 0 ? allData[0].time : newFrom;
    if (newFrom < firstDataTime) {
      newFrom = firstDataTime;
      // Keep the zoom behavior consistent - maintain the requested range size
      newTo = newFrom + clampedRange;
    }
    
    // Check if the range actually changed
    const rangeChanged = !previousVisibleRange || 
      Math.abs(previousVisibleRange.from - newFrom) > 1 || 
      Math.abs(previousVisibleRange.to - newTo) > 1;
    
    if (!rangeChanged) {
      console.warn('Range did not change!', {
        prev: previousVisibleRange,
        new: { from: newFrom, to: newTo }
      });
    }
    
    console.log('=== ZOOM EVENT END ===');
    console.log('Final range being set:', {
      from: new Date(newFrom * 1000).toISOString(),
      to: new Date(newTo * 1000).toISOString(),
      range: (newTo - newFrom) / 3600 + ' hours',
      previousRange: currentRange / 3600 + ' hours',
      isZoomingOut,
      expectedBehavior: isZoomingOut ? 'range should increase' : 'range should decrease'
    });
    
    timeScale.setVisibleRange({
      from: newFrom as Time,
      to: newTo as Time
    });
    
    // Store the range for future comparison
    previousVisibleRange = { from: newFrom, to: newTo };
    
    // Reset zooming flag after a delay
    setTimeout(() => {
      isZooming = false;
    }, 100);
    
    return false;
  }
  
  // Function to handle zoom events and load more data
  let isLoadingMore = false;
  async function handleVisibleRangeChange() {
    if (!chart || !dataFeed || !candleSeries || isLoadingMore || loadingNewGranularity || manualGranularityLock || manualPeriodLock || isChangingPeriod || isZooming) {
      if (isChangingPeriod) {
        console.log('Skipping handleVisibleRangeChange - period is changing');
      }
      if (isZooming) {
        console.log('Skipping handleVisibleRangeChange - zooming in progress');
      }
      return;
    }
    
    console.log(`handleVisibleRangeChange - isAutoGranularity: ${isAutoGranularity}, currentGranularity: ${currentGranularity}, manualGranularityLock: ${manualGranularityLock}`);
    
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
    
    // DISABLED: Auto-granularity re-enabling logic
    // When using the Dashboard component, granularity is managed externally
    // We should never automatically re-enable auto-granularity
    //
    // if (!isAutoGranularity && !manualGranularityLock && !loadingNewGranularity && !isChangingPeriod) {
    //   const optimalGranularity = getOptimalGranularityForRange(visibleRangeSeconds);
    //   const currentGranularitySeconds = granularityToSeconds[currentGranularity];
    //   const optimalGranularitySeconds = granularityToSeconds[optimalGranularity];
    //   
    //   if (currentGranularitySeconds * 20 < optimalGranularitySeconds || 
    //       currentGranularitySeconds > optimalGranularitySeconds * 20) {
    //     console.log('Re-enabling auto-granularity due to significant zoom change');
    //     isAutoGranularity = true;
    //   }
    // }
    
    // Check if we need to switch granularity (auto-granularity mode)
    // IMPORTANT: This should rarely happen since we start with auto-granularity disabled
    if (isAutoGranularity && !loadingNewGranularity && !isChangingPeriod) {
      const optimalGranularity = getOptimalGranularityForRange(visibleRangeSeconds);
      
      if (optimalGranularity !== currentGranularity) {
        console.log(`Auto-granularity active: Switching from ${currentGranularity} to ${optimalGranularity}`);
        console.log(`Visible range: ${visibleRangeSeconds}s, Current: ${granularityToSeconds[currentGranularity]}s, Optimal: ${granularityToSeconds[optimalGranularity]}s`);
        loadingNewGranularity = true;
        console.log(`WARNING: Auto-granularity is changing currentGranularity from ${currentGranularity} to ${optimalGranularity}`);
        currentGranularity = optimalGranularity;
        granularity = optimalGranularity; // Update the UI
        
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
        console.log(`Optimal granularity for ${rangeSeconds}s range: ${key} (${value}s)`);
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
  
  // Update clock and countdown
  function updateClock() {
    const now = new Date();
    const nowSeconds = Math.floor(now.getTime() / 1000);
    
    // Format current time
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const seconds = now.getSeconds().toString().padStart(2, '0');
    currentTime = `${hours}:${minutes}:${seconds}`;
    
    // Calculate countdown to next candle
    // Use the actual granularity prop instead of currentGranularity for countdown
    const granularitySeconds = granularityToSeconds[granularity] || 60;
    const secondsIntoCurrentCandle = nowSeconds % granularitySeconds;
    const secondsUntilNextCandle = granularitySeconds - secondsIntoCurrentCandle;
    
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
  
  // Watch for granularity changes from parent component
  $: if (candleSeries && dataFeed && chart && granularity !== previousGranularity) {
    console.log(`Granularity prop changed from ${previousGranularity} to ${granularity}`);
    handleGranularityChange();
  }
  
  // Ensure currentGranularity stays in sync with granularity prop
  $: if (granularity !== currentGranularity && !isAutoGranularity) {
    console.log(`Syncing currentGranularity (${currentGranularity}) with granularity prop (${granularity})`);
    currentGranularity = granularity;
  }
  
  // Watch for period changes
  $: if (candleSeries && dataFeed && chart && period !== previousPeriod) {
    handlePeriodChange();
  }
  
  function handleGranularityChange() {
    console.log(`Manual granularity change: ${previousGranularity} -> ${granularity}`);
    console.log('Disabling auto-granularity due to manual selection');
    previousGranularity = granularity;
    isAutoGranularity = false;
    manualGranularityLock = true;
    currentGranularity = granularity;
    isChangingPeriod = true;
    
    // Ensure the data feed uses the correct granularity
    dataFeed.setActiveGranularity(granularityToSeconds[granularity]);
    
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
    
    // Don't re-enable auto-granularity on period change
    // The Dashboard component manages granularity selection
    // if (!manualGranularityLock) {
    //   isAutoGranularity = true;
    // }
    
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
    
    // Sync currentGranularity with the prop and set initial active granularity
    currentGranularity = granularity;
    dataFeed.setActiveGranularity(granularityToSeconds[currentGranularity] || 60);
    console.log(`Initial granularity: ${currentGranularity}, isAutoGranularity: ${isAutoGranularity}`);
    
    // Set loading status
    status = 'loading';

    try {
      // Load initial data based on timeframe
      await loadChartData();

      // Subscribe to real-time updates
      dataFeed.subscribe('chart', (candle: CandleData, isNew?: boolean) => {
        if (!candleSeries || !dataFeed) return;
        
        console.log('Chart subscription received:', {
          time: new Date(candle.time * 1000).toISOString(),
          isNew: isNew,
          currentGranularity: currentGranularity,
          isAutoGranularity: isAutoGranularity
        });
        
        if (isNew) {
          // This is a new candle - need to refresh all data
          console.log('New candle detected, refreshing chart data...');
          
          // Flash cache status to show update
          cacheStatus = 'updating';
          clearTimeout(cacheUpdateTimeout);
          cacheUpdateTimeout = setTimeout(() => {
            cacheStatus = 'ready';
          }, 2000); // Increased duration to 2 seconds for better visibility
          
          // Temporarily disable auto-granularity during data update
          const prevAutoGranularity = isAutoGranularity;
          if (!prevAutoGranularity) {
            manualGranularityLock = true;
          }
          
          const chartData = dataFeed.getAllData().map(c => ({
            ...c,
            time: c.time as Time
          }));
          candleSeries.setData(chartData);
          
          // Restore auto-granularity state after a brief delay
          if (!prevAutoGranularity) {
            setTimeout(() => {
              manualGranularityLock = false;
            }, 1000);
          }
          
          // Auto-scroll to show the new candle if we're at the right edge
          const timeScale = chart?.timeScale();
          if (timeScale) {
            const visibleRange = timeScale.getVisibleRange();
            if (visibleRange) {
              const visibleTo = Number(visibleRange.to);
              const currentTime = Math.floor(Date.now() / 1000);
              
              // Get all data again after update to find previous last candle
              const allDataBeforeNew = dataFeed.getAllData();
              const lastDataTime = allDataBeforeNew[allDataBeforeNew.length - 2]?.time || 0; // Previous last candle
              
              console.log(`Auto-scroll check: visibleTo=${new Date(visibleTo * 1000).toISOString()}, lastDataTime=${new Date(lastDataTime * 1000).toISOString()}, currentTime=${new Date(currentTime * 1000).toISOString()}`);
              
              // If we were showing near the last candle OR near current time, shift to show the new one
              const isNearLastCandle = Math.abs(visibleTo - lastDataTime) < granularityToSeconds[currentGranularity] * 2;
              const isNearCurrentTime = Math.abs(visibleTo - currentTime) < granularityToSeconds[currentGranularity] * 2;
              
              if (isNearLastCandle || isNearCurrentTime) {
                const visibleFrom = Number(visibleRange.from);
                const rangeSize = visibleTo - visibleFrom;
                
                // Ensure we show up to current time with the new candle
                const newVisibleTo = Math.max(candle.time, currentTime) + (granularityToSeconds[currentGranularity] * 0.5); // Add half candle padding
                const newVisibleFrom = newVisibleTo - rangeSize;
                
                console.log(`Auto-scrolling to show new candle: ${new Date(newVisibleFrom * 1000).toISOString()} to ${new Date(newVisibleTo * 1000).toISOString()}`);
                
                timeScale.setVisibleRange({
                  from: newVisibleFrom as Time,
                  to: newVisibleTo as Time
                });
              }
            }
          }
        } else {
          // This is an update to existing candle
          candleSeries.update({
            ...candle,
            time: candle.time as Time
          });
        }
      });

      // Update status based on WebSocket connection
      dataFeed.ws.onStatus((wsStatus) => {
        status = wsStatus;
      });

      // Configure time scale for better zoom experience with large datasets
      chart.timeScale().applyOptions({
        rightOffset: 10, // Increased offset to keep latest candle visible
        barSpacing: 6,
        minBarSpacing: 0.1,
        fixLeftEdge: false, // Allow scrolling
        fixRightEdge: false, // Allow scrolling
        lockVisibleTimeRangeOnResize: true,
        timeVisible: true,
        allowScrollStretching: false, // Disable default wheel stretching since we handle it
        localization: {
          locale: 'en-US',
          timeFormatter: (time: number) => {
            const date = new Date(time * 1000);
            const hours = date.getHours().toString().padStart(2, '0');
            const minutes = date.getMinutes().toString().padStart(2, '0');
            return `${hours}:${minutes}`;
          },
          dateFormatter: (time: number) => {
            const date = new Date(time * 1000);
            return date.toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric'
            });
          }
        },
        rightBarStaysOnScroll: false, // Don't force right bar to stay visible
        borderVisible: false,
        borderColor: '#2a2a2a',
        visible: true,
        timeVisible: true,
        secondsVisible: granularityToSeconds[granularity] < 3600, // Show seconds for < 1h granularity
        allowBoldLabels: true,
        shiftVisibleRangeOnNewBar: false, // We handle this manually
        handleScroll: {
          mouseWheel: false,
          pressedMouseMove: true,
          horzTouchDrag: true,
          vertTouchDrag: false
        }, // Disable mouse wheel but keep other scroll
        handleScale: {
          axisPressedMouseMove: true,
          mouseWheel: false,
          pinch: true
        } // Disable mouse wheel scaling but keep other scale
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
        if (chart) {
          chart.timeScale().subscribeVisibleTimeRangeChange(() => {
            // Debounce the range change handler
            clearTimeout(rangeChangeTimeout);
            rangeChangeTimeout = setTimeout(handleVisibleRangeChange, 300);
          });
          
          // Add custom zoom handler to keep right edge anchored
          // Wait a bit for chart to fully render then attach handlers
          setTimeout(() => {
            // Try multiple selectors to ensure we get the right element
            chartCanvasElement = chartContainer.querySelector('canvas');
            const chartWrapper = chartContainer.querySelector('.tv-lightweight-charts');
            const allCanvases = chartContainer.querySelectorAll('canvas');
            
            console.log('Found canvases:', allCanvases.length);
            console.log('Attaching wheel handler to container and all canvases');
            
            // Attach to all possible elements
            chartContainer.addEventListener('wheel', handleZoom, { passive: false, capture: true });
            
            allCanvases.forEach((canvas, index) => {
              console.log(`Attaching to canvas ${index}`);
              canvas.addEventListener('wheel', handleZoom, { passive: false });
            });
            
            if (chartWrapper) {
              chartWrapper.addEventListener('wheel', handleZoom, { passive: false });
            }
          }, 500);
        }
      }, 1000);
      
      // Start clock interval
      updateClock(); // Initial update
      clockInterval = setInterval(updateClock, 1000);
      
      // Periodically check if we need to fetch latest data (every 30 seconds)
      dataCheckInterval = setInterval(async () => {
        if (dataFeed && candleSeries) {
          const allData = dataFeed.getAllData();
          if (allData.length > 0) {
            const lastDataTime = allData[allData.length - 1].time;
            const currentTime = Math.floor(Date.now() / 1000);
            const timeDiff = currentTime - lastDataTime;
            
            // If last data is more than 2 candle periods old, fetch latest
            if (timeDiff > granularityToSeconds[currentGranularity] * 2) {
              console.log(`Data is ${timeDiff}s old, fetching latest...`);
              
              // Preserve manual granularity selection during refresh
              const prevAutoGranularity = isAutoGranularity;
              if (!prevAutoGranularity) {
                manualGranularityLock = true;
              }
              
              await dataFeed.fetchLatestCandle();
              
              // Refresh chart with latest data
              const updatedData = dataFeed.getAllData().map(c => ({
                ...c,
                time: c.time as Time
              }));
              candleSeries.setData(updatedData);
              
              // Restore state after refresh
              if (!prevAutoGranularity) {
                setTimeout(() => {
                  manualGranularityLock = false;
                }, 500);
              }
            }
          }
        }
      }, 30000);
      
      // Set cache status to ready after initial load
      cacheStatus = 'ready';
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
    if (cacheUpdateTimeout) {
      clearTimeout(cacheUpdateTimeout);
    }
    if (clockInterval) {
      clearInterval(clockInterval);
    }
    if (dataCheckInterval) {
      clearInterval(dataCheckInterval);
    }
    if (resizeHandler) {
      window.removeEventListener('resize', resizeHandler);
    }
    if (chartCanvasElement) {
      chartCanvasElement.removeEventListener('wheel', handleZoom);
    }
    if (chartContainer) {
      chartContainer.removeEventListener('wheel', handleZoom, { capture: true });
      
      const allCanvases = chartContainer.querySelectorAll('canvas');
      allCanvases.forEach(canvas => {
        canvas.removeEventListener('wheel', handleZoom);
      });
      
      const chartWrapper = chartContainer.querySelector('.tv-lightweight-charts');
      if (chartWrapper) {
        chartWrapper.removeEventListener('wheel', handleZoom);
      }
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
  
  <div class="clock-container">
    <div class="clock-time">{currentTime}</div>
    <div class="clock-countdown">
      <span class="countdown-label">Next {granularity}:</span>
      <span class="countdown-value">{countdown}</span>
    </div>
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
  
  .status-dot.updating {
    background: #3b82f6;
    animation: pulse-scale 0.5s infinite;
    box-shadow: 0 0 10px #3b82f6;
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
</style>