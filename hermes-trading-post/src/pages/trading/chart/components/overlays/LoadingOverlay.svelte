<script lang="ts">
  import { fade } from 'svelte/transition';
  import { statusStore } from '../../stores/statusStore.svelte';
  import { dataStore } from '../../stores/dataStore.svelte';

  // Loading progress calculation
  const loadingProgress = $derived(() => {
    const stats = dataStore.stats;

    // Estimate progress based on loaded candles
    if (statusStore.status === 'loading' || statusStore.status === 'initializing') {
      const targetCandles = 100; // Expected candles for initial load
      const currentCandles = stats.totalCount || 0;
      return Math.min(100, (currentCandles / targetCandles) * 100);
    }

    return 0;
  });

  // Show overlay when loading or initializing
  const showOverlay = $derived(
    statusStore.status === 'loading' ||
    statusStore.status === 'initializing'
  );

  const statusMessage = $derived(() => {
    if (statusStore.message) {
      return statusStore.message;
    }
    return 'Loading chart...';
  });
</script>

{#if showOverlay}
  <div class="loading-overlay" transition:fade={{ duration: 200 }}>
    <div class="loading-content">
      <div class="spinner">
        <div class="spinner-ring"></div>
        <div class="spinner-ring"></div>
        <div class="spinner-ring"></div>
      </div>

      <div class="loading-text">{statusMessage}</div>

      {#if loadingProgress() > 0}
        <div class="progress-container">
          <div class="progress-bar">
            <div
              class="progress-fill"
              style="width: {loadingProgress()}%"
            ></div>
          </div>
          <div class="progress-text">{Math.round(loadingProgress())}%</div>
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .loading-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.75);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
  }

  .loading-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 20px;
    padding: 30px;
    background: rgba(0, 0, 0, 0.9);
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .spinner {
    position: relative;
    width: 60px;
    height: 60px;
  }

  .spinner-ring {
    position: absolute;
    width: 100%;
    height: 100%;
    border: 3px solid transparent;
    border-radius: 50%;
    animation: spin 1.5s cubic-bezier(0.5, 0, 0.5, 1) infinite;
  }

  .spinner-ring:nth-child(1) {
    border-top-color: #4caf50;
    animation-delay: -0.45s;
  }

  .spinner-ring:nth-child(2) {
    border-right-color: #2196f3;
    animation-delay: -0.3s;
  }

  .spinner-ring:nth-child(3) {
    border-bottom-color: #ff9800;
    animation-delay: -0.15s;
  }

  @keyframes spin {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }

  .loading-text {
    color: white;
    font-size: 14px;
    font-weight: 500;
    text-align: center;
  }

  .progress-container {
    width: 200px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }

  .progress-bar {
    width: 100%;
    height: 4px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 2px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #4caf50 0%, #2196f3 100%);
    border-radius: 2px;
    transition: width 0.3s ease;
  }

  .progress-text {
    color: rgba(255, 255, 255, 0.7);
    font-size: 12px;
  }

  /* Dark theme already default, light theme support */
  :global(.light) .loading-overlay {
    background: rgba(255, 255, 255, 0.9);
  }

  :global(.light) .loading-content {
    background: rgba(255, 255, 255, 0.95);
    border-color: rgba(0, 0, 0, 0.1);
  }

  :global(.light) .loading-text {
    color: #333;
  }

  :global(.light) .progress-bar {
    background: rgba(0, 0, 0, 0.1);
  }

  :global(.light) .progress-text {
    color: rgba(0, 0, 0, 0.6);
  }
</style>