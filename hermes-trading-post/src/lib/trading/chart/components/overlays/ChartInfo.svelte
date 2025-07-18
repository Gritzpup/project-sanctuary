<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { dataStore } from '../../stores/dataStore.svelte';
  import { chartStore } from '../../stores/chartStore.svelte';
  import { performanceStore } from '../../stores/performanceStore.svelte';
  
  export let position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' = 'bottom-left';
  export let showCandleCount: boolean = true;
  export let showTimeRange: boolean = true;
  export let showClock: boolean = true;
  export let showPerformance: boolean = false;
  export let showLatestPrice: boolean = true;
  
  let currentTime = new Date();
  let clockInterval: NodeJS.Timeout;
  
  onMount(() => {
    if (showClock) {
      clockInterval = setInterval(() => {
        currentTime = new Date();
      }, 1000);
    }
  });
  
  onDestroy(() => {
    if (clockInterval) {
      clearInterval(clockInterval);
    }
  });
  
  // Format time range
  $: timeRange = dataStore.stats.oldestTime && dataStore.stats.newestTime ? {
    from: new Date(dataStore.stats.oldestTime * 1000).toLocaleString(),
    to: new Date(dataStore.stats.newestTime * 1000).toLocaleString()
  } : null;
  
  // Format clock
  $: clockDisplay = currentTime.toLocaleTimeString();
  $: dateDisplay = currentTime.toLocaleDateString();
  
  // Position classes
  $: positionClass = `position-${position}`;
  
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
</script>

<div class="chart-info {positionClass}">
  {#if showLatestPrice && dataStore.latestPrice !== null}
    <div class="info-item price-item" class:new-candle={dataStore.isNewCandle}>
      <span class="info-label">Price:</span>
      <span class="info-value price-value">{formatPrice(dataStore.latestPrice)}</span>
    </div>
  {/if}
  
  {#if showCandleCount}
    <div class="info-item">
      <span class="info-label">Candles:</span>
      <span class="info-value">
        {formatNumber(dataStore.stats.visibleCount)} / {formatNumber(dataStore.stats.totalCount)}
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
  
  <div class="info-item settings">
    <span class="info-value small">
      {chartStore.config.timeframe} / {chartStore.config.granularity}
    </span>
  </div>
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
  
  /* Settings */
  .settings {
    margin-left: auto;
    padding: 4px 8px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 4px;
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