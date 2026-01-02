<script lang="ts">
  import { statusStore } from '../../stores/statusStore.svelte';
  import { fade, scale } from 'svelte/transition';
  import { formatTimeMs } from '../../utils/timeHelpers';

  // Use $props() for Svelte 5 runes mode
  const {
    position = 'top-right',
    showText = true,
    showHistory = false,
    size = 'medium'
  }: {
    position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
    showText?: boolean;
    showHistory?: boolean;
    size?: 'small' | 'medium' | 'large';
  } = $props();
  
  // Traffic light status colors
  const statusColors = {
    initializing: '#ff9800', // Orange - loading
    loading: '#ff9800',      // Orange - loading  
    ready: '#4caf50',        // Green - connected/ready
    error: '#f44336',        // Red - error
    'price-update': '#2196f3', // Blue - price update
    'new-candle': '#00e676'   // Bright green - new candle flash
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
  
  // 🚀 PERF: Cache these values to prevent unnecessary re-renders
  // Only update when actual values change, not on every update
  let currentStatus = $state(statusStore.status);
  let wsConnected = $state(statusStore.wsConnected);
  let isTransitioning = $state(statusStore.isTransitioning);
  let statusColor = $state(getStatusColor(currentStatus, wsConnected));
  let statusIcon = $state(statusIcons[currentStatus] || '●');
  let displayText = $state(wsConnected ? 'Connected' : 'Ready (No WebSocket)');

  // Update on actual changes only
  $effect(() => {
    const newStatus = statusStore.status;
    const newWsConnected = statusStore.wsConnected;
    const newIsTransitioning = statusStore.isTransitioning;

    // Only update if something actually changed
    if (newStatus !== currentStatus || newWsConnected !== wsConnected) {
      currentStatus = newStatus;
      wsConnected = newWsConnected;
      statusColor = getStatusColor(currentStatus, wsConnected);
      statusIcon = statusIcons[currentStatus] || '●';
      displayText = wsConnected ? 'Connected' : 'Ready (No WebSocket)';
    }

    if (newIsTransitioning !== isTransitioning) {
      isTransitioning = newIsTransitioning;
    }
  });

  function getStatusColor(status: string, wsConnected: boolean): string {
    // Override colors based on WebSocket connection
    if (status === 'ready') {
      return wsConnected ? '#4caf50' : '#ff9800'; // Green if WS connected, orange if not
    }
    if (status === 'error' && !wsConnected) {
      return '#f44336'; // Red for WebSocket disconnected
    }
    return statusColors[status] || '#999';
  }

  // Position classes - cache to prevent unnecessary recalculations
  let positionClass = $state(`position-${position}`);

  // Only update positionClass when position prop changes
  $effect(() => {
    positionClass = `position-${position}`;
  });

  // 🚀 PERF: Separate state for history visibility to avoid modifying prop
  let historyVisible = $state(showHistory);

  function toggleHistory() {
    historyVisible = !historyVisible;
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      toggleHistory();
    }
  }
  
</script>

<div class="chart-status {positionClass} {sizeClasses[size]}" class:transitioning={isTransitioning}>
  <div
    class="status-indicator"
    onclick={toggleHistory}
    onkeydown={handleKeydown}
    role="button"
    tabindex="0"
    aria-label="Toggle status history"
  >
    <span 
      class="status-light" 
      style="background-color: {statusColor}"
      class:pulse={currentStatus === 'loading' || currentStatus === 'initializing'}
      class:flash={currentStatus === 'new-candle' || currentStatus === 'price-update'}
    >
      {#if currentStatus === 'loading'}
        <span class="spinner"></span>
      {/if}
    </span>
    
    {#if showText}
      <span class="status-text">{displayText}</span>
    {/if}
  </div>
  
  {#if historyVisible && statusStore.history.length > 0}
    <div class="status-history" transition:fade={{ duration: 200 }}>
      <div class="history-header">
        <span>Status History</span>
        <button class="close-button" onclick={() => historyVisible = false}>×</button>
      </div>
      <div class="history-items">
        {#each statusStore.history.slice(-10).reverse() as item}
          <div class="history-item">
            <span 
              class="history-dot" 
              style="background-color: {statusColors[item.status] || '#999'}"
            ></span>
            <span class="history-status">{item.status}</span>
            <span class="history-time">{formatTimeMs(item.timestamp)}</span>
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
  
  .status-light.flash {
    animation: flash 0.8s ease-in-out;
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
  
  @keyframes flash {
    0%, 100% {
      opacity: 1;
      transform: scale(1);
    }
    50% {
      opacity: 0.8;
      transform: scale(1.2);
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