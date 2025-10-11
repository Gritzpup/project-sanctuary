<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { chartStore } from '../../stores/chartStore.svelte';
  import { getGranularitySeconds } from '../../utils/granularityHelpers';
  import { getCurrentTimestamp } from '../../utils/timeHelpers';

  // Props using Svelte 5 runes syntax
  const {
    updateInterval = 500,
    showUrgentStyling = true
  }: {
    updateInterval?: number;
    showUrgentStyling?: boolean;
  } = $props();

  // Internal state
  let countdownInterval: NodeJS.Timeout;
  let timeToNextCandle = $state(0);

  // Get current granularity
  const granularity = $derived(chartStore.config.granularity);

  // Format countdown display
  function formatCountdown(seconds: number): string {
    if (seconds <= 0) return '0s';
    return `${seconds}s`;
  }

  // Update countdown timer
  function updateCandleCountdown() {
    // Use precise millisecond timing for accuracy
    const nowMs = Date.now();
    const now = getCurrentTimestamp();
    const currentGranularity = chartStore.config.granularity;
    
    // Calculate granularity in seconds
    const granularitySeconds = getGranularitySeconds(currentGranularity);
    
    // For precise timing, we need to consider that candles are created at exact intervals
    let nextCandleTime: number;
    
    if (currentGranularity === '1m') {
      // For 1-minute candles, next candle is at the next minute boundary
      const currentMinute = Math.floor(now / 60);
      nextCandleTime = (currentMinute + 1) * 60;
    } else if (currentGranularity === '5m') {
      // For 5-minute candles, next candle is at the next 5-minute boundary
      const current5Min = Math.floor(now / 300);
      nextCandleTime = (current5Min + 1) * 300;
    } else if (currentGranularity === '15m') {
      // For 15-minute candles, next candle is at the next 15-minute boundary
      const current15Min = Math.floor(now / 900);
      nextCandleTime = (current15Min + 1) * 900;
    } else if (currentGranularity === '1h') {
      // For 1-hour candles, next candle is at the next hour boundary
      const currentHour = Math.floor(now / 3600);
      nextCandleTime = (currentHour + 1) * 3600;
    } else {
      // For other granularities, use granularity-based calculation
      const alignedTime = Math.floor(now / granularitySeconds) * granularitySeconds;
      nextCandleTime = alignedTime + granularitySeconds;
    }
    
    // Calculate remaining time
    const remainingSeconds = nextCandleTime - now;
    const remainingMs = remainingSeconds * 1000;
    
    // Convert to countdown seconds
    timeToNextCandle = Math.ceil(remainingMs / 1000);
    
    // Reset if countdown goes to 0 or negative
    if (timeToNextCandle <= 0) {
      timeToNextCandle = granularitySeconds;
    }
    
    // Debug for 1-minute granularity when close to completion
    if (currentGranularity === '1m' && timeToNextCandle <= 5) {
      // Optional: add debug logging here if needed
    }
  }

  // Urgency styling classes
  const urgentContainer = $derived(showUrgentStyling && timeToNextCandle <= 5);
  const urgent = $derived(showUrgentStyling && timeToNextCandle <= 5);
  const veryUrgent = $derived(showUrgentStyling && timeToNextCandle <= 2);

  onMount(() => {
    // Initial countdown update
    updateCandleCountdown();
    
    // Set up interval for countdown updates
    countdownInterval = setInterval(() => {
      updateCandleCountdown();
    }, updateInterval);
  });

  onDestroy(() => {
    if (countdownInterval) {
      clearInterval(countdownInterval);
    }
  });
</script>

<div class="countdown-container" class:urgent-container={urgentContainer}>
  <span class="countdown-label">Next {granularity}:</span>
  <span class="countdown-value" class:urgent class:very-urgent={veryUrgent}>
    {formatCountdown(timeToNextCandle)}
  </span>
</div>

<style>
  .countdown-container {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .countdown-label {
    font-size: 12px;
    color: #ccc;
  }

  .countdown-value {
    font-size: 12px;
    font-weight: bold;
    color: #fff;
    transition: all 0.3s ease;
  }

  .countdown-container.urgent-container {
    animation: urgentPulse 1s ease-in-out infinite;
  }

  .countdown-value.urgent {
    color: #ff9800;
    font-weight: bold;
  }

  .countdown-value.very-urgent {
    color: #f44336;
    animation: urgentFlash 0.5s ease-in-out infinite alternate;
  }

  @keyframes urgentPulse {
    0% { transform: scale(1); }
    50% { transform: scale(1.02); }
    100% { transform: scale(1); }
  }

  @keyframes urgentFlash {
    0% { opacity: 1; }
    100% { opacity: 0.7; }
  }
</style>