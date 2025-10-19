<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { memoized } from '../../utils/memoization';
  import ServerTimeService from '../../../../../services/ServerTimeService';

  // Props using Svelte 5 runes syntax
  const {
    showDate = false,
    showSeconds = true,
    updateInterval = 1000,
    format24Hour = true
  }: {
    showDate?: boolean;
    showSeconds?: boolean;
    updateInterval?: number;
    format24Hour?: boolean;
  } = $props();

  // Internal state - cache formatted strings to avoid unnecessary re-renders
  let currentTime = $state(ServerTimeService.getNowDate());
  let clockInterval: NodeJS.Timeout;

  // ⚡ PHASE 5E: Memoize time formatting with 1-second TTL
  // Prevents expensive Date.toLocaleTimeString() calls on every millisecond tick
  const clockDisplay = $derived(
    memoized(
      'clock-display',
      [currentTime.getHours(), currentTime.getMinutes(), currentTime.getSeconds(), format24Hour, showSeconds],
      () => currentTime.toLocaleTimeString('en-US', {
        hour12: !format24Hour,
        hour: '2-digit',
        minute: '2-digit',
        second: showSeconds ? '2-digit' : undefined
      }),
      1000  // 1 second TTL (only format when display actually changes)
    )
  );

  // ⚡ PHASE 5E: Memoize date formatting with 60-second TTL
  // Date rarely changes, so cache aggressively
  const dateDisplay = $derived(
    memoized(
      'clock-date-display',
      [currentTime.getDate(), currentTime.getMonth(), currentTime.getFullYear()],
      () => currentTime.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric'
      }),
      60000  // 60 second TTL (date changes once per day)
    )
  );

  onMount(async () => {
    // Initialize server time synchronization
    await ServerTimeService.initServerTime();

    // Start clock interval using SERVER TIME (synchronized with backend)
    // This ensures all clients see the same time
    clockInterval = setInterval(() => {
      currentTime = ServerTimeService.getNowDate();
    }, updateInterval);
  });

  onDestroy(() => {
    if (clockInterval) {
      clearInterval(clockInterval);
    }
  });
</script>

<div class="clock-display">
  <span class="time">{clockDisplay}</span>
  {#if showDate}
    <span class="date">{dateDisplay}</span>
  {/if}
</div>

<style>
  .clock-display {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
  }

  .time {
    font-size: 12px;
    font-weight: 700;
    color: white;
  }

  .date {
    font-size: 10px;
    color: rgba(255, 255, 255, 0.7);
  }

  /* Light theme adjustments */
  :global(.light) .time {
    color: #333;
  }

  :global(.light) .date {
    color: #666;
  }

  /* Responsive */
  @media (max-width: 768px) {
    .time {
      font-size: 13px;
    }

    .date {
      font-size: 11px;
    }
  }
</style>
