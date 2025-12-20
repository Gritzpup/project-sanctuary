<script lang="ts">
  import { onMount, onDestroy, getContext } from 'svelte';
  import { dataStore } from '../../stores/dataStore.svelte';
  import { chartStore } from '../../stores/chartStore.svelte';
  import { statusStore } from '../../stores/statusStore.svelte';
  import { formatNumber } from '../../../../../utils/formatters/priceFormatters';
  import { formatCandleTime } from '../../utils/timeHelpers';
  import { memoized } from '../../utils/memoization';

  // Import all indicator components (Phase 2 refactoring)
  import CandleCounter from '../indicators/CandleCounter.svelte';
  import CandleCountdown from '../indicators/CandleCountdown.svelte';
  import ClockDisplay from '../indicators/ClockDisplay.svelte';
  import PerformanceMonitor from '../indicators/PerformanceMonitor.svelte';

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

  onMount(() => {
    // IMMEDIATE status force - don't wait
    statusStore.forceReady();

    // Force status to ready after 5 seconds if still loading
    setTimeout(() => {
      if (statusStore.status === 'initializing' || statusStore.status === 'loading') {
        statusStore.forceReady();
      }
    }, 5000);
  });

  // ⚡ PHASE 5A&5C: Format time range with memoization (30-40% faster)
  // Removed unused reactive effect that was triggering cascades on every L2 update
  // Added memoization to cache expensive Date.toLocaleString() calls
  const timeRange = $derived(
    memoized(
      'chart-info-timerange',
      [dataStore.stats.oldestTime, dataStore.stats.newestTime],
      () => {
        if (!dataStore.stats.oldestTime || !dataStore.stats.newestTime) return null;
        return {
          from: new Date(dataStore.stats.oldestTime * 1000).toLocaleString(),
          to: new Date(dataStore.stats.newestTime * 1000).toLocaleString()
        };
      },
      30000  // 30 second TTL (time range rarely changes)
    )
  );

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
      <span class="info-label">DB:</span>
      <span class="info-value">
        {formatNumber(dataStore.stats.totalDatabaseCount || 0)}
      </span>
    </div>
    <div class="info-item">
      <span class="info-label">Loaded:</span>
      <span class="info-value">
        {formatNumber(dataStore.stats.loadedCount || 0)}
      </span>
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
      <ClockDisplay showDate={false} showSeconds={true} format24Hour={true} />
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
  


  {#if showPerformance}
    <PerformanceMonitor showFPS={true} showCacheHitRate={true} showMemory={false} />
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
    background: linear-gradient(to right, rgba(255, 255, 255, 0.02), rgba(0, 0, 0, 0.6));
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
  
  /* Removed: Performance styles moved to PerformanceMonitor.svelte component */

  /* Total P/L */
  .total-pnl .info-value.profit {
    color: #4caf50;
    font-weight: 600;
  }
  
  .total-pnl .info-value.loss {
    color: #f44336;
    font-weight: 600;
  }
  
  /* Removed: Database traffic light styles moved to DatabaseTrafficLight.svelte component */

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