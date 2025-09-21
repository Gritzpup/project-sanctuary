<script lang="ts">
  import { onMount, onDestroy, getContext } from 'svelte';
  import { dataStore } from '../../stores/dataStore.svelte';
  import { chartStore } from '../../stores/chartStore.svelte';
  import { performanceStore } from '../../stores/performanceStore.svelte';
  import { statusStore } from '../../stores/statusStore.svelte';
  
  // Get chart context to access chart instance directly
  const chartContext = getContext('chart');
  
  // Props using Svelte 5 runes syntax
  const {
    position = 'bottom-left',
    showCandleCount = true,
    showTimeRange = true,
    showClock = true,
    showPerformance = false,
    showLatestPrice = true,
    showLatestCandleTime = true,
    showCandleCountdown = true,
  }: {
    position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
    showCandleCount?: boolean;
    showTimeRange?: boolean;
    showClock?: boolean;
    showPerformance?: boolean;
    showLatestPrice?: boolean;
    showLatestCandleTime?: boolean;
    showCandleCountdown?: boolean;
  } = $props();
  
  let currentTime = $state(new Date());
  let clockInterval: NodeJS.Timeout;
  let countdownInterval: NodeJS.Timeout;
  let candleCountInterval: NodeJS.Timeout;
  let nextCandleTime = $state(0);
  let timeToNextCandle = $state(0);
  let previousPrice = $state<number | null>(null);
  let priceDirection = $state<'up' | 'down'>('up');
  let isWaitingForPrice = $state(true); // Start as waiting (blue)
  let priceFlashTimeout: NodeJS.Timeout;
  
  // Traffic light logic using $derived
  const actualWsStatus = $derived(getTrafficLightStatus());
  const trafficLightColor = $derived(getTrafficLightColor(actualWsStatus));
  
  // Create reactive variables that will trigger updates
  let reactiveCandles = $state(0);
  let reactivePrice = $state(null);
  let reactiveEmpty = $state(true);
  
  // Effect for debugging and updating reactive state
  $effect(() => {
    // Update reactive vars to force re-render
    reactiveCandles = dataStore.stats.totalCount;
    reactivePrice = dataStore.latestPrice;
    reactiveEmpty = dataStore.isEmpty;
  });
  
  // Traffic light status function - waiting vs direction based
  function getTrafficLightStatus(): 'green' | 'red' | 'blue' {
    // Check if we have data
    const candleCount = getActualCandleCount();
    const hasDataStoreCandles = dataStore.stats.totalCount > 0;
    const hasPrice = dataStore.latestPrice && dataStore.latestPrice > 0;
    
    // If no data at all, show blue (waiting)
    if (!(candleCount > 0 || hasDataStoreCandles || hasPrice || !dataStore.isEmpty)) {
      console.log('🔵 BLUE - No data, waiting');
      return 'blue';
    }
    
    // If waiting for next price update, show blue
    if (isWaitingForPrice) {
      console.log('🔵 BLUE - Waiting for next price update');
      return 'blue';
    }
    
    // Show color based on last price direction when we just got an update
    if (priceDirection === 'up') {
      console.log('🟢 GREEN - Price went up');
      return 'green';
    } else {
      console.log('🔴 RED - Price went down');
      return 'red';
    }
  }
  
  // Get traffic light color
  function getTrafficLightColor(status: 'green' | 'red' | 'blue'): string {
    switch (status) {
      case 'green': return '#4caf50'; // Green - price went up
      case 'red': return '#f44336';   // Red - price went down
      case 'blue': return '#2196f3';  // Blue - waiting for next update
      default: return '#2196f3';
    }
  }

  onMount(() => {
    console.log('🔥🔥🔥 [ChartInfo] Component mounted at', new Date().toISOString(), 'VERSION 7.0 - BLUE WAITING TRAFFIC LIGHT 🔥🔥🔥');
    console.log('[ChartInfo] Initial candle count:', getActualCandleCount());
    
    // IMMEDIATE status force - don't wait
    import('../../stores/statusStore.svelte').then(({ statusStore }) => {
      console.log('🚨 IMMEDIATE STATUS FORCE - Setting to ready NOW');
      statusStore.forceReady();
    });
    
    // Force status to ready after 5 seconds if still loading
    setTimeout(() => {
      import('../../stores/statusStore.svelte').then(({ statusStore }) => {
        if (statusStore.status === 'initializing' || statusStore.status === 'loading') {
          console.log('[ChartInfo] FORCING STATUS TO READY - Override stuck loading');
          statusStore.forceReady();
        }
      });
    }, 5000);
    
    if (showClock) {
      clockInterval = setInterval(() => {
        currentTime = new Date();
      }, 1000);
    }
    
    if (showCandleCountdown) {
      // Update countdown more frequently for smoother display
      countdownInterval = setInterval(() => {
        updateCandleCountdown();
      }, 500); // Update every 500ms for smoother countdown
    }
    
    // Update candle count periodically to catch changes
    candleCountInterval = setInterval(() => {
      actualCandleCount = getActualCandleCount();
    }, 2000);
    
    // Start in waiting state (blue) until first price update
    isWaitingForPrice = true;
  });
  
  onDestroy(() => {
    if (clockInterval) {
      clearInterval(clockInterval);
    }
    if (countdownInterval) {
      clearInterval(countdownInterval);
    }
    if (candleCountInterval) {
      clearInterval(candleCountInterval);
    }
    if (priceFlashTimeout) {
      clearTimeout(priceFlashTimeout);
    }
  });
  
  // Format time range
  const timeRange = $derived(dataStore.stats.oldestTime && dataStore.stats.newestTime ? {
    from: new Date(dataStore.stats.oldestTime * 1000).toLocaleString(),
    to: new Date(dataStore.stats.newestTime * 1000).toLocaleString()
  } : null);
  
  // Format clock with seconds for precise timing
  const clockDisplay = $derived(currentTime.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }));
  const dateDisplay = $derived(currentTime.toLocaleDateString());
  
  // Position classes
  const positionClass = $derived(`position-${position}`);
  
  function formatPrice(price: number | null): string {
    if (price === null) return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(price);
  }
  
  function formatNumber(num: number): string {
    return new Intl.NumberFormat('en-US').format(num);
  }
  
  function formatCandleTime(timestamp: number): string {
    const date = new Date(timestamp * 1000);
    return date.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  }
  
  // Get the latest candle time
  const latestCandleTime = $derived(dataStore.stats.newestTime ? 
    formatCandleTime(dataStore.stats.newestTime) : null);
    
  function updateCandleCountdown() {
    // Use precise millisecond timing for accuracy
    const nowMs = Date.now();
    const now = Math.floor(nowMs / 1000);
    const granularity = chartStore.config.granularity;
    
    // Calculate granularity in seconds
    const granularitySeconds = getGranularitySeconds(granularity);
    
    // For precise timing, we need to consider that candles are created at exact intervals
    // For example, 1m candles are created at :00, :01, :02 seconds of each minute
    if (granularity === '1m') {
      // 1-minute candles start at the top of each minute (xx:xx:00)
      const currentMinute = Math.floor(now / 60);
      nextCandleTime = (currentMinute + 1) * 60;
    } else if (granularity === '5m') {
      // 5-minute candles start at :00, :05, :10, etc.
      const current5Min = Math.floor(now / 300);
      nextCandleTime = (current5Min + 1) * 300;
    } else if (granularity === '1h') {
      // 1-hour candles start at the top of each hour
      const currentHour = Math.floor(now / 3600);
      nextCandleTime = (currentHour + 1) * 3600;
    } else {
      // Generic calculation for other timeframes
      nextCandleTime = Math.ceil(now / granularitySeconds) * granularitySeconds;
    }
    
    // Calculate time to next candle with sub-second precision
    const remainingMs = (nextCandleTime * 1000) - nowMs;
    timeToNextCandle = Math.ceil(remainingMs / 1000);
    
    // Ensure we don't go negative
    if (timeToNextCandle <= 0) {
      timeToNextCandle = granularitySeconds;
    }
    
    // Debug timing (only for 1m to avoid spam)
    if (granularity === '1m' && timeToNextCandle <= 5) {
      console.log(`[ChartInfo] Next candle in ${timeToNextCandle}s (current: ${new Date(nowMs).toISOString().substr(17, 5)})`);
    }
  }
  
  function getGranularitySeconds(granularity: string): number {
    const map: Record<string, number> = {
      '1m': 60,
      '5m': 300,
      '15m': 900,
      '30m': 1800,
      '1h': 3600,
      '4h': 14400,
      '1d': 86400
    };
    return map[granularity] || 60;
  }
  
  function formatCountdown(seconds: number): string {
    if (seconds <= 0) return '0s';
    return `${seconds}s`;
  }
  
  // Get actual candle count from chart or dataStore
  function getActualCandleCount(): number {
    // First try dataStore
    if (dataStore.stats.totalCount > 0) {
      return dataStore.stats.totalCount;
    }
    
    // Fallback: try to get from chart series directly
    try {
      const series = chartContext?.getSeries?.();
      if (series) {
        const seriesData = series.data();
        if (seriesData && seriesData.length > 0) {
          console.log('[ChartInfo] Got candle count from chart series:', seriesData.length);
          return seriesData.length;
        }
      }
    } catch (error) {
      console.warn('[ChartInfo] Could not get candle count from chart:', error);
    }
    
    // Last resort: return 0
    return 0;
  }
  
  // Reactive candle count - update when dataStore changes or when chart data might change
  let actualCandleCount = $state(0);
  $effect(() => {
    // Force update when dataStore stats change
    dataStore.stats.totalCount;
    dataStore.stats.lastUpdate;
    actualCandleCount = getActualCandleCount();
  });
  
  // Watch for new candles to sync countdown
  let lastCandleCount = $state(0);
  $effect(() => {
    if (actualCandleCount > lastCandleCount && lastCandleCount > 0) {
      console.log('[ChartInfo] New candle detected! Resetting countdown.');
      // Reset countdown when new candle is created
      updateCandleCountdown();
    }
    lastCandleCount = actualCandleCount;
  });
  
  // Track price changes for direction - react to WebSocket updates
  $effect(() => {
    // Only react to the lastUpdate timestamp to avoid interfering with price flow
    const lastUpdate = dataStore.stats.lastUpdate;
    const currentPrice = dataStore.latestPrice;
    
    // Only process when we get a genuine WebSocket update (lastUpdate changes)
    if (lastUpdate && currentPrice !== null) {
      if (previousPrice !== null && currentPrice !== previousPrice) {
        // Clear any existing timeout
        if (priceFlashTimeout) {
          clearTimeout(priceFlashTimeout);
        }
        
        // React to any price change, even tiny ones (penny changes)
        const priceDiff = currentPrice - previousPrice;
        
        console.log('💰 Price change detected:', priceDiff, 'from', previousPrice, 'to', currentPrice);
        
        if (priceDiff !== 0) {
          // Any price change triggers the traffic light
          isWaitingForPrice = false;
          priceDirection = priceDiff > 0 ? 'up' : 'down';
          
          console.log('🚦 Traffic light:', priceDirection === 'up' ? '🟢 GREEN (UP)' : '🔴 RED (DOWN)');
          
          // Show direction color for 0.5 seconds, then go back to waiting (blue)
          priceFlashTimeout = setTimeout(() => {
            isWaitingForPrice = true;
            console.log('🔵 Back to BLUE (waiting)');
          }, 500);
        }
        
        // Update previous price only after processing
        previousPrice = currentPrice;
      } else if (previousPrice === null) {
        // First price
        previousPrice = currentPrice;
        isWaitingForPrice = true;
      }
    }
  });
