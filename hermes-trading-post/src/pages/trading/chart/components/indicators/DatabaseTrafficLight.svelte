<script lang="ts">
  import { statusStore } from '../../stores/statusStore.svelte';

  // Props using Svelte 5 runes syntax
  const {
    size = 'medium',
    showLabel = false
  }: {
    size?: 'small' | 'medium' | 'large';
    showLabel?: boolean;
  } = $props();

  // Reactive status from store
  const databaseActivity = $derived(statusStore.databaseActivity);

  // Size classes
  const sizeClass = $derived(`size-${size}`);

  // Status classes
  const statusClass = $derived(
    databaseActivity === 'idle' ? 'status-idle' :
    databaseActivity === 'fetching' ? 'status-fetching' :
    databaseActivity === 'storing' ? 'status-storing' :
    databaseActivity === 'error' ? 'status-error' :
    databaseActivity === 'rate-limited' ? 'status-rate-limited' :
    'status-idle'
  );

  // Human-readable status label
  const statusLabel = $derived(
    databaseActivity === 'idle' ? 'Idle' :
    databaseActivity === 'fetching' ? 'Fetching' :
    databaseActivity === 'storing' ? 'Storing' :
    databaseActivity === 'error' ? 'Error' :
    databaseActivity === 'rate-limited' ? 'Rate Limited' :
    'Unknown'
  );
</script>

<span class="database-traffic-light-container" title="Database Activity: {statusLabel}">
  <span class="traffic-light-db {sizeClass} {statusClass}"></span>
  {#if showLabel}
    <span class="status-label">{statusLabel}</span>
  {/if}
</span>

<style>
  .database-traffic-light-container {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  .traffic-light-db {
    display: inline-block;
    border-radius: 50%;
    transition: all 0.3s ease;
    box-shadow: 0 0 4px rgba(0, 0, 0, 0.3);
    border: 2px solid rgba(255, 255, 255, 0.2);
  }

  /* Size variants */
  .traffic-light-db.size-small {
    width: 8px;
    height: 8px;
  }

  .traffic-light-db.size-medium {
    width: 12px;
    height: 12px;
  }

  .traffic-light-db.size-large {
    width: 16px;
    height: 16px;
  }

  /* Status colors and animations */
  .traffic-light-db.status-idle {
    background-color: #666;
  }

  .traffic-light-db.status-fetching {
    background-color: #ffa500;
    animation: pulse-db 0.5s ease-in-out infinite;
    box-shadow: 0 0 12px rgba(255, 165, 0, 0.9);
  }

  .traffic-light-db.status-storing {
    background-color: #4caf50;
    animation: pulse-db 0.4s ease-in-out infinite;
    box-shadow: 0 0 12px rgba(76, 175, 80, 0.9);
  }

  .traffic-light-db.status-error {
    background-color: #f44336;
    animation: pulse-db 1.5s ease-in-out infinite;
    box-shadow: 0 0 8px rgba(244, 67, 54, 0.8);
  }

  .traffic-light-db.status-rate-limited {
    background-color: #ff5722;
    animation: pulse-db 2s ease-in-out infinite;
    box-shadow: 0 0 8px rgba(255, 87, 34, 0.8);
  }

  @keyframes pulse-db {
    0%, 100% {
      opacity: 1;
      transform: scale(1);
    }
    50% {
      opacity: 0.6;
      transform: scale(1.15);
    }
  }

  .status-label {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.7);
    font-weight: 500;
  }
</style>
