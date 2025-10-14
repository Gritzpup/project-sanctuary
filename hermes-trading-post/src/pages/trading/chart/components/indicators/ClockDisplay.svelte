<script lang="ts">
  import { onMount, onDestroy } from 'svelte';

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

  // Internal state
  let currentTime = $state(new Date());
  let clockInterval: NodeJS.Timeout;

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

  onMount(() => {
    // Start clock interval
    clockInterval = setInterval(() => {
      currentTime = new Date();
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
