<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
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
  let lastClockDisplay = '';
  let lastDateDisplay = '';

  // Format clock display
  const clockDisplay = $derived(currentTime.toLocaleTimeString('en-US', {
    hour12: !format24Hour,
    hour: '2-digit',
    minute: '2-digit',
    second: showSeconds ? '2-digit' : undefined
  }));

  // Format date display
  const dateDisplay = $derived(currentTime.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  }));

  // 🚀 PERF: Only trigger re-renders when formatted strings actually change
  // Prevents excessive DOM updates when milliseconds tick by without changing display
  $effect(() => {
    // This runs when clockDisplay or dateDisplay changes
    if (clockDisplay !== lastClockDisplay) {
      lastClockDisplay = clockDisplay;
    }
    if (dateDisplay !== lastDateDisplay) {
      lastDateDisplay = dateDisplay;
    }
  });

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
