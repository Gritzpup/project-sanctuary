<script lang="ts">
  import { onMount, onDestroy, getContext } from 'svelte';
  import { dataStore } from '../../stores/dataStore.svelte';
  import { chartStore } from '../../stores/chartStore.svelte';
  import { performanceStore } from '../../stores/performanceStore.svelte';
  import { statusStore } from '../../stores/statusStore.svelte';
  import { getGranularitySeconds } from '../../utils/granularityHelpers';
  import { formatPrice, formatNumber } from '../../utils/priceFormatters';
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
  }: {
    position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'footer';
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
        <CandleCounter updateInterval={2000} showAnimation={true} />
      </span>
      <!-- Traffic light WebSocket status -->
      <span style="margin-left: 8px;">
        <TrafficLight size="medium" flashDuration={500} />
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
  
  /* Components now handle their own styling */
  
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