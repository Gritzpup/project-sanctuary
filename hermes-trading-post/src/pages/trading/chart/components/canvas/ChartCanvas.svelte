<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { createChart, type IChartApi, type ISeriesApi, type Time } from 'lightweight-charts';
  import { chartStore } from '../../stores/chartStore.svelte';
  import { dataStore } from '../../stores/dataStore.svelte';
  import { statusStore } from '../../stores/statusStore.svelte';
  import { performanceStore } from '../../stores/performanceStore.svelte';
  import { CHART_COLORS } from '../../utils/constants';
  
  export let width: number | undefined = undefined;
  export let height: number | undefined = undefined;
  export let onChartReady: ((chart: IChartApi) => void) | undefined = undefined;
  
  let container: HTMLDivElement;
  let chart: IChartApi | null = null;
  let candleSeries: ISeriesApi<'Candlestick'> | null = null;
  let volumeSeries: ISeriesApi<'Histogram'> | null = null;
  let resizeObserver: ResizeObserver | null = null;
  
  // Debug variables
  let initCalled: boolean = false;
  let containerExists: boolean = false;
  let chartCreated: boolean = false;
  let volumeCreated: boolean = false;
  
  // Reactive chart options based on store
  $: chartOptions = {
    layout: {
      background: { 
        color: CHART_COLORS[chartStore.config.theme.toUpperCase()].background 
      },
      textColor: CHART_COLORS[chartStore.config.theme.toUpperCase()].text,
    },
    grid: {
      vertLines: { 
        visible: chartStore.config.showGrid,
        color: CHART_COLORS[chartStore.config.theme.toUpperCase()].grid 
      },
      horzLines: { 
        visible: chartStore.config.showGrid,
        color: CHART_COLORS[chartStore.config.theme.toUpperCase()].grid 
      },
    },
    crosshair: {
      mode: chartStore.config.showCrosshair ? 1 : 0,
      vertLine: {
        width: 1,
        color: CHART_COLORS[chartStore.config.theme.toUpperCase()].text + '40',
        style: 2,
      },
      horzLine: {
        width: 1,
        color: CHART_COLORS[chartStore.config.theme.toUpperCase()].text + '40',
        style: 2,
      },
    },
    timeScale: {
      timeVisible: true,
      secondsVisible: false,
      borderColor: CHART_COLORS[chartStore.config.theme.toUpperCase()].border,
      fixLeftEdge: true,
      fixRightEdge: true,
      visible: true,
      // Try to hide the built-in timescale buttons
      borderVisible: true,
    },
    rightPriceScale: {
      borderColor: CHART_COLORS[chartStore.config.theme.toUpperCase()].border,
      autoScale: true,
    },
    watermark: {
      visible: false,
    },
    handleScroll: {
      mouseWheel: true,
      pressedMouseMove: true,
      horzTouchDrag: true,
      vertTouchDrag: false,
    },
    handleScale: {
      axisPressedMouseMove: true,
      mouseWheel: true,
      pinch: true,
    },
  };
  
  onMount(() => {
    initializeChart();
    
    return () => {
      cleanup();
    };
  });
  
  function initializeChart() {
    console.log('🚀 initializeChart() called');
    initCalled = true;
    document.title = '🚀 INIT CALLED';
    if (!container) {
      document.title = '❌ NO CONTAINER';
      return;
    }
    containerExists = true;
    console.log('🚀 Container exists, continuing with chart initialization');
    document.title = '🚀 CONTAINER OK';
    
    const startTime = performance.now();
    
    // Create chart
    chart = createChart(container, {
      ...chartOptions,
      width: width || container.clientWidth,
      height: height || container.clientHeight,
    });
    chartCreated = true;
    
    // Create candlestick series
    candleSeries = chart.addCandlestickSeries({
      upColor: CHART_COLORS[chartStore.config.theme.toUpperCase()].upColor,
      downColor: CHART_COLORS[chartStore.config.theme.toUpperCase()].downColor,
      borderVisible: false,
      wickUpColor: CHART_COLORS[chartStore.config.theme.toUpperCase()].upColor,
      wickDownColor: CHART_COLORS[chartStore.config.theme.toUpperCase()].downColor,
    });

    // Create volume histogram series
    console.log('📊 Creating volume histogram series...');
    document.title = '📊 CREATING VOLUME';
    try {
      volumeSeries = chart.addHistogramSeries({
        color: '#26a69a',
        priceFormat: {
          type: 'volume',
        },
        priceScaleId: 'volume',
        scaleMargins: {
          top: 0.8,
          bottom: 0,
        },
      });

      console.log('📊 Volume histogram series created successfully:', !!volumeSeries);
      volumeCreated = true;
      document.title = '✅ VOLUME CREATED';
      
      // Configure volume price scale  
      volumeSeries.priceScale().applyOptions({
        scaleMargins: {
          top: 0.8,
          bottom: 0,
        },
        visible: true,
        alignLabels: false,
        autoScale: true,
        borderVisible: false,
        entireTextOnly: false,
      });
      
      console.log('📊 Volume price scale configured');
      
      // Set volume data - wait for candle data and ensure alignment
      console.log('📊 Setting initial volume data...');
      setTimeout(() => {
        console.log('📊 Attempting to sync volume with candle data');
        console.log('📊 Current dataStore.candles length:', dataStore.candles?.length || 0);
        if (dataStore.candles && dataStore.candles.length > 0) {
          console.log('📊 Historical data available, loading volume bars');
          updateVolumeData();
        } else {
          console.log('📊 No historical data yet, will wait for reactive statement');
          // The reactive statement will handle it when data loads
        }
      }, 1500); // Wait even longer for data to load
    } catch (error) {
      console.error('📊 Error creating volume series:', error);
    }
    
    
    // Store chart instance
    chartStore.setChartInstance({
      api: chart,
      series: candleSeries,
      config: chartStore.config
    });
    
    // Set up resize observer
    if (!width || !height) {
      resizeObserver = new ResizeObserver((entries) => {
        if (chart && entries.length > 0) {
          const { width: newWidth, height: newHeight } = entries[0].contentRect;
          
          // Store current visible range before resize
          const currentRange = chart.timeScale().getVisibleRange();
          
          chart.applyOptions({ width: newWidth, height: newHeight });
          
          // After resize, ensure the current candle stays visible
          if (candleSeries && currentRange && dataStore.candles.length > 0) {
            const lastCandle = dataStore.candles[dataStore.candles.length - 1];
            const currentTime = lastCandle.time as number;
            
            // Check if current candle is still visible after resize
            const newRange = chart.timeScale().getVisibleRange();
            if (newRange && currentTime > Number(newRange.to)) {
              // Current candle is no longer visible, adjust the range
              const rangeSpan = Number(currentRange.to) - Number(currentRange.from);
              const buffer = rangeSpan * 0.1; // 10% buffer on the right
              
              chart.timeScale().setVisibleRange({
                from: (currentTime - rangeSpan + buffer) as Time,
                to: (currentTime + buffer) as Time
              });
            }
          }
        }
      });
      resizeObserver.observe(container);
    }
    
    // Subscribe to visible range changes
    chart.timeScale().subscribeVisibleTimeRangeChange(() => {
      const visibleRange = chart!.timeScale().getVisibleRange();
      if (visibleRange) {
        dataStore.updateVisibleRange(
          Number(visibleRange.from),
          Number(visibleRange.to)
        );
      }
    });
    
    // Subscribe to crosshair move
    chart.subscribeCrosshairMove((param) => {
      if (param.time && param.seriesData.size > 0) {
        // Could emit crosshair data if needed
      }
    });
    
    // Initial data render
    if (dataStore.candles.length > 0) {
      updateChartData();
    }
    
    // Record initialization time
    performanceStore.recordRenderTime(performance.now() - startTime);
    
    // Style the timescale buttons to match top controls - multiple attempts to catch them early
    styleTimescaleButtons(); // Try immediately
    setTimeout(() => styleTimescaleButtons(), 100); // Try after 100ms
    setTimeout(() => styleTimescaleButtons(), 500); // Try after 500ms
    setTimeout(() => styleTimescaleButtons(), 1000); // Try after 1s
    
    // Ensure current candle is visible after chart initialization
    setTimeout(() => {
      console.log('🔧 Auto-scrolling to current candle after init');
      scrollToCurrentCandle();
    }, 2000);
    
    // Notify that chart is ready
    if (onChartReady) {
      onChartReady(chart);
    }
  }
  
  function updateChartData() {
    console.log('updateChartData called', {
      candleSeries: !!candleSeries,
      isEmpty: dataStore.isEmpty,
      candleCount: dataStore.candles.length
    });
    
    if (!candleSeries) {
      console.warn('No candleSeries available');
      return;
    }
    
    if (dataStore.isEmpty) {
      console.warn('DataStore is empty');
      return;
    }
    
    const startTime = performance.now();
    
    try {
      console.log('Setting data to candleSeries:', dataStore.candles.length, 'candles');
      candleSeries.setData(dataStore.candles);
      
      // Also update volume data when chart data is updated
      if (volumeSeries) {
        console.log('📊 Also updating volume data with historical candles');
        updateVolumeData();
      } else {
        console.warn('📊 Volume series not available during updateChartData');
      }
      
      performanceStore.recordRenderTime(performance.now() - startTime);
      console.log('Chart data updated successfully');
    } catch (error) {
      console.error('ChartCanvas: Error updating data:', error);
      statusStore.setError('Failed to update chart data');
    }
  }
  
  function styleTimescaleButtons() {
    console.log('🔧 styleTimescaleButtons called, container:', !!container);
    if (!container) {
      console.warn('⚠️ No container found, cannot style buttons');
      return;
    }
    
    try {
      // Search more broadly - TradingView might create buttons outside our container
      const allButtons = document.querySelectorAll('button');
      const containerButtons = container.querySelectorAll('button');
      
      console.log('🔍 Found', containerButtons.length, 'buttons in chart container');
      console.log('🔍 Found', allButtons.length, 'buttons total on page');
      
      // Check all buttons on the page for timescale buttons
      const buttons = allButtons;
      
      buttons.forEach((button, index) => {
        const buttonText = button.textContent?.trim();
        const currentStyles = button.getAttribute('style');
        console.log(`Button ${index}: text="${buttonText}", styles="${currentStyles}"`);
        
        // Check if this looks like a timescale button (has text like "1H", "4H", etc.)
        if (buttonText && /^(1H|4H|5D|1M|3M|6M|1Y|5Y|1W)$/.test(buttonText)) {
          console.log('🎯 Found timescale button:', buttonText, 'Current style:', currentStyles);
          
          // Apply half-size styling to match top control buttons - use !important to override conflicting CSS
          button.style.setProperty('padding', '3px 5px', 'important');
          button.style.setProperty('fontSize', '10px', 'important');
          button.style.setProperty('fontWeight', '500', 'important');
          button.style.setProperty('borderRadius', '4px', 'important');
          button.style.setProperty('border', '1px solid rgba(74, 0, 224, 0.3)', 'important');
          button.style.setProperty('background', 'rgba(74, 0, 224, 0.2)', 'important');
          button.style.setProperty('color', '#9966ff', 'important');
          button.style.setProperty('minWidth', 'auto', 'important');
          button.style.setProperty('minHeight', 'auto', 'important');
          button.style.setProperty('height', 'auto', 'important');
          button.style.setProperty('lineHeight', '1', 'important');
          button.style.setProperty('transition', 'all 0.2s ease', 'important');
          button.style.setProperty('cursor', 'pointer', 'important');
          button.style.setProperty('boxSizing', 'border-box', 'important');
          button.style.setProperty('margin', '1px', 'important');
          
          // Dark theme support
          const isDark = chartStore.config.theme.toLowerCase() === 'dark';
          if (isDark) {
            button.style.background = '#2a2a2a';
            button.style.color = '#e0e0e0';
            button.style.borderColor = '#444';
          }
          
          // Add hover effect
          button.addEventListener('mouseenter', () => {
            button.style.background = isDark ? '#3a3a3a' : '#f5f5f5';
            button.style.borderColor = isDark ? '#666' : '#bbb';
          });
          
          button.addEventListener('mouseleave', () => {
            button.style.background = isDark ? '#2a2a2a' : 'white';
            button.style.borderColor = isDark ? '#444' : '#ddd';
          });
        }
      });
    } catch (error) {
      console.error('Error styling timescale buttons:', error);
    }
  }

  function cleanup() {
    if (resizeObserver) {
      resizeObserver.disconnect();
      resizeObserver = null;
    }
    
    if (chart) {
      chart.remove();
      chart = null;
    }
    
    candleSeries = null;
    volumeSeries = null;
  }
  
  // Handle real-time updates
  function handleRealtimeUpdate(candle: any) {
    if (!candleSeries) return;
    
    const startTime = performance.now();
    
    try {
      candleSeries.update(candle);
      performanceStore.recordRenderTime(performance.now() - startTime);
      performanceStore.recordCandleUpdate();
    } catch (error) {
      console.error('ChartCanvas: Error updating candle:', error);
    }
  }
  
  // Reactive updates
  $: if (chart && chartOptions) {
    chart.applyOptions(chartOptions);
  }
  
  $: if (candleSeries && chartStore.config) {
    const colors = CHART_COLORS[chartStore.config.theme.toUpperCase()];
    candleSeries.applyOptions({
      upColor: colors.upColor,
      downColor: colors.downColor,
      wickUpColor: colors.upColor,
      wickDownColor: colors.downColor,
    });
  }
  
  // Public API methods
  export function getChart(): IChartApi | null {
    return chart;
  }

  export function getSeries(): ISeriesApi<'Candlestick'> | null {
    return candleSeries;
  }

  export function getVolumeSeries(): ISeriesApi<'Histogram'> | null {
    return volumeSeries;
  }

  export function getAllSeries() {
    return {
      candleSeries,
      volumeSeries
    };
  }

  export function setVisibleRange(from: number, to: number) {
    if (chart && candleSeries) {
      try {
        // Only set visible range if we have data
        const seriesData = candleSeries.data();
        if (seriesData && seriesData.length > 0) {
          chart.timeScale().setVisibleRange({ from: from as Time, to: to as Time });
        } else {
          console.log('ChartCanvas: Skipping setVisibleRange - no series data available yet');
        }
      } catch (error) {
        console.error('Error setting visible range:', error);
        // Fall back to fitContent if setVisibleRange fails
        try {
          chart.timeScale().fitContent();
        } catch (fitError) {
          console.error('Error fitting content:', fitError);
        }
      }
    }
  }

  export function fitContent() {
    if (chart) {
      chart.timeScale().fitContent();
    }
  }

  // Data updates - watch for changes in candle data and last update time
  $: {
    const candleCount = dataStore.candles?.length || 0;
    const lastUpdate = dataStore.stats?.lastUpdate; // This changes on real-time updates
    console.log('Reactive statement triggered:', {
      candleSeries: !!candleSeries,
      volumeSeries: !!volumeSeries,
      candleCount: candleCount,
      hasCandles: candleCount > 0,
      isEmpty: dataStore.isEmpty,
      lastUpdate: lastUpdate
    });
    
    // Always update if we have candles and series, ignore isEmpty flag
    if (candleSeries && candleCount > 0) {
      console.log('Triggering updateChartData due to reactive change');
      updateChartData();
    }
    
    // Always update volume if we have volume series and candles
    if (volumeSeries && candleCount > 0) {
      console.log('📊 Updating volume data from reactive statement');
      updateVolumeData();
    }
  }
  
  
  function updateVolumeData() {
    if (!volumeSeries) {
      console.warn('📊 Cannot update volume: volume series not available');
      return;
    }
    
    if (!dataStore.candles || dataStore.candles.length === 0) {
      console.warn('📊 Cannot update volume: no candle data available');
      return;
    }
    
    console.log('📊 ✅ updateVolumeData called with', dataStore.candles.length, 'candles');
    console.log('📊 First candle time:', dataStore.candles[0]?.time, 'Last candle time:', dataStore.candles[dataStore.candles.length - 1]?.time);
    
    // Use REAL volume data from Coinbase API
    const volumeData = dataStore.candles.map((candle, index) => {
      const isUp = candle.close >= candle.open;
      
      // Use the actual volume from the API
      const volume = candle.volume || 0;
      
      if (index < 5) {
        console.log(`📊 Candle ${index}: time=${candle.time}, volume=${volume} (real data from API)`);
      }
      
      return {
        time: candle.time, // EXACT same time as candle
        value: volume,     // Use REAL volume from Coinbase API
        color: isUp ? '#26a69a80' : '#ef535080'
      };
    });
    
    try {
      volumeSeries.setData(volumeData);
      console.log('📊 Volume data updated successfully:', volumeData.length, 'bars');
      console.log('📊 Volume time range:', volumeData[0]?.time, 'to', volumeData[volumeData.length - 1]?.time);
    } catch (error) {
      console.error('📊 Error updating volume data:', error);
    }
  }
  
  // Export function to update volume for real-time data
  export function updateVolumeForCandle(candle: any) {
    if (!volumeSeries) {
      console.warn('📊 Volume series not available for single candle update');
      return;
    }
    
    console.log('📊 Updating volume for single candle at', candle.time);
    
    const isUp = candle.close >= candle.open;
    const priceRange = Math.abs(candle.high - candle.low);
    const volume = Math.floor(priceRange * 5000000 + 2000000 + Math.random() * 1000000);
    
    const volumeBar = {
      time: candle.time,
      value: volume,
      color: isUp ? '#26a69a80' : '#ef535080'
    };
    
    try {
      volumeSeries.update(volumeBar);
      console.log('📊 Single volume bar updated successfully');
    } catch (error) {
      console.error('📊 Error updating single volume bar:', error);
    }
  }

  export function showAllCandles() {
    console.log('showAllCandles called', {
      chart: !!chart,
      candleSeries: !!candleSeries,
      candleCount: dataStore.candles.length
    });
    
    if (!chart || !candleSeries || dataStore.candles.length === 0) {
      console.warn('Cannot show candles - missing chart, series, or data');
      return;
    }
    
    const firstCandle = dataStore.candles[0];
    const lastCandle = dataStore.candles[dataStore.candles.length - 1];
    
    if (!firstCandle || !lastCandle || !firstCandle.time || !lastCandle.time) {
      console.warn('Invalid candle data');
      return;
    }
    
    // Add small buffer to ensure all candles are visible
    const buffer = (lastCandle.time as number - firstCandle.time as number) * 0.05;
    
    try {
      chart.timeScale().setVisibleRange({
        from: (firstCandle.time as number) - buffer,
        to: (lastCandle.time as number) + buffer
      });
      
      // Update visible range in dataStore
      dataStore.updateVisibleRange(
        (firstCandle.time as number) - buffer,
        (lastCandle.time as number) + buffer
      );
      
      console.log('Visible range set successfully');
    } catch (error) {
      console.error('Error setting visible range:', error);
    }
  }

  export function scrollToCurrentCandle() {
    console.log('scrollToCurrentCandle called', {
      chart: !!chart,
      candleSeries: !!candleSeries,
      candleCount: dataStore.candles.length
    });
    
    if (!chart || !candleSeries || dataStore.candles.length === 0) {
      console.warn('Cannot scroll to current candle - missing chart, series, or data');
      return;
    }
    
    const lastCandle = dataStore.candles[dataStore.candles.length - 1];
    if (!lastCandle || !lastCandle.time) {
      console.warn('Invalid current candle data');
      return;
    }
    
    try {
      // Always maintain exactly 60 candles visible
      const maxCandles = 60;
      const currentTime = lastCandle.time as number;
      
      // Get the last 60 candles to calculate proper time range
      const startIndex = Math.max(0, dataStore.candles.length - maxCandles);
      const visibleCandles = dataStore.candles.slice(startIndex);
      
      if (visibleCandles.length > 1) {
        const firstVisibleTime = visibleCandles[0].time as number;
        const timeSpan = currentTime - firstVisibleTime;
        const buffer = timeSpan * 0.05; // 5% buffer
        
        chart.timeScale().setVisibleRange({
          from: (firstVisibleTime - buffer) as Time,
          to: (currentTime + buffer) as Time
        });
        
        console.log(`Scrolled to show ${visibleCandles.length} candles (max ${maxCandles})`);
      } else {
        // Fallback to fit content if insufficient data
        chart.timeScale().fitContent();
      }
    } catch (error) {
      console.error('Error scrolling to current candle:', error);
    }
  }
  
  export function addMarkers(markers: any[]) {
    if (!candleSeries) {
      console.error('ChartCanvas: Cannot add markers - series not ready');
      return;
    }
    
    if (!markers || markers.length === 0) {
      console.log('ChartCanvas: Clearing all markers from chart');
      candleSeries.setMarkers([]);
      console.log('✅ ChartCanvas: All markers cleared from chart');
      return;
    }
    
    // Filter markers to only show those within the current 60-candle visible range
    const maxCandles = 60;
    const startIndex = Math.max(0, dataStore.candles.length - maxCandles);
    const visibleCandles = dataStore.candles.slice(startIndex);
    
    if (visibleCandles.length > 0) {
      const oldestVisibleTime = visibleCandles[0].time as number;
      const newestVisibleTime = visibleCandles[visibleCandles.length - 1].time as number;
      
      const filteredMarkers = markers.filter(marker => {
        const markerTime = marker.time as number;
        return markerTime >= oldestVisibleTime && markerTime <= newestVisibleTime;
      });
      
      console.log(`ChartCanvas: Filtered ${markers.length} markers to ${filteredMarkers.length} within visible range`);
      
      try {
        candleSeries.setMarkers(filteredMarkers);
        console.log('✅ ChartCanvas: Successfully added filtered markers to chart');
      } catch (error) {
        console.error('❌ ChartCanvas: Error setting markers:', error);
      }
    } else {
      console.log('ChartCanvas: No visible candles, clearing all markers');
      candleSeries.setMarkers([]);
    }
  }
  
  export function clearMarkers() {
    if (!candleSeries) {
      console.error('ChartCanvas: Cannot clear markers - series not ready');
      return;
    }
    console.log('ChartCanvas: Clearing all markers from chart');
    candleSeries.setMarkers([]);
    console.log('✅ ChartCanvas: All markers cleared from chart');
  }
  
  export function addMarker(marker: any) {
    addMarkers([marker]);
  }
  
</script>

<div 
  bind:this={container} 
  class="chart-canvas"
  style:width={width ? `${width}px` : '100%'}
  style:height={height ? `${height}px` : '100%'}
/>


<style>
  .chart-canvas {
    position: relative;
    overflow: hidden;
  }
  
  .debug-info {
    position: absolute;
    top: 10px;
    right: 10px;
    background: rgba(0, 0, 0, 0.8);
    color: white;
    padding: 5px 10px;
    border-radius: 4px;
    font-size: 12px;
    font-family: monospace;
    z-index: 1000;
  }
</style>