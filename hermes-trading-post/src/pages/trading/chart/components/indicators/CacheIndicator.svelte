<!--
  Cache Indicator Component

  Shows IndexedDB cache status with stats
-->
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { chartIndexedDBCache } from '../../services/ChartIndexedDBCache';

  let cacheStats = $state({
    totalEntries: 0,
    totalCandles: 0,
    totalSizeBytes: 0,
    entries: []
  });

  let isLoading = $state(true);
  let updateInterval: NodeJS.Timeout | null = null;

  async function loadStats() {
    try {
      const stats = await chartIndexedDBCache.getStats();
      cacheStats = stats;
      isLoading = false;
    } catch (error) {
      isLoading = false;
    }
  }

  onMount(() => {
    loadStats();

    // Update stats every 10 seconds
    updateInterval = setInterval(loadStats, 10000);
  });

  onDestroy(() => {
    if (updateInterval) {
      clearInterval(updateInterval);
    }
  });

  // Format bytes to human-readable
  function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  }
</script>

<div class="cache-indicator">
  {#if isLoading}
    <span class="cache-loading">⏳</span>
  {:else if cacheStats.totalEntries > 0}
    <span class="cache-icon" title="IndexedDB Cache Active">💾</span>
    <span class="cache-stats">
      <span class="cache-entries">{cacheStats.totalEntries}</span>
      <span class="cache-size">{formatBytes(cacheStats.totalSizeBytes)}</span>
    </span>
  {:else}
    <span class="cache-empty" title="No cached data">💾</span>
  {/if}
</div>

<style>
  .cache-indicator {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    color: var(--text-secondary, #888);
  }

  .cache-icon {
    font-size: 14px;
    filter: drop-shadow(0 0 2px rgba(0, 200, 0, 0.3));
  }

  .cache-loading {
    opacity: 0.5;
    animation: pulse 2s ease-in-out infinite;
  }

  .cache-empty {
    opacity: 0.3;
  }

  .cache-stats {
    display: flex;
    gap: 6px;
    font-family: 'Courier New', monospace;
  }

  .cache-entries {
    color: var(--text-primary, #fff);
    font-weight: 600;
  }

  .cache-size {
    color: var(--accent-color, #00ff00);
  }

  @keyframes pulse {
    0%, 100% { opacity: 0.3; }
    50% { opacity: 0.8; }
  }
</style>
