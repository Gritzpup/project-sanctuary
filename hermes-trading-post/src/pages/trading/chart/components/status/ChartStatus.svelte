<script lang="ts">
  import { statusStore } from '../../stores/statusStore.svelte';
  import { fade, scale } from 'svelte/transition';
  
  export let position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' = 'top-right';
  export let showText: boolean = true;
  export let showHistory: boolean = false;
  export let size: 'small' | 'medium' | 'large' = 'medium';
  
  // Status colors
  const statusColors = {
    initializing: '#ff9800',
    loading: '#ff9800',
    ready: '#4caf50',
    error: '#f44336',
    'price-update': '#2196f3',
    'new-candle': '#4caf50'
  };
  
  // Status icons
  const statusIcons = {
    initializing: '⚙️',
    loading: '⏳',
    ready: '✓',
    error: '⚠️',
    'price-update': '💰',
    'new-candle': '📊'
  };
  
  // Size classes
  const sizeClasses = {
    small: 'status-small',
    medium: 'status-medium',
    large: 'status-large'
  };
  
  $: currentStatus = statusStore.status;
  $: statusColor = statusColors[currentStatus] || '#999';
  $: statusIcon = statusIcons[currentStatus] || '●';
  $: displayText = statusStore.displayText;
  $: isTransitioning = statusStore.isTransitioning;
  
  // Position classes
  $: positionClass = `position-${position}`;
  
  function toggleHistory() {
    showHistory = !showHistory;
  }
  
  function formatTime(timestamp: number): string {
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  }
</script>

<div class="chart-status {positionClass} {sizeClasses[size]}" class:transitioning={isTransitioning}>
  <div class="status-indicator" on:click={toggleHistory} role="button" tabindex="0">
    <span 
      class="status-light" 
      style="background-color: {statusColor}"
      class:pulse={currentStatus === 'loading' || currentStatus === 'initializing'}
    >
      {#if currentStatus === 'loading'}
        <span class="spinner"></span>
      {/if}
    </span>
    
    {#if showText}
      <span class="status-text">{displayText}</span>
    {/if}
  </div>
  
  {#if showHistory && statusStore.history.length > 0}
    <div class="status-history" transition:fade={{ duration: 200 }}>
      <div class="history-header">
        <span>Status History</span>
        <button class="close-button" on:click={() => showHistory = false}>×</button>
      </div>
      <div class="history-items">
        {#each statusStore.history.slice(-10).reverse() as item}
          <div class="history-item">
            <span 
              class="history-dot" 
              style="background-color: {statusColors[item.status] || '#999'}"
            ></span>
            <span class="history-status">{item.status}</span>
            <span class="history-time">{formatTime(item.timestamp)}</span>
          </div>
        {/each}
      </div>
    </div>
  {/if}
</div>

{#if statusStore.error && currentStatus === 'error'}
  <div 
    class="error-toast" 
    transition:scale={{ duration: 300, start: 0.9 }}
  >
    <span class="error-icon">⚠️</span>
    <span class="error-message">{statusStore.message}</span>
  </div>
{/if}

<style>
  .chart-status {
    position: absolute;
    z-index: 10;
    user-select: none;
  }
  
  .position-top-left {
    top: 10px;
    left: 10px;
  }
  
  .position-top-right {
    top: 10px;
    right: 10px;
  }
  
  .position-bottom-left {
    bottom: 10px;
    left: 10px;
  }
  
  .position-bottom-right {
    bottom: 10px;
    right: 10px;
  }
  
  .status-indicator {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 12px;
    background: rgba(0, 0, 0, 0.8);
    border-radius: 20px;
    cursor: pointer;
    transition: all 0.3s ease;
  }
  
  .status-indicator:hover {
    background: rgba(0, 0, 0, 0.9);
    transform: scale(1.05);
  }
  
  .status-light {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    transition: all 0.3s ease;
  }
  
  .status-light.pulse {
    animation: pulse 1.5s ease-in-out infinite;
  }
  
  @keyframes pulse {
    0% {
      box-shadow: 0 0 0 0 currentColor;
    }
    70% {
      box-shadow: 0 0 0 8px rgba(0, 0, 0, 0);
    }
    100% {
      box-shadow: 0 0 0 0 rgba(0, 0, 0, 0);
    }
  }
  
  .spinner {
    position: absolute;
    width: 100%;
    height: 100%;
    border: 2px solid transparent;
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  
  .status-text {
    color: white;
    font-size: 12px;
    font-weight: 500;
    white-space: nowrap;
  }
  
  /* Size variations */
  .status-small .status-indicator {
    padding: 4px 8px;
    gap: 6px;
  }
  
  .status-small .status-light {
    width: 8px;
    height: 8px;
  }
  
  .status-small .status-text {
    font-size: 11px;
  }
  
  .status-large .status-indicator {
    padding: 8px 16px;
    gap: 10px;
  }
  
  .status-large .status-light {
    width: 16px;
    height: 16px;
  }
  
  .status-large .status-text {
    font-size: 14px;
  }
  
  /* History panel */
  .status-history {
    position: absolute;
    top: 100%;
    right: 0;
    margin-top: 8px;
    background: rgba(0, 0, 0, 0.95);
    border-radius: 8px;
    padding: 12px;
    min-width: 250px;
    max-height: 300px;
    overflow-y: auto;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  }
  
  .history-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
    color: white;
    font-size: 12px;
    font-weight: 600;
  }
  
  .close-button {
    background: none;
    border: none;
    color: white;
    font-size: 18px;
    cursor: pointer;
    padding: 0;
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    transition: background 0.2s;
  }
  
  .close-button:hover {
    background: rgba(255, 255, 255, 0.1);
  }
  
  .history-items {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  
  .history-item {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 11px;
    color: rgba(255, 255, 255, 0.8);
  }
  
  .history-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  
  .history-status {
    flex: 1;
  }
  
  .history-time {
    color: rgba(255, 255, 255, 0.5);
    font-size: 10px;
  }
  
  /* Error toast */
  .error-toast {
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: #f44336;
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    gap: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    z-index: 1000;
  }
  
  .error-icon {
    font-size: 18px;
  }
  
  .error-message {
    font-size: 14px;
    font-weight: 500;
  }
  
  /* Transition state */
  .transitioning .status-light {
    transform: scale(1.2);
  }
</style>