</script>

<div class="chart-info {positionClass}">
  
  {#if showLatestCandleTime && latestCandleTime}
    <div class="info-item candle-time">
      <span class="info-label">Latest Candle:</span>
      <span class="info-value">{latestCandleTime}</span>
    </div>
  {/if}
  
  {#if showCandleCount}
    <div class="info-item">
      <span class="info-label">Candles:</span>
      <span class="info-value">
        {formatNumber(actualCandleCount)}
      </span>
      <!-- Traffic light WebSocket status -->
      <span class="status-light" style="background-color: {trafficLightColor}; margin-left: 8px;" title="WebSocket Status: {actualWsStatus}" data-status="{actualWsStatus}"></span>
    </div>
  {/if}
  
  {#if showCandleCountdown}
    <div class="info-item countdown-item" class:urgent-container={timeToNextCandle <= 5}>
      <span class="info-label">Next {chartStore.config.granularity}:</span>
      <span class="info-value countdown-value" class:urgent={timeToNextCandle <= 5} class:very-urgent={timeToNextCandle <= 2}>
        {formatCountdown(timeToNextCandle)}
      </span>
    </div>
  {/if}
  
  {#if showTimeRange && timeRange}
    <div class="info-item time-range">
      <span class="info-label">Range:</span>
      <span class="info-value small">
        {timeRange.from} - {timeRange.to}
      </span>
    </div>
  {/if}
  
  {#if showClock}
    <div class="info-item clock">
      <span class="info-value time">{clockDisplay}</span>
      <span class="info-value date">{dateDisplay}</span>
    </div>
  {/if}
  
  {#if showPerformance && performanceStore.isMonitoring}
    <div class="info-item performance">
      <span class="info-label">FPS:</span>
      <span class="info-value" class:good={performanceStore.stats.fps >= 45} class:poor={performanceStore.stats.fps < 30}>
        {performanceStore.stats.fps}
      </span>
      {#if performanceStore.stats.cacheHitRate > 0}
        <span class="info-label">Cache:</span>
        <span class="info-value">{performanceStore.stats.cacheHitRate}%</span>
      {/if}
    </div>
  {/if}
</div>

<style>
  .chart-info {
    position: absolute;
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
    padding: 10px 15px;
    background: rgba(0, 0, 0, 0.75);
    backdrop-filter: blur(10px);
    border-radius: 8px;
    font-size: 12px;
    color: white;
    max-width: 90%;
    z-index: 5;
  }
  
  .position-top-left {
    top: 10px;
    left: 10px;
  }
  
  .position-top-right {
    top: 10px;
    right: 10px;
  }
  
  .position-bottom-left {
    bottom: 10px;
    left: 10px;
  }
  
  .position-bottom-right {
    bottom: 10px;
    right: 10px;
  }
  
  .info-item {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  
  .info-label {
    color: rgba(255, 255, 255, 0.7);
    font-weight: 500;
  }
  
  .info-value {
    color: white;
    font-weight: 600;
  }
  
  .info-value.small {
    font-size: 11px;
  }
  
  /* Price display */
  .price-item {
    position: relative;
  }
  
  .price-value {
    font-size: 14px;
    color: #4caf50;
    transition: all 0.3s ease;
  }
  
  .price-item.new-candle .price-value {
    animation: priceFlash 1s ease;
  }
  
  @keyframes priceFlash {
    0%, 100% { 
      color: #4caf50;
      transform: scale(1);
    }
    50% { 
      color: #8bc34a;
      transform: scale(1.1);
    }
  }
  
  /* Time range */
  .time-range {
    flex-basis: 100%;
  }
  
  /* Candle time */
  .candle-time {
    flex-basis: 100%;
  }
  
  .candle-time .info-value {
    color: #2196f3;
    font-family: monospace;
    font-size: 11px;
  }
  
  /* Countdown timer */
  .countdown-item {
    background: rgba(33, 150, 243, 0.1);
    padding: 6px 10px;
    border-radius: 6px;
    border: 1px solid rgba(33, 150, 243, 0.3);
  }
  
  .countdown-value {
    font-family: monospace;
    font-size: 14px;
    font-weight: 700;
    color: #2196f3;
    transition: color 0.3s ease;
  }
  
  .countdown-item.urgent-container {
    border-color: rgba(255, 87, 34, 0.6);
    background: rgba(255, 87, 34, 0.15);
  }
  
  .countdown-value.urgent {
    color: #ff5722;
    animation: urgentPulse 1s ease-in-out infinite;
  }
  
  .countdown-value.very-urgent {
    color: #f44336;
    font-size: 16px;
    animation: veryUrgentPulse 0.5s ease-in-out infinite;
  }
  
  @keyframes urgentPulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.7; }
  }
  
  @keyframes veryUrgentPulse {
    0%, 100% { 
      opacity: 1; 
      transform: scale(1);
    }
    50% { 
      opacity: 0.8; 
      transform: scale(1.1);
    }
  }
  
  /* Clock */
  .clock {
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
    margin-left: auto;
  }
  
  .time {
    font-size: 14px;
    font-weight: 700;
  }
  
  .date {
    font-size: 10px;
    color: rgba(255, 255, 255, 0.7);
  }
  
  /* Performance */
  .performance .info-value.good {
    color: #4caf50;
  }
  
  .performance .info-value.poor {
    color: #f44336;
  }
  
  /* WebSocket Status Light */
  .status-light {
    display: inline-block;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    transition: all 0.3s ease;
    box-shadow: 0 0 0 0 currentColor;
  }
  
  /* Green price up animation */
  .status-light[data-status="green"] {
    animation: greenPulse 0.5s ease;
    box-shadow: 0 0 6px 3px rgba(76, 175, 80, 0.8);
  }
  
  /* Red price down animation */
  .status-light[data-status="red"] {
    animation: redPulse 0.5s ease;
    box-shadow: 0 0 6px 3px rgba(244, 67, 54, 0.8);
  }
  
  /* Blue waiting animation - continuous pulse */
  .status-light[data-status="blue"] {
    animation: bluePulse 1.5s ease-in-out infinite;
    transform: scale(1);
  }
  
  @keyframes greenPulse {
    0% {
      transform: scale(1);
      box-shadow: 0 0 3px 1px rgba(76, 175, 80, 0.6);
    }
    50% {
      transform: scale(1.4);
      box-shadow: 0 0 10px 5px rgba(76, 175, 80, 1);
    }
    100% {
      transform: scale(1);
      box-shadow: 0 0 6px 3px rgba(76, 175, 80, 0.8);
    }
  }
  
  @keyframes redPulse {
    0% {
      transform: scale(1);
      box-shadow: 0 0 3px 1px rgba(244, 67, 54, 0.6);
    }
    50% {
      transform: scale(1.4);
      box-shadow: 0 0 10px 5px rgba(244, 67, 54, 1);
    }
    100% {
      transform: scale(1);
      box-shadow: 0 0 6px 3px rgba(244, 67, 54, 0.8);
    }
  }
  
  @keyframes bluePulse {
    0% {
      transform: scale(1);
      box-shadow: 0 0 0 0 rgba(33, 150, 243, 0.8);
      opacity: 1;
    }
    50% {
      transform: scale(1.2);
      box-shadow: 0 0 6px 3px rgba(33, 150, 243, 0.4);
      opacity: 0.8;
    }
    100% {
      transform: scale(1);
      box-shadow: 0 0 0 0 rgba(33, 150, 243, 0);
      opacity: 1;
    }
  }
  
  /* Dark theme adjustments */
  :global(.light) .chart-info {
    background: rgba(255, 255, 255, 0.95);
    color: #333;
  }
  
  :global(.light) .info-label {
    color: #666;
  }
  
  :global(.light) .info-value {
    color: #333;
  }
  
  :global(.light) .date {
    color: #666;
  }
  
  /* Responsive */
  @media (max-width: 768px) {
    .chart-info {
      font-size: 11px;
      padding: 8px 12px;
      gap: 12px;
    }
    
    .price-value {
      font-size: 13px;
    }
    
    .time {
      font-size: 13px;
    }
    
    .time-range {
      display: none;
    }
  }
</style>