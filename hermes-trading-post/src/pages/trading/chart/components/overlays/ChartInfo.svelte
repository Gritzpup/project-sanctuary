<script lang="ts">
  import { onMount, onDestroy, getContext } from 'svelte';
  import { dataStore } from '../../stores/dataStore.svelte';
  import { chartStore } from '../../stores/chartStore.svelte';
  import { performanceStore } from '../../stores/performanceStore.svelte';
  import { statusStore } from '../../stores/statusStore.svelte';
  import { getGranularitySeconds } from '../../utils/granularityHelpers';
  import { formatPrice, formatNumber } from '../../../../../utils/formatters/priceFormatters';
  import { formatCandleTime, getCurrentTimestamp } from '../../utils/timeHelpers';
  import TrafficLight from '../indicators/TrafficLight.svelte';
  import CandleCounter from '../indicators/CandleCounter.svelte';
  import CandleCountdown from '../indicators/CandleCountdown.svelte';
  
  // Get chart context to access chart instance directly (optional when used outside chart)
  const chartContext = getContext('chart') || null;
  
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
    showTotalPnL = false,
    showTradesCount = false,
    tradingStatus = null,
    tradingData = null,
  }: {
    position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'footer';
    showCandleCount?: boolean;
    showTimeRange?: boolean;
    showClock?: boolean;
    showPerformance?: boolean;
    showLatestPrice?: boolean;
    showLatestCandleTime?: boolean;
    showCandleCountdown?: boolean;
    showTotalPnL?: boolean;
    showTradesCount?: boolean;
    tradingStatus?: { isRunning: boolean; isPaused: boolean } | null;
    tradingData?: { totalReturn?: number; trades?: any[] } | null;
  } = $props();
  
  let currentTime = $state(new Date());
  let clockInterval: NodeJS.Timeout;
  
  
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
  

  onMount(() => {
    
    // IMMEDIATE status force - don't wait
    import('../../stores/statusStore.svelte').then(({ statusStore }) => {
      statusStore.forceReady();
    });
    
    // Force status to ready after 5 seconds if still loading
    setTimeout(() => {
      import('../../stores/statusStore.svelte').then(({ statusStore }) => {
        if (statusStore.status === 'initializing' || statusStore.status === 'loading') {
          statusStore.forceReady();
        }
      });
    }, 5000);
    
    if (showClock) {
      clockInterval = setInterval(() => {
        currentTime = new Date();
      }, 1000);
    }
    
    
    // Update candle count periodically to catch changes
    
  });
  
  onDestroy(() => {
    if (clockInterval) {
      clearInterval(clockInterval);
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
  
  
  
  // Get the latest candle time
  const latestCandleTime = $derived(dataStore.stats.newestTime ? 
    formatCandleTime(dataStore.stats.newestTime) : null);
    
  
  
</script>

<div class="chart-info {positionClass}">
  
  <!-- Traffic lights for status indicators -->
  <div class="info-item">
    <!-- Database loading status traffic light -->
    <span class="mr-2" title="Database Activity: {statusStore.databaseActivity}">
      <span
        class="traffic-light-db size-medium"
        class:status-idle={statusStore.databaseActivity === 'idle'}
        class:status-fetching={statusStore.databaseActivity === 'fetching'}
        class:status-storing={statusStore.databaseActivity === 'storing'}
        class:status-error={statusStore.databaseActivity === 'error'}
        class:status-rate-limited={statusStore.databaseActivity === 'rate-limited'}
      ></span>
    </span>
    <!-- Price/WebSocket traffic light -->
    <span class="mr-4">
      <TrafficLight size="medium" flashDuration={500} tradingStatus={tradingStatus} />
    </span>
  </div>
  
  {#if showLatestCandleTime && latestCandleTime}
    <div class="info-item candle-time">
      <span class="info-label">Latest Candle:</span>
      <span class="info-value">{latestCandleTime}</span>
    </div>
  {/if}
  
  {#if showCandleCount}
    <div class="info-item">
      <span class="info-label">DB:</span>
      <span class="info-value">
        {formatNumber(dataStore.stats.totalDatabaseCount || dataStore.stats.totalCount)}
      </span>
      <span class="loading-status status-{dataStore.stats.loadingStatus}"></span>
    </div>
    <div class="info-item">
      <span class="info-label">Candles:</span>
      <span class="info-value">
        <CandleCounter updateInterval={2000} showAnimation={true} />
      </span>
    </div>
  {/if}
  
  {#if showCandleCountdown}
    <div class="info-item">
      <CandleCountdown updateInterval={500} showUrgentStyling={true} />
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
    </div>
  {/if}
  
  {#if showTotalPnL && tradingData?.totalReturn !== undefined}
    <div class="info-item total-pnl">
      <span class="info-label">Total P/L:</span>
      <span class="info-value" class:profit={tradingData.totalReturn > 0} class:loss={tradingData.totalReturn < 0}>
        ${tradingData.totalReturn.toFixed(2)}
      </span>
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
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
    font-size: 12px;
    color: white;
    z-index: 5;
  }
  
  /* Absolute positioning for overlay positions */
  .chart-info:not(.position-footer) {
    position: absolute;
    padding: 10px 15px;
    background: rgba(0, 0, 0, 0.75);
    backdrop-filter: blur(10px);
    border-radius: 8px;
    max-width: 90%;
  }
  
  /* Footer position uses flow layout */
  .position-footer {
    position: relative;
    width: 100%;
    padding: 0;
    background: transparent;
    justify-content: center;
    align-items: center;
    gap: 8px;
  }
  
  /* Footer specific styling for info items */
  .position-footer .info-item {
    margin: 0;
  }
  
  /* Clock positioning in footer */
  .position-footer .clock {
    margin-left: auto;
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
  
  /* Components now handle their own styling */
  
  /* Clock */
  .clock {
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
    margin-left: auto;
  }
  
  .time {
    font-size: 12px;
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
  
  /* Total P/L */
  .total-pnl .info-value.profit {
    color: #4caf50;
    font-weight: 600;
  }
  
  .total-pnl .info-value.loss {
    color: #f44336;
    font-weight: 600;
  }
  
  /* Loading Status Indicator */
  .loading-status {
    display: inline-block;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    margin-left: 6px;
    transition: all 0.3s ease;
  }
  
  .status-idle {
    background-color: #666;
  }
  
  .status-fetching {
    background-color: #ffa500;
    animation: pulse 1s infinite;
  }
  
  .status-storing {
    background-color: #4caf50;
    animation: pulse 0.8s infinite;
  }
  
  .status-error {
    background-color: #f44336;
    animation: pulse 1.5s infinite;
  }
  
  .status-rate-limited {
    background-color: #ff5722;
    animation: pulse 2s infinite;
  }
  
  @keyframes pulse {
    0%, 100% {
      opacity: 1;
      transform: scale(1);
    }
    50% {
      opacity: 0.5;
      transform: scale(1.2);
    }
  }

  /* Database Loading Traffic Light */
  .traffic-light-db {
    display: inline-block;
    border-radius: 50%;
    transition: all 0.3s ease;
    box-shadow: 0 0 4px rgba(0, 0, 0, 0.3);
    border: 2px solid rgba(255, 255, 255, 0.2);
  }

  .traffic-light-db.size-medium {
    width: 12px;
    height: 12px;
  }

  .traffic-light-db.status-idle {
    background-color: #666;
  }

  .traffic-light-db.status-fetching {
    background-color: #ffa500;
    animation: pulse-db 0.5s ease-in-out infinite;
    box-shadow: 0 0 12px rgba(255, 165, 0, 0.9);
  }

  .traffic-light-db.status-storing {
    background-color: #4caf50;
    animation: pulse-db 0.4s ease-in-out infinite;
    box-shadow: 0 0 12px rgba(76, 175, 80, 0.9);
  }

  .traffic-light-db.status-error {
    background-color: #f44336;
    animation: pulse-db 1.5s ease-in-out infinite;
    box-shadow: 0 0 8px rgba(244, 67, 54, 0.8);
  }

  .traffic-light-db.status-rate-limited {
    background-color: #ff5722;
    animation: pulse-db 2s ease-in-out infinite;
    box-shadow: 0 0 8px rgba(255, 87, 34, 0.8);
  }

  @keyframes pulse-db {
    0%, 100% {
      opacity: 1;
      transform: scale(1);
    }
    50% {
      opacity: 0.6;
      transform: scale(1.15);
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
      z-index: 1; /* Lower z-index to stay below mobile header */
    }
    
    /* Hide absolute positioned chart info on mobile to prevent interference */
    .chart-info:not(.position-footer) {
      display: none;
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