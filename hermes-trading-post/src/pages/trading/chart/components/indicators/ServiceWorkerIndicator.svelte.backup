<!--
  Service Worker Indicator Component

  Shows service worker status and cache info
-->
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { serviceWorkerManager } from '../../../../../services/serviceWorkerRegistration';

  let status = $state({
    isRegistered: false,
    isActive: false,
    hasUpdate: false
  });

  let cacheSize = $state(0);
  let updateInterval: NodeJS.Timeout | null = null;

  async function loadStatus() {
    const swStatus = serviceWorkerManager.getStatus();
    status = {
      isRegistered: swStatus.isRegistered,
      isActive: swStatus.isActive,
      hasUpdate: swStatus.hasUpdate
    };

    if (status.isActive) {
      // Get cache size
      const size = await serviceWorkerManager.getCacheSize();
      cacheSize = size;
    }
  }

  function handleUpdate() {
    if (confirm('New version available! Reload to update?')) {
      serviceWorkerManager.skipWaiting();
    }
  }

  onMount(() => {
    loadStatus();

    // Update status every 30 seconds
    updateInterval = setInterval(loadStatus, 30000);

    // Listen for updates
    const unsubscribe = serviceWorkerManager.onUpdateAvailable((hasUpdate) => {
      if (hasUpdate) {
        status.hasUpdate = true;
      }
    });

    return () => {
      unsubscribe();
    };
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

<div class="sw-indicator">
  {#if status.hasUpdate}
    <button class="sw-update-btn" onclick={handleUpdate} title="New version available! Click to update">
      🔄 Update
    </button>
  {:else if status.isActive}
    <span class="sw-active" title="Service Worker Active - HTTP caching enabled">
      ⚡
    </span>
    {#if cacheSize > 0}
      <span class="sw-cache-size" title="Total Service Worker cache size">
        {formatBytes(cacheSize)}
      </span>
    {/if}
  {:else if status.isRegistered}
    <span class="sw-registering" title="Service Worker registering...">
      ⏳
    </span>
  {:else}
    <span class="sw-disabled" title="Service Worker not available">
      ⚫
    </span>
  {/if}
</div>

<style>
  .sw-indicator {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    color: var(--text-secondary, #888);
  }

  .sw-active {
    font-size: 14px;
    filter: drop-shadow(0 0 2px rgba(255, 200, 0, 0.5));
    animation: pulse-glow 3s ease-in-out infinite;
  }

  .sw-registering {
    opacity: 0.5;
    animation: pulse 2s ease-in-out infinite;
  }

  .sw-disabled {
    opacity: 0.2;
  }

  .sw-cache-size {
    font-family: 'Courier New', monospace;
    color: var(--accent-color, #FFC107);
    font-size: 11px;
  }

  .sw-update-btn {
    background: linear-gradient(135deg, #4CAF50, #8BC34A);
    color: white;
    border: none;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    animation: pulse-update 1s ease-in-out infinite;
    box-shadow: 0 2px 4px rgba(76, 175, 80, 0.3);
  }

  .sw-update-btn:hover {
    transform: scale(1.05);
    box-shadow: 0 4px 8px rgba(76, 175, 80, 0.5);
  }

  @keyframes pulse {
    0%, 100% { opacity: 0.3; }
    50% { opacity: 0.8; }
  }

  @keyframes pulse-glow {
    0%, 100% {
      filter: drop-shadow(0 0 2px rgba(255, 200, 0, 0.3));
    }
    50% {
      filter: drop-shadow(0 0 4px rgba(255, 200, 0, 0.8));
    }
  }

  @keyframes pulse-update {
    0%, 100% {
      transform: scale(1);
    }
    50% {
      transform: scale(1.1);
    }
  }
</style>
