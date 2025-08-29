<script lang="ts">
  // console.log('Chart.svelte VERSION 6 LOADED - Disabled visible range subscription to fix null errors');
  import { onMount, onDestroy } from 'svelte';
  import { createChart, ColorType } from 'lightweight-charts';
  import type { IChartApi, ISeriesApi, Time } from 'lightweight-charts';
  import { ChartDataFeed } from '../services/chartDataFeed';
  import type { CandleData } from '../types/coinbase';

  let chartContainer: HTMLDivElement;
  let chart: IChartApi | null = null; // VERSION 5 - Fixed null errors
  let candleSeries: ISeriesApi<'Candlestick'> | any = null;
  let dataFeed: ChartDataFeed | null = null;

  export let status: 'connected' | 'disconnected' | 'error' | 'loading' = 'loading';
  export let granularity: string = '1m';
  export let period: string = '1H';
  export let onGranularityChange: ((g: string) => void) | undefined = undefined;
  export let onDataFeedReady: ((feed: ChartDataFeed) => void) | undefined = undefined;
  export let trades: Array<{timestamp: number, type: string, price: number}> = [];
  export let autoScroll: boolean = true;  // Enable auto-scrolling to new candles by default
  export let onChartReady: ((chart: IChartApi, candleSeries: ISeriesApi<'Candlestick'>) => void) | undefined = undefined;  // Callback when chart is ready
  export let isPaperTestRunning: boolean = false;
  export let isPaperTestMode: boolean = false;  // True when in paper test mode (even after completion)
  export let paperTestSimTime: Date | null = null;
  export let paperTestDate: Date | null = null;  // The date being tested in paper test mode
  export let enableZoom: boolean = true;  // Enable chart zoom/pan interactions
  export let lockedTimeframe: boolean = false;  // Whether timeframe is locked (for display only)
  
  // Generate unique instance ID for this chart component
  const instanceId = `chart-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  // console.log(`Chart: Created new instance ${instanceId}`);
  
  // Debug prop changes
  // $: console.log('Chart props changed:', { period, granularity, isInitialized, instanceId });
  
  // Cache and loading state
  export let cacheStatus = 'initializing';
  let displayStatus = 'initializing'; // Combined status for display
  let statusResetTimer: ReturnType<typeof setTimeout> | null = null;
  let isLoadingData = false;
  
  // Update display status whenever cache status changes
  $: if (statusResetTimer === null) displayStatus = cacheStatus;
  
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
  // let errorMessage = ''; // Removed error popup
  
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
  let resizeObserver: ResizeObserver | null = null;
  
  // Track previous period to detect changes
  let previousPeriod = period;
  let isInitialized = false;
  
  // Track if initial historical data has been loaded
  let initialDataLoaded = false;
  let pendingCandles: any[] = [];
  
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
  let previousPaperTestRunning = isPaperTestRunning;
  let previousPaperTestMode = isPaperTestMode;
  let updateTimer: any = null;
  let reloadDebounceTimer: any = null;
  
  // Watch for paper test state changes
  $: if (dataFeed && previousPaperTestRunning && !isPaperTestRunning) {
    console.log('Chart: Paper test stopped, reconnecting to live data...');
    // Re-establish this chart as the active instance
    dataFeed.setActiveInstance(instanceId);
    // Update the previous state
    previousPaperTestRunning = isPaperTestRunning;
  } else if (isPaperTestRunning !== previousPaperTestRunning) {
    previousPaperTestRunning = isPaperTestRunning;
  }
  
  // Watch for paper test mode transitions (from paper test mode back to live)
  $: if (isInitialized && chart && dataFeed && previousPaperTestMode && !isPaperTestMode) {
    console.log('Chart: Transitioning from paper test mode to live mode, reloading chart data...');
    // Re-establish this chart as the active instance
    dataFeed.setActiveInstance(instanceId);
    // Add a small delay to ensure the instance is properly set before reloading
    setTimeout(() => {
      // Trigger a full reload to get fresh live data
      debouncedReloadData();
    }, 50);
    // Update the previous state
    previousPaperTestMode = isPaperTestMode;
  } else if (isPaperTestMode !== previousPaperTestMode) {
    previousPaperTestMode = isPaperTestMode;
  }

  // Watch for external granularity or period changes
  $: if (isInitialized && chart && dataFeed && (granularity !== previousGranularity || period !== previousPeriod)) {
    console.log(`📈 CHART: Props changed - Period: ${previousPeriod} → ${period}, Granularity: ${previousGranularity} → ${granularity}`);
    console.log('📈 CHART: Triggering reactive update');
    
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
  
  // Debounce trade marker updates
  let tradeMarkerTimeout: NodeJS.Timeout | null = null;
  
  // Update trade markers when trades change
  $: if (candleSeries && trades) {
    // console.log('Chart: Trades prop changed, updating markers', {
    //   tradesLength: trades.length,
    //   candleSeries: !!candleSeries,
    //   chart: !!chart
    // });
    
    // Debounce marker updates to prevent excessive calls
    if (tradeMarkerTimeout) {
      clearTimeout(tradeMarkerTimeout);
    }
    
    tradeMarkerTimeout = setTimeout(() => {
      updateTradeMarkers();
    }, 100);
  }
  
  function handleManualGranularityChange(newGranularity: string) {
    if (!dataFeed || !chart || !candleSeries) return;
    
    console.log(`VERSION 5: Manual granularity change from ${effectiveGranularity} to ${newGranularity}`);
    
    // Update granularity using ChartDataFeed API
    effectiveGranularity = newGranularity;
    dataFeed.setManualGranularity(newGranularity);
    
    // DON'T clear data here - it causes null errors
    // Let reloadData handle the transition smoothly
    
    // Update countdown display
    updateClock();
    
    // Reload data with new granularity
    debouncedReloadData();
  }

  onMount(async () => {
    // Reset initial data loaded flag
    initialDataLoaded = false;
    pendingCandles = [];
    
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
          autoScale: true,
          mode: 0, // Normal mode (not logarithmic)
        },
        timeScale: {
          rightOffset: 5,
          barSpacing: 3,      // Reduced to fit more candles in narrow windows
          minBarSpacing: 0.5, // Allow candles to squeeze together when needed
          fixLeftEdge: false,  // Allow programmatic scrolling
          fixRightEdge: false, // Allow full range control
          lockVisibleTimeRangeOnResize: true,
          timeVisible: true,
          secondsVisible: false,
          borderColor: '#2a2a2a',
          shiftVisibleRangeOnNewBar: false, // We'll handle shifting manually
        },
        handleScroll: {
          mouseWheel: enableZoom,  // Enable scroll wheel zoom
          pressedMouseMove: enableZoom,  // Enable click-drag to pan
          horzTouchDrag: enableZoom,  // Enable touch drag
          vertTouchDrag: false,  // Keep vertical drag disabled
        },
        handleScale: {
          mouseWheel: enableZoom,  // Enable scroll wheel zoom
          pinch: enableZoom,  // Enable pinch zoom
          axisPressedMouseMove: enableZoom,  // Enable axis scale
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

      // Create candle series using the correct API
      candleSeries = chart.addCandlestickSeries({
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
        },
        // Add minimum visible price range to prevent candle compression
        scaleMargins: {
          top: 0.1,
          bottom: 0.1
        }
      });

      // Ensure candleSeries was created successfully
      if (!candleSeries) {
        console.error('Failed to create candle series');
        return;
      }
      
      // console.log('Chart: Successfully created chart and candle series');
      
      // Notify parent component that chart is ready
      if (onChartReady) {
        onChartReady(chart, candleSeries);
      }

      // Initialize data feed with real Coinbase data
      dataFeed = ChartDataFeed.getInstance();
      
      // Set this as the active instance
      dataFeed.setActiveInstance(instanceId);
      
      // Force clear any cached data to ensure fresh start
      // console.log(`Chart: Instance ${instanceId} set as active`);
      
      // Notify parent component that dataFeed is ready
      if (onDataFeedReady && dataFeed) {
        onDataFeedReady(dataFeed);
      }
      
      // IMPORTANT: Subscribe IMMEDIATELY before any data arrives
      let historicalBatch: any[] = [];
      let historicalTimeout: NodeJS.Timeout | null = null;
      
      dataFeed.subscribe(instanceId, (candle, isNew, metadata) => {
        // console.log('Chart: Received candle update', { 
        //   time: new Date(candle.time * 1000).toISOString(),
        //   price: candle.close,
        //   isNew, 
        //   metadata,
        //   candleSeries: !!candleSeries,
        //   isLoadingData,
        //   chart: !!chart,
        //   effectiveGranularity,
        //   initialDataLoaded
        // });
        
        // Block all live updates if in paper test mode
        if (isPaperTestMode) {
          // console.log('Chart: Blocking live candle update - in paper test mode');
          return;
        }
        
        // If initial data hasn't loaded yet, queue the candle updates
        if (!initialDataLoaded) {
          // console.log('Chart: Queueing candle update - initial data not yet loaded');
          pendingCandles.push({ candle, isNew, metadata });
          return;
        }
        
        // Handle historical data batch updates
        if (metadata?.isHistorical && candleSeries) {
          // Collect historical candles in a batch
          historicalBatch.push({
            time: candle.time as Time,
            open: candle.open,
            high: candle.high,
            low: candle.low,
            close: candle.close
          });
          
          // Clear existing timeout
          if (historicalTimeout) {
            clearTimeout(historicalTimeout);
          }
          
          // Set a new timeout to process the batch
          historicalTimeout = setTimeout(() => {
            if (historicalBatch.length > 0 && candleSeries) {
              try {
                // Get existing data
                const existingData = candleSeries.data();
                
                // Combine and sort all data
                const allData = [...historicalBatch, ...existingData]
                  .sort((a, b) => (a.time as number) - (b.time as number))
                  // Remove duplicates
                  .filter((candle, index, array) => 
                    index === 0 || (candle.time as number) !== (array[index - 1].time as number)
                  );
                
                // Replace all data at once
                candleSeries.setData(allData);
                console.log(`Chart: Loaded ${historicalBatch.length} historical candles`);
                
                // Clear the batch
                historicalBatch = [];
              } catch (error) {
                console.error('Chart: Error loading historical data batch:', error);
                historicalBatch = [];
              }
            }
            historicalTimeout = null;
          }, 100); // Small delay to batch updates
          
          return; // Don't process historical data through normal update flow
        }
        
        // Handle viewport updates - slide the view without removing data
        if (metadata?.viewportUpdate && chart && autoScroll) {
          // console.log('Chart: Handling viewport update', metadata);
          try {
            // Use the selected period to determine window size
            const days = periodToDays[period] || 1/24;
            const windowSeconds = days * 86400; // Convert days to seconds
            
            // Position the window to show the most recent candles
            const newTo = metadata.latestTime + 60; // Small buffer on the right
            const newFrom = newTo - windowSeconds;
            
            // console.log('Chart: Sliding viewport to show recent candles', {
            //   period,
            //   totalCandles: metadata.totalCandles,
            //   windowDays: days,
            //   windowHours: days * 24,
            //   newRange: { 
            //     from: new Date(newFrom * 1000).toISOString(), 
            //     to: new Date(newTo * 1000).toISOString() 
            //   }
            // });
            
            chart.timeScale().setVisibleRange({
              from: newFrom as Time,
              to: newTo as Time
            });
          } catch (e) {
            console.debug('Chart: Unable to adjust viewport:', e);
          }
          
          // Continue processing the candle update
        }
        
        if (candleSeries && !isLoadingData && dataFeed.currentGranularity === effectiveGranularity) {
          // console.log('Chart: Processing candle update for', effectiveGranularity);
          
          // Set display status based on update type
          displayStatus = isNew ? 'new-candle' : 'price-update';
          
          // Clear any existing timer
          if (statusResetTimer) {
            clearTimeout(statusResetTimer);
          }
          
          // Always update the candle - ensure time is a valid number
          if (!candle.time || typeof candle.time !== 'number' || isNaN(candle.time)) {
            console.error('Chart: Invalid candle time received:', candle);
            return;
          }
          
          const chartCandle = {
            time: candle.time as Time,
            open: candle.open,
            high: candle.high,
            low: candle.low,
            close: candle.close
          };
          
          // Debug: Log candle with body size
          const bodySize = Math.abs(candle.close - candle.open);
          const bodyPercent = (bodySize / candle.open) * 100;
          if (bodyPercent < 0.01) {
            // console.log('WARNING: Very thin candle body detected:', {
            //   time: new Date(candle.time * 1000).toISOString(),
            //   open: candle.open,
            //   close: candle.close,
            //   bodySize,
            //   bodyPercent: bodyPercent.toFixed(4) + '%'
            // });
          }
          
          if (isNew) {
            // console.log(`Chart: Received new ${effectiveGranularity} candle at ${new Date(candle.time * 1000).toISOString()}`);
          } else {
            // console.log(`Chart: Updating existing ${effectiveGranularity} candle at ${new Date(candle.time * 1000).toISOString()}`);
          }
          
          // console.log('Chart: Candle data:', chartCandle);
          
          try {
            const currentData = candleSeries.data();
            
            // Check if we should update or add the candle
            if (currentData.length === 0) {
              // No data, add as first candle
              candleSeries.setData([chartCandle]);
              // console.log('Chart: Added first candle');
            } else {
              const existingIndex = currentData.findIndex((c: any) => c.time === chartCandle.time);
              const firstCandle = currentData[0];
              const lastCandle = currentData[currentData.length - 1];
              
              // Validate candle times before comparison
              const firstTime = typeof firstCandle.time === 'number' ? firstCandle.time : Number(firstCandle.time);
              const lastTime = typeof lastCandle.time === 'number' ? lastCandle.time : Number(lastCandle.time);
              
              if (isNaN(firstTime) || isNaN(lastTime)) {
                console.error('Chart: Invalid time in existing data:', { firstCandle, lastCandle });
                return;
              }
              
              if (existingIndex >= 0) {
                // Candle exists, update it
                candleSeries.update(chartCandle);
                // console.log('Chart: Successfully updated candle');
                
                // If auto-scroll is enabled and this is the last candle, ensure it's visible
                if (chart && autoScroll && existingIndex === currentData.length - 1 && effectiveGranularity === '1m') {
                  try {
                    // For 1m granularity, always maintain the fixed time window
                    const days = periodToDays[period] || 1/24;
                    const windowSeconds = days * 86400;
                    const newTo = chartCandle.time + 60; // Small buffer
                    const newFrom = newTo - windowSeconds;
                    
                    // Always update to maintain sliding window
                    chart.timeScale().setVisibleRange({
                      from: newFrom as Time,
                      to: newTo as Time
                    });
                  } catch (e) {
                    console.debug('Chart: Unable to maintain sliding window:', e);
                  }
                }
              } else if (chartCandle.time < firstTime) {
                // New candle is older than first candle, prepend and reset data
                // console.log('Chart: Prepending older candle');
                // For 1m granularity, accumulate all candles
                if (effectiveGranularity === '1m') {
                  // Maintain chronological order
                  const newData = [chartCandle, ...currentData];
                  candleSeries.setData(newData);
                  // console.log(`Chart: Total candles after prepend: ${newData.length}`);
                } else {
                  candleSeries.setData([chartCandle, ...currentData]);
                }
              } else if (chartCandle.time > lastTime) {
                // New candle is newer than last candle, append
                // console.log('Chart: Appending newer candle');
                // For 1m granularity, keep accumulating candles
                if (effectiveGranularity === '1m') {
                  // Just append to existing data
                  const newData = [...currentData, chartCandle];
                  candleSeries.setData(newData);
                  // console.log(`Chart: Total candles after append: ${newData.length}`);
                } else {
                  candleSeries.setData([...currentData, chartCandle]);
                }
                
                // Auto-scroll to show the new candle if enabled
                if (chart && isNew && autoScroll) {
                  // console.log('Chart: Auto-scrolling to show new candle');
                  try {
                    // For 1m granularity, maintain the fixed time window
                    if (effectiveGranularity === '1m') {
                      const days = periodToDays[period] || 1/24;
                      const windowSeconds = days * 86400;
                      const newTo = chartCandle.time + 60; // Small buffer
                      const newFrom = newTo - windowSeconds;
                      
                      console.log(`Chart: Sliding 1m window for ${period}`, {
                        window: `${windowSeconds/60} minutes`,
                        from: new Date(newFrom * 1000).toISOString(),
                        to: new Date(newTo * 1000).toISOString()
                      });
                      
                      chart.timeScale().setVisibleRange({
                        from: newFrom as Time,
                        to: newTo as Time
                      });
                    } else {
                      // For other granularities, use the existing range width
                      const visibleRange = chart.timeScale().getVisibleRange();
                      if (visibleRange) {
                        const rangeWidth = Number(visibleRange.to) - Number(visibleRange.from);
                        // Shift the range to include the new candle with some buffer
                        chart.timeScale().setVisibleRange({
                          from: (chartCandle.time - rangeWidth + 60) as Time,  // Keep most of the range
                          to: (chartCandle.time + 60) as Time // Add 60s buffer to see the new candle clearly
                        });
                      }
                    }
                  } catch (e) {
                    console.debug('Chart: Unable to auto-scroll:', e);
                  }
                }
              } else {
                // Insert in the middle
                // console.log('Chart: Inserting candle in the middle');
                const newData = [...currentData, chartCandle].sort((a, b) => (a.time as number) - (b.time as number));
                candleSeries.setData(newData);
              }
            }
            
            // Reset to base status after a delay
            statusResetTimer = setTimeout(() => {
              displayStatus = cacheStatus;
              statusResetTimer = null;
            }, isNew ? 3000 : 1500); // Stay visible longer - 1.5s for price, 3s for new candle
            
          } catch (error) {
            console.error('Chart: Error updating/adding candle:', error);
          }
        }
      });

      // Set up granularity change callback AFTER subscribing
      if (onGranularityChange) {
        dataFeed.onGranularityChange(onGranularityChange);
      }

      // Add small delay to ensure all components are ready
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Force set the initial granularity to ensure it's properly set
      effectiveGranularity = granularity;
      console.log('Chart: Initial mount - Setting effectiveGranularity to:', effectiveGranularity);
      
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
      
      // Subscribe to visible range changes for infinite scroll
      let isLoadingHistorical = false;
      let loadingDebounceTimer: any = null;
      
      chart.timeScale().subscribeVisibleLogicalRangeChange(async (logicalRange) => {
        try {
          // Update visible candle count
          if (logicalRange) {
            const visibleRange = chart?.timeScale().getVisibleRange();
            if (visibleRange) {
              updateVisibleCandleCount(Number(visibleRange.from), Number(visibleRange.to));
            }
          }
          
          // Check if we need to load more historical data
          if (!logicalRange || isLoadingHistorical || !dataFeed) return;
          
          // Clear any pending load
          if (loadingDebounceTimer) {
            clearTimeout(loadingDebounceTimer);
          }
          
          // Debounce to avoid multiple loads while scrolling
          loadingDebounceTimer = setTimeout(async () => {
            // Check if we're near the left edge (need more historical data)
            if (logicalRange.from < 50) {
              console.log('Chart: Approaching left edge, loading more historical data...');
              isLoadingHistorical = true;
              cacheStatus = 'loading historical';
              
              try {
                const data = candleSeries.data();
                if (data && data.length > 0) {
                  const oldestCandle = data[0];
                  const oldestTime = oldestCandle.time as number;
                  
                  // Load 300 more candles before the oldest
                  const loaded = await dataFeed.loadHistoricalDataBefore(oldestTime, 300, instanceId);
                  
                  if (loaded > 0) {
                    console.log(`Chart: Loaded ${loaded} historical candles`);
                    // Data will be updated through the subscription
                  } else {
                    console.log('Chart: No more historical data available');
                    cacheStatus = 'no more data';
                  }
                }
              } catch (error) {
                console.error('Chart: Error loading historical data:', error);
                cacheStatus = 'error';
              } finally {
                isLoadingHistorical = false;
                // Reset status after delay
                setTimeout(() => {
                  cacheStatus = 'ready';
                }, 2000);
              }
            }
          }, 200); // 200ms debounce
        } catch (error) {
          console.error('Chart: Error in visible range change:', error);
        }
      });
      
      // Set cache status
      cacheStatus = 'ready';
      
    } catch (error: any) {
      console.error('Error initializing chart:', error);
      status = 'error';
      // errorMessage = `Failed to initialize chart: ${error.message || 'Unknown error'}`;
    }

    // Handle resize
    const handleResize = () => {
      if (chart && chartContainer) {
        chart.applyOptions({
          width: chartContainer.clientWidth,
          height: chartContainer.clientHeight,
        });
        
        // Re-enforce the visible range after resize to prevent narrow windows from showing fewer candles
        setTimeout(() => {
          enforceVisibleRange();
        }, 100);
      }
    };
    
    resizeHandler = handleResize;
    window.addEventListener('resize', handleResize);
    
    // Also observe container size changes (for sidebar collapse/expand)
    resizeObserver = new ResizeObserver(() => {
      handleResize();
    });
    resizeObserver.observe(chartContainer);
  });

  // Load initial data
  async function loadInitialData() {
    console.log('📈 CHART: === loadInitialData called ===');
    // console.log('chart:', !!chart, 'dataFeed:', !!dataFeed, 'candleSeries:', !!candleSeries);
    console.log('Current settings:', { period, granularity: effectiveGranularity });
    console.log('Caller:', new Error().stack?.split('\n')[2]);
    
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
      
      // Load extra historical data for smooth zooming (300-500 candles minimum)
      const minInitialCandles = 300;
      const targetInitialCandles = Math.max(minInitialCandles, expectedCandles * 2); // Load at least 2x the visible range
      
      // Calculate start time for initial load
      let adjustedStartTime = alignedNow - (targetInitialCandles * granularitySeconds);
      let adjustedExpectedCandles = targetInitialCandles;
      
      // Special handling for 1H with 1m granularity
      if (period === '1H' && effectiveGranularity === '1m') {
        // Load 300 candles (5 hours) for smooth scrolling
        adjustedExpectedCandles = 300;
        adjustedStartTime = alignedNow - (300 * 60); // 5 hours back
        console.log(`Loading ${adjustedExpectedCandles} candles for 1H/1m view (5 hours of data)`);
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
        requestedTo: alignedNow,
        dataDebug: ''
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
      
      // For 1m granularity, load ALL available data (not just visible range)
      let dataToLoad;
      
      // If in paper test mode, load only the selected day's data
      if (isPaperTestRunning && paperTestDate) {
        const testDate = new Date(paperTestDate);
        const startOfDay = new Date(testDate);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(testDate);
        endOfDay.setHours(23, 59, 59, 999);
        
        const dayStartTime = Math.floor(startOfDay.getTime() / 1000);
        const dayEndTime = Math.floor(endOfDay.getTime() / 1000);
        
        console.log(`Chart: Loading initial paper test data for ${testDate.toLocaleDateString()}: ${startOfDay.toISOString()} to ${endOfDay.toISOString()}`);
        dataToLoad = await dataFeed.getDataForVisibleRange(dayStartTime, dayEndTime, instanceId);
      } else if (effectiveGranularity === '1m') {
        if (period === '1H') {
          // For 1H view, only load what we need (last 60 minutes + buffer)
          console.log(`Fetching last 60 minutes of 1m data for 1H view...`);
          const bufferTime = 600; // 10 minute buffer (increased from 5)
          const dataRangeStart = alignedNow - 3600 - bufferTime; // 70 minutes total
          dataToLoad = await dataFeed.getDataForVisibleRange(dataRangeStart, alignedNow, instanceId);
        } else {
          // For other periods with 1m, load appropriate range
          console.log(`Fetching 1m data for ${period}...`);
          // Use progressive loading for faster initial render
          dataToLoad = await dataFeed.loadProgressiveData(dataStartTime, alignedNow, effectiveGranularity, instanceId);
        }
      } else {
        console.log(`Fetching data from ${new Date(dataStartTime * 1000).toISOString()} to ${new Date(alignedNow * 1000).toISOString()}`);
        dataToLoad = await dataFeed.getDataForVisibleRange(dataStartTime, alignedNow, instanceId);
      }
      
      // Load data using the ChartDataFeed API
      const data = dataToLoad;
      
      // console.log('Data received:', data.length > 0 ? `${data.length} candles` : 'NO DATA');
      
      // CRITICAL: Filter data to only include candles within our time range
      let filteredData;
      if (isPaperTestRunning && paperTestDate) {
        // Paper test mode: use all data for the selected day
        filteredData = data;
      } else if (effectiveGranularity === '1m' && period === '1H') {
        // Live mode with 1H/1m: ensure exactly 60 candles
        const sixtyMinutesAgo = alignedNow - 3600;
        filteredData = data
          .filter(candle => candle.time >= sixtyMinutesAgo && candle.time <= alignedNow)
          .sort((a, b) => a.time - b.time); // Ensure proper ordering
        
        // If we have fewer than 60 candles, log a warning
        if (filteredData.length < 60) {
          console.warn(`Chart: Only ${filteredData.length} candles available for 1H/1m view, expected 60`);
          console.log('Available data range:', {
            firstCandle: filteredData[0] ? new Date(filteredData[0].time * 1000).toISOString() : 'none',
            lastCandle: filteredData[filteredData.length - 1] ? new Date(filteredData[filteredData.length - 1].time * 1000).toISOString() : 'none',
            expectedStart: new Date(sixtyMinutesAgo * 1000).toISOString(),
            expectedEnd: new Date(alignedNow * 1000).toISOString()
          });
        }
      } else {
        // All other cases: filter based on period
        filteredData = data.filter(candle => 
          candle.time >= adjustedStartTime && candle.time <= alignedNow
        );
      }
      
      // console.log(`Filtered from ${data.length} to ${filteredData.length} candles within our time range`);
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
        // errorMessage = 'No data available. Please check your connection and try again.';
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
        
        // Deduplicate candles by time (keep the last one for each timestamp)
        const uniqueChartData = chartData.reduce((acc, candle) => {
          const existingIndex = acc.findIndex(c => c.time === candle.time);
          if (existingIndex >= 0) {
            acc[existingIndex] = candle; // Replace with newer data
          } else {
            acc.push(candle);
          }
          return acc;
        }, [] as typeof chartData);
        
        console.log(`Setting chart data... ${uniqueChartData.length} candles (deduplicated from ${chartData.length})`);
        candleSeries.setData(uniqueChartData);
        
        // Update total candle count display
        totalCandleCount = chartData.length;
        visibleCandleCount = chartData.length;
        
        // Update trade markers after data is set
        if (trades && trades.length > 0) {
          console.log('Chart: Updating trade markers after data load');
          updateTradeMarkers();
        }
        
        // IMPORTANT: Force the visible range to show ONLY the requested period
        console.log('Setting visible range to REQUESTED time period...');
        
        // For 1m granularity, we have all candles but show only the selected period
        if (effectiveGranularity === '1m') {
          // Calculate the visible range based on the period
          const visibleEnd = alignedNow + 60; // Buffer for last candle
          const visibleStart = visibleEnd - periodSeconds;
          console.log(`FORCING visible range for 1m: ${new Date(visibleStart * 1000).toISOString()} to ${new Date(visibleEnd * 1000).toISOString()}`);
          console.log(`Showing last ${Math.floor(periodSeconds / 60)} minutes of ${filteredData.length} total candles`);
        } else {
          console.log(`FORCING visible range: ${visibleStartTime} to ${alignedNow + 30} (with 30s buffer for last candle)`);
        }
        
        // Use setTimeout to ensure the range is set after the data
        setTimeout(() => {
          enforceVisibleRange();
        }, 50);
        
        
        // VERSION 5: Don't update visible candle count here - it causes null errors
        // updateVisibleCandleCount(adjustedStartTime, alignedNow);
        
        // VERSION 5: Disable visible range verification - it causes null errors during transitions
        /*
        setTimeout(() => {
          try {
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
          } catch (e) {
            console.debug('Unable to get visible range for verification');
          }
        }, 200); // Slightly longer delay to ensure chart has settled
        */
      }
      
      status = 'connected';
      cacheStatus = 'ready';
      // errorMessage = ''; // Clear any previous errors
      
      // Mark initial data as loaded
      initialDataLoaded = true;
      console.log('Chart: Initial data loaded successfully, processing any pending candles...');
      
      // Process any candles that arrived while we were loading
      if (pendingCandles.length > 0) {
        console.log(`Chart: Processing ${pendingCandles.length} pending candle updates`);
        pendingCandles.forEach(({ candle, isNew, metadata }) => {
          // Apply the same update logic that would have run if initial data was loaded
          if (candleSeries && !isLoadingData && dataFeed.currentGranularity === effectiveGranularity) {
            const chartCandle = {
              time: candle.time as Time,
              open: candle.open,
              high: candle.high,
              low: candle.low,
              close: candle.close
            };
            
            try {
              const currentData = candleSeries.data();
              const lastCandle = currentData.length > 0 ? currentData[currentData.length - 1] : null;
              
              if (isNew || (lastCandle && chartCandle.time > lastCandle.time)) {
                candleSeries.update(chartCandle);
              } else if (lastCandle && chartCandle.time === lastCandle.time) {
                candleSeries.update(chartCandle);
              }
            } catch (error) {
              console.error('Chart: Error processing pending candle:', error);
            }
          }
        });
        pendingCandles = []; // Clear the queue
      }
      
      // For 1m granularity, don't fit content - maintain the time window
      setTimeout(() => {
        try {
          if (effectiveGranularity !== '1m') {
            // Only fit content for non-1m granularities
            chart?.timeScale().fitContent();
            console.log('Chart: Fit content called for non-1m granularity');
          } else {
            // For 1m, enforce the visible range to show only the selected period
            console.log('Chart: Skipping fitContent for 1m, enforcing visible range instead');
            enforceVisibleRange();
          }
        } catch (e) {
          console.debug('Unable to fit content or enforce range:', e);
        }
      }, 100);
    } catch (error: any) {
      console.error('Error loading initial data:', error);
      console.error('Error stack:', error.stack);
      status = 'error';
      cacheStatus = 'error';
      if (error?.response?.status === 429) {
        // errorMessage = 'Rate limit exceeded. Please wait a moment and try again.';
      } else {
        // errorMessage = `Failed to load chart data: ${error.message || 'Unknown error'}`;
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
    
    console.log('📈 CHART: === reloadData called ===');
    console.log('Caller:', new Error().stack?.split('\n')[2]);
    
    isLoadingData = true;
    
    try {
      console.log('VERSION 5: Reloading data with granularity:', effectiveGranularity);
      console.log('Chart: Paper test state:', { isPaperTestRunning, paperTestDate: paperTestDate ? paperTestDate.toISOString() : null });
      
      // DON'T clear the chart data - just replace it when new data arrives
      // This avoids null errors from an empty chart
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
      let dataToLoad;
      
      // If in paper test mode, load only the selected day's data
      if (isPaperTestRunning && paperTestDate) {
        const testDate = new Date(paperTestDate);
        const startOfDay = new Date(testDate);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(testDate);
        endOfDay.setHours(23, 59, 59, 999);
        
        const dayStartTime = Math.floor(startOfDay.getTime() / 1000);
        const dayEndTime = Math.floor(endOfDay.getTime() / 1000);
        
        console.log(`Chart: Loading paper test data for ${testDate.toLocaleDateString()}: ${startOfDay.toISOString()} to ${endOfDay.toISOString()}`);
        console.log(`Chart: Paper test timestamps: ${dayStartTime} to ${dayEndTime}`);
        dataToLoad = await dataFeed.getDataForVisibleRange(dayStartTime, dayEndTime, instanceId);
        console.log(`Chart: Paper test data loaded: ${dataToLoad.length} candles`);
      } else if (effectiveGranularity === '1m') {
        if (period === '1H') {
          // For 1H view, only load what we need (last 60 minutes + buffer)
          console.log(`Reloading last 60 minutes of 1m data for 1H view...`);
          const bufferTime = 600; // 10 minute buffer (increased from 5)
          const dataRangeStart = alignedNow - 3600 - bufferTime; // 70 minutes total
          dataToLoad = await dataFeed.getDataForVisibleRange(dataRangeStart, alignedNow, instanceId);
        } else {
          // For other periods with 1m, load appropriate range
          console.log(`Reloading 1m data for ${period}...`);
          dataToLoad = await dataFeed.getDataForVisibleRange(startTime, alignedNow, instanceId);
        }
      } else {
        console.log(`Loading ${period} data with ${effectiveGranularity} candles...`);
        dataToLoad = await dataFeed.getDataForVisibleRange(startTime, alignedNow, instanceId);
      }
      const data = dataToLoad;
      
      // CRITICAL: Filter data to only include candles within our time range
      let filteredData;
      if (isPaperTestRunning && paperTestDate) {
        // Paper test mode: use all data for the selected day
        filteredData = data;
      } else if (effectiveGranularity === '1m' && period === '1H') {
        // Live mode with 1H/1m: ensure exactly 60 candles
        const sixtyMinutesAgo = alignedNow - 3600;
        filteredData = data
          .filter(candle => candle.time >= sixtyMinutesAgo && candle.time <= alignedNow)
          .sort((a, b) => a.time - b.time); // Ensure proper ordering
        
        // If we have fewer than 60 candles, log a warning
        if (filteredData.length < 60) {
          console.warn(`Chart: Only ${filteredData.length} candles available for 1H/1m view on reload, expected 60`);
          console.log('Available data range:', {
            firstCandle: filteredData[0] ? new Date(filteredData[0].time * 1000).toISOString() : 'none',
            lastCandle: filteredData[filteredData.length - 1] ? new Date(filteredData[filteredData.length - 1].time * 1000).toISOString() : 'none',
            expectedStart: new Date(sixtyMinutesAgo * 1000).toISOString(),
            expectedEnd: new Date(alignedNow * 1000).toISOString()
          });
        }
      } else {
        // All other cases: filter based on period
        filteredData = data.filter(candle => 
          candle.time >= startTime && candle.time <= alignedNow
        );
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
      
      // Log warning if we don't have the expected number of candles for 1H/1m
      if (period === '1H' && effectiveGranularity === '1m' && filteredData.length !== 60) {
        console.warn(`Chart: Expected exactly 60 candles for 1H/1m but got ${filteredData.length} after reload`);
      }
      
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
        // errorMessage = ''; // Clear any previous errors
      }
      
      if (filteredData.length > 0) {
        const chartData = filteredData.map(candle => ({
          ...candle,
          time: candle.time as Time
        }));
        
        // Deduplicate candles by time (keep the last one for each timestamp)
        const uniqueChartData = chartData.reduce((acc, candle) => {
          const existingIndex = acc.findIndex(c => c.time === candle.time);
          if (existingIndex >= 0) {
            acc[existingIndex] = candle; // Replace with newer data
          } else {
            acc.push(candle);
          }
          return acc;
        }, [] as typeof chartData);
        
        console.log(`Reload: Setting chart data... ${uniqueChartData.length} candles (deduplicated from ${chartData.length})`);
        
        // Update chart data
        candleSeries.setData(uniqueChartData);
        
        // Update trade markers after data reload
        if (trades && trades.length > 0) {
          console.log('Chart: Updating trade markers after data reload');
          updateTradeMarkers();
        }
        
        // Force the chart to show all data
        if (chartData.length > 0) {
          console.log('VERSION 5: Setting data and fitting content');
          
          // Use requestAnimationFrame to ensure chart has processed the data
          requestAnimationFrame(() => {
            try {
              // Check if we have valid data before fitting
              const currentData = candleSeries?.data();
              if (!currentData || currentData.length === 0) {
                console.debug('VERSION 5: No data to fit, skipping fitContent');
                return;
              }
              
              // For 1m granularity, enforce visible range instead of fitting all content
              if (effectiveGranularity === '1m') {
                console.log('Chart: Enforcing visible range for 1m granularity after reload');
                enforceVisibleRange();
              } else {
                // Fit content to show all candles for other granularities
                chart?.timeScale().fitContent();
              }
              
              // VERSION 5: Don't update visible candle count here - it causes errors
              // The subscribeVisibleTimeRangeChange will handle it when the chart is ready
            } catch (e) {
              console.debug('VERSION 5: Unable to fit content or enforce range:', e);
            }
          });
        }
        
        // Verification is now handled in the requestAnimationFrame callback above
      }
    } catch (error: any) {
      console.error('Error reloading data:', error);
      if (error?.response?.status === 429) {
        // errorMessage = 'Rate limit exceeded. Please wait a moment and try again.';
      } else {
        // errorMessage = `Failed to reload data: ${error.message || 'Unknown error'}`;
      }
    } finally {
      isLoadingData = false;
      console.log('VERSION 5: Reload complete, granularity:', effectiveGranularity);
    }
  }

  // Enforce visible range based on selected period
  function enforceVisibleRange() {
    if (!chart || !candleSeries) return;
    
    try {
      const data = candleSeries.data();
      if (!data || data.length === 0) return;
      
      // Calculate the desired range based on the selected period
      const days = periodToDays[period] || 1/24;
      const periodSeconds = days * 86400;
      
      // Get the latest candle time
      const latestCandle = data[data.length - 1];
      const latestTime = latestCandle.time as number;
      
      // Calculate the start time based on the period
      const startTime = latestTime - periodSeconds;
      
      console.log('Enforcing visible range:', {
        period,
        periodDays: days,
        periodHours: days * 24,
        periodMinutes: days * 24 * 60,
        startTime: new Date(startTime * 1000).toISOString(),
        endTime: new Date((latestTime + 60) * 1000).toISOString(),
        totalCandles: data.length,
        visibleCandles: Math.ceil(periodSeconds / 60) // For 1m granularity
      });
      
      // Force the chart to show the exact period
      chart.timeScale().setVisibleRange({
        from: startTime as Time,
        to: (latestTime + 60) as Time // Small buffer for the last candle
      });
      
      // For 1m granularity, log what we're showing
      if (effectiveGranularity === '1m') {
        console.log(`Chart: Showing last ${Math.ceil(periodSeconds / 60)} candles out of ${data.length} total for ${period} view`);
      }
      
      // Double-check and force again if needed
      const actualRange = chart.timeScale().getVisibleRange();
      if (actualRange) {
        const actualSeconds = Number(actualRange.to) - Number(actualRange.from);
        const expectedSeconds = periodSeconds + 60; // Including buffer
        
        if (Math.abs(actualSeconds - expectedSeconds) > 120) {
          console.log('Range still incorrect, forcing again...');
          chart.timeScale().setVisibleRange({
            from: startTime as Time,
            to: (latestTime + 60) as Time
          });
        }
      }
    } catch (e) {
      console.error('Error enforcing visible range:', e);
    }
  }

  // Update visible candle count
  function updateVisibleCandleCount(fromTime: number, toTime: number) {
    if (!dataFeed) {
      visibleCandleCount = 0;
      return;
    }
    
    // VERSION 5: Protect against invalid ranges
    if (!fromTime || !toTime || fromTime >= toTime || isNaN(fromTime) || isNaN(toTime)) {
      console.debug('VERSION 5: Invalid time range for visible candle count');
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
    
    // console.log('Visible candle count:', {
    //   period,
    //   granularity: effectiveGranularity,
    //   visibleCount: visibleCandleCount,
    //   expected: expected || 'calculated',
    //   range: `${(range / 60).toFixed(1)} minutes`
    // });
  }
  
  // Update trade markers on the chart
  function updateTradeMarkers() {
    if (!candleSeries || !trades) {
      return;
    }
    
    // console.log('Chart: Updating trade markers', trades.length);
    
    if (trades.length === 0) {
      candleSeries.setMarkers([]);
      return;
    }
    
    // Create markers for trades
    const markers = trades.map((trade, index) => {
      // Ensure timestamp is an integer
      const timestamp = Math.floor(trade.timestamp);
      
      const marker = {
        time: timestamp as Time,
        position: trade.type === 'buy' ? 'belowBar' : 'aboveBar',
        color: trade.type === 'buy' ? '#26a69a' : '#ef5350',
        shape: trade.type === 'buy' ? 'arrowUp' : 'arrowDown',
        size: 2,
        text: `${(trade.type || 'TRADE').toUpperCase()} @ $${(trade.price || 0).toLocaleString()}`
      };
      
      console.log(`Chart: Trade ${index} marker:`, {
        time: marker.time,
        timestamp: new Date(marker.time * 1000).toISOString(),
        type: trade.type,
        price: trade.price
      });
      
      return marker;
    });
    
    console.log('Chart: Setting markers:', markers);
    
    try {
      candleSeries.setMarkers(markers);
      console.log('Chart: Markers set successfully');
    } catch (error) {
      console.error('Chart: Error setting markers:', error);
    }
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
    // Use paper test time if paper test is running
    const now = isPaperTestRunning && paperTestSimTime ? paperTestSimTime : new Date();
    const nowSeconds = Math.floor(now.getTime() / 1000);
    
    // Format current time
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const seconds = now.getSeconds().toString().padStart(2, '0');
    currentTime = `${hours}:${minutes}:${seconds}`;
    
    // Only show countdown for live trading, not paper test
    if (!isPaperTestRunning) {
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
    } else {
      // During paper test, show simulation info
      countdown = 'Simulation';
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
      // errorMessage = 'Failed to clear cache: ' + (error as Error).message;
    }
  }

  onDestroy(() => {
    // Reset initial data loaded flag
    initialDataLoaded = false;
    pendingCandles = [];
    
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
    if (resizeObserver) {
      resizeObserver.disconnect();
    }
    // if (redisUnsubscribe) {
    //   redisUnsubscribe();
    // }
    if (dataFeed) {
      dataFeed.unsubscribe(instanceId);
      dataFeed.clearActiveInstance();
      console.log(`Chart: Instance ${instanceId} cleaned up`);
      // Don't disconnect - singleton persists across navigation
      // dataFeed.disconnect();
    }
    if (chart) {
      chart.remove();
    }
  });
</script>

<div class="chart-container" bind:this={chartContainer}>
  
  <!-- Debug: Candle count display hidden
  <div class="candle-count">
    {visibleCandleCount} / {totalCandleCount} candles
  </div>
  -->
  
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
</style>