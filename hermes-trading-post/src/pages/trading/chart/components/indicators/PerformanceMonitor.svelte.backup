<script lang="ts">
  import { performanceStore } from '../../stores/performanceStore.svelte';

  // Props using Svelte 5 runes syntax
  const {
    showFPS = true,
    showCacheHitRate = true,
    showMemory = false,
    fpsWarningThreshold = 30,
    fpsGoodThreshold = 45
  }: {
    showFPS?: boolean;
    showCacheHitRate?: boolean;
    showMemory?: boolean;
    fpsWarningThreshold?: number;
    fpsGoodThreshold?: number;
  } = $props();

  // Reactive values from performance store
  const isMonitoring = $derived(performanceStore.isMonitoring);
  const fps = $derived(performanceStore.stats.fps);
  const cacheHitRate = $derived(performanceStore.stats.cacheHitRate);
  const memoryUsage = $derived(performanceStore.stats.memoryUsage);

  // FPS quality classification
  const fpsQuality = $derived(
    fps >= fpsGoodThreshold ? 'good' :
    fps >= fpsWarningThreshold ? 'average' :
    'poor'
  );

  // Cache quality classification
  const cacheQuality = $derived(
    cacheHitRate >= 80 ? 'excellent' :
    cacheHitRate >= 60 ? 'good' :
    cacheHitRate >= 40 ? 'average' :
    'poor'
  );
</script>

{#if isMonitoring}
  <div class="performance-monitor">
    {#if showFPS}
      <div class="performance-item">
        <span class="info-label">FPS:</span>
        <span class="info-value fps {fpsQuality}">
          {fps}
        </span>
      </div>
    {/if}

    {#if showCacheHitRate && cacheHitRate > 0}
      <div class="performance-item">
        <span class="info-label">Cache:</span>
        <span class="info-value cache {cacheQuality}">
          {cacheHitRate}%
        </span>
      </div>
    {/if}

    {#if showMemory && memoryUsage > 0}
      <div class="performance-item">
        <span class="info-label">Mem:</span>
        <span class="info-value memory">
          {(memoryUsage / 1024 / 1024).toFixed(1)}MB
        </span>
      </div>
    {/if}
  </div>
{/if}

<style>
  .performance-monitor {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .performance-item {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .info-label {
    color: rgba(255, 255, 255, 0.7);
    font-weight: 500;
    font-size: 12px;
  }

  .info-value {
    color: white;
    font-weight: 600;
    font-size: 12px;
    transition: color 0.3s ease;
  }

  /* FPS quality colors */
  .info-value.fps.good {
    color: #4caf50;
  }

  .info-value.fps.average {
    color: #ffa500;
  }

  .info-value.fps.poor {
    color: #f44336;
  }

  /* Cache quality colors */
  .info-value.cache.excellent {
    color: #4caf50;
  }

  .info-value.cache.good {
    color: #8bc34a;
  }

  .info-value.cache.average {
    color: #ffa500;
  }

  .info-value.cache.poor {
    color: #f44336;
  }

  /* Memory display */
  .info-value.memory {
    color: #2196f3;
  }

  /* Light theme adjustments */
  :global(.light) .info-label {
    color: #666;
  }

  :global(.light) .info-value {
    color: #333;
  }

  /* Responsive */
  @media (max-width: 768px) {
    .performance-monitor {
      gap: 10px;
    }

    .info-label,
    .info-value {
      font-size: 11px;
    }
  }
</style>
