<script lang="ts">
  import { chartStore } from '../../stores/chartStore.svelte';
  import { getGranularitySeconds } from '../../utils/granularityHelpers';
  import ServerTimeService from '../../../../../services/ServerTimeService';

  // Props using Svelte 5 runes syntax
  const {
    showUrgentStyling = true
  }: {
    showUrgentStyling?: boolean;
  } = $props();

  // Internal state
  let timeToNextCandle = $state(0);
  let rafId: number | null = null;
  let isInitialized = $state(false);

  // Get current granularity
  const granularity = $derived(chartStore.config.granularity);

  // Format countdown display - show decimals for smooth animation
  function formatCountdown(seconds: number): string {
    if (seconds <= 0) return '0s';
    // Show decimals only in last 5 seconds for smooth countdown
    if (seconds <= 5) {
      return `${seconds.toFixed(1)}s`;
    }
    return `${Math.ceil(seconds)}s`;
  }

  // Update countdown timer using server time - RAF for smooth updates
  function updateCandleCountdown() {
    // 🕐 Use SERVER time (synchronized with backend)
    const now = ServerTimeService.getNowSeconds();
    const currentGranularity = chartStore.config.granularity;

    // Calculate granularity in seconds
    const granularitySeconds = getGranularitySeconds(currentGranularity);

    // Calculate next candle time based on aligned boundaries
    const alignedTime = Math.floor(now / granularitySeconds) * granularitySeconds;
    const nextCandleTime = alignedTime + granularitySeconds;

    // Calculate remaining time with decimals (always positive)
    const remainingSeconds = Math.max(0.01, nextCandleTime - now);

    // Update state
    timeToNextCandle = remainingSeconds;

    // Schedule next RAF update for smooth per-frame animation
    rafId = requestAnimationFrame(updateCandleCountdown);
  }

  // Urgency styling classes
  const urgentContainer = $derived(showUrgentStyling && timeToNextCandle <= 5);
  const urgent = $derived(showUrgentStyling && timeToNextCandle <= 5);
  const veryUrgent = $derived(showUrgentStyling && timeToNextCandle <= 2);

  // Initialize on mount
  $effect.pre(async () => {
    if (!isInitialized) {
      // Initialize server time synchronization
      await ServerTimeService.initServerTime();
      isInitialized = true;

      // Start RAF loop
      updateCandleCountdown();
    }

    // Cleanup RAF on unmount
    return () => {
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    };
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
    /* ⚡ PHASE 5B: Pulse animation only during last 5 seconds, 5 times (not infinite) */
    animation: urgentPulse 1s ease-in-out 5;
  }

  .countdown-value.urgent {
    color: #ff9800;
    font-weight: bold;
  }

  .countdown-value.very-urgent {
    color: #f44336;
    /* ⚡ PHASE 5B: Flash animation only plays 5 times instead of infinite (10-15% CPU reduction) */
    animation: urgentFlash 0.3s ease-in-out 5;
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