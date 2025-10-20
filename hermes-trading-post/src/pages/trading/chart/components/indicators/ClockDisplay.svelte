<script lang="ts">
  import { memoized } from '../../utils/memoization';
  import ServerTimeService from '../../../../../services/ServerTimeService';

  // Props using Svelte 5 runes syntax
  const {
    showDate = false,
    showSeconds = true,
    format24Hour = true
  }: {
    showDate?: boolean;
    showSeconds?: boolean;
    format24Hour?: boolean;
  } = $props();

  // Internal state - RAF updates for smooth per-frame time display
  let currentTime = $state(ServerTimeService.getNowDate());
  let rafId: number | null = null;
  let isInitialized = $state(false);
  let lastSecond = -1;  // Track last second to avoid unnecessary formatting

  // ⚡ PHASE 12: RAF-based time updates for smooth per-frame display
  // Updates every frame (60 FPS) but only reformats when seconds actually change
  function updateClock() {
    const now = ServerTimeService.getNowDate();
    const currentSecond = now.getSeconds();

    // Only update state if second changed (avoids unnecessary reactivity)
    if (currentSecond !== lastSecond) {
      currentTime = now;
      lastSecond = currentSecond;
    }

    // Schedule next RAF update for smooth animation
    rafId = requestAnimationFrame(updateClock);
  }

  // ⚡ Memoize time formatting with 1-second TTL
  // Prevents expensive Date.toLocaleTimeString() calls
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

  // ⚡ Memoize date formatting with 60-second TTL
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

  // Initialize on mount
  $effect.pre(async () => {
    if (!isInitialized) {
      // Initialize server time synchronization
      await ServerTimeService.initServerTime();
      isInitialized = true;
      lastSecond = ServerTimeService.getNowDate().getSeconds();

      // Start RAF loop for smooth updates
      updateClock();
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
