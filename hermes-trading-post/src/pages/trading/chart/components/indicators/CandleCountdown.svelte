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
    // Always use fresh timestamp - never cache
    const now = Math.floor(Date.now() / 1000);
    const currentGranularity = chartStore.config.granularity;

    // Calculate granularity in seconds
    const granularitySeconds = getGranularitySeconds(currentGranularity);

    // Calculate next candle time based on aligned boundaries
    const alignedTime = Math.floor(now / granularitySeconds) * granularitySeconds;
    const nextCandleTime = alignedTime + granularitySeconds;

    // Calculate remaining time (always positive)
    const remainingSeconds = Math.max(1, nextCandleTime - now);

    // Update state
    timeToNextCandle = remainingSeconds;
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