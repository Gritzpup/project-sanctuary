<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { dataStore } from '../../stores/dataStore.svelte';

  // Props using Svelte 5 runes syntax
  const {
    size = 'medium',
    showTooltip = true,
    flashDuration = 500,
    tradingStatus = null
  }: {
    size?: 'small' | 'medium' | 'large';
    showTooltip?: boolean;
    flashDuration?: number;
    tradingStatus?: { isRunning: boolean; isPaused: boolean } | null;
  } = $props();

  // Internal state for traffic light logic
  let previousPrice = $state<number | null>(null);
  let priceDirection = $state<'up' | 'down'>('up');
  let isWaitingForPrice = $state(true); // Start as waiting (blue)
  let priceFlashTimeout: NodeJS.Timeout;

  // Traffic light status using $derived
  const actualWsStatus = $derived(getTrafficLightStatus());
  const trafficLightColor = $derived(getTrafficLightColor(actualWsStatus));

  // Traffic light status function - trading status takes priority
  function getTrafficLightStatus(): 'green' | 'red' | 'blue' | 'orange' {
    // Priority 1: Trading status (if provided)
    if (tradingStatus) {
      if (tradingStatus.isRunning) {
        return tradingStatus.isPaused ? 'orange' : 'green'; // Green when running, orange when paused
      } else {
        return 'red'; // Red when stopped
      }
    }
    
    // Priority 2: Data status (fallback to original logic)
    // Check if we have data
    const hasDataStoreCandles = dataStore.stats.totalCount > 0;
    const hasPrice = dataStore.latestPrice && dataStore.latestPrice > 0;
    
    // If no data at all, show blue (waiting)
    if (!(hasDataStoreCandles || hasPrice || !dataStore.isEmpty)) {
      return 'blue';
    }
    
    // If waiting for next price update, show blue
    if (isWaitingForPrice) {
      return 'blue';
    }
    
    // Show color based on last price direction when we just got an update
    if (priceDirection === 'up') {
      return 'green';
    } else {
      return 'red';
    }
  }

  // Get traffic light color
  function getTrafficLightColor(status: 'green' | 'red' | 'blue' | 'orange'): string {
    switch (status) {
      case 'green': return '#4caf50'; // Green - bot running / price went up
      case 'red': return '#f44336';   // Red - bot stopped / price went down
      case 'orange': return '#ff9800'; // Orange - bot paused
      case 'blue': return '#2196f3';  // Blue - waiting for next update
      default: return '#2196f3';
    }
  }

  // Size classes
  const sizeClasses = {
    small: 'size-small',
    medium: 'size-medium', 
    large: 'size-large'
  };

  // Status text for tooltip
  const statusText = $derived(() => {
    switch (actualWsStatus) {
      case 'green': return 'Price Up';
      case 'red': return 'Price Down';
      case 'blue': return 'Waiting for Update';
      default: return 'Unknown';
    }
  });

  // Track price changes for direction - react to WebSocket updates
  $effect(() => {
    // Only react to the lastUpdate timestamp to avoid interfering with price flow
    const lastUpdate = dataStore.stats.lastUpdate;
    const currentPrice = dataStore.latestPrice;


    // Only process if we have both an update timestamp and a current price
    if (lastUpdate && currentPrice !== null) {
      if (previousPrice !== null && currentPrice !== previousPrice) {
        // Clear any existing timeout
        if (priceFlashTimeout) {
          clearTimeout(priceFlashTimeout);
        }
        
        // React to any price change, even tiny ones (penny changes)
        const priceDiff = currentPrice - previousPrice;
        
        if (priceDiff !== 0) {
          // Any price change triggers the traffic light
          isWaitingForPrice = false;
          priceDirection = priceDiff > 0 ? 'up' : 'down';
          
          // Show direction color for specified duration, then go back to waiting (blue)
          priceFlashTimeout = setTimeout(() => {
            isWaitingForPrice = true;
          }, flashDuration);
        }
        
        // Update previous price only after processing
        previousPrice = currentPrice;
      } else if (previousPrice === null) {
        // First price
        previousPrice = currentPrice;
        isWaitingForPrice = true;
      }
    }
  });

  // Cleanup on destroy

  onDestroy(() => {
    if (priceFlashTimeout) {
      clearTimeout(priceFlashTimeout);
    }
  });
</script>

<span 
  class="traffic-light {sizeClasses[size]}" 
  style="background-color: {trafficLightColor};" 
  title={showTooltip ? `WebSocket Status: ${statusText}` : undefined}
  data-status={actualWsStatus}
></span>

<style>
  .traffic-light {
    display: inline-block;
    border-radius: 50%;
    transition: background-color 0.2s ease;
    box-shadow: 0 0 4px rgba(0, 0, 0, 0.3);
    border: 2px solid rgba(255, 255, 255, 0.2);
  }

  .size-small {
    width: 8px;
    height: 8px;
  }

  .size-medium {
    width: 12px;
    height: 12px;
  }

  .size-large {
    width: 16px;
    height: 16px;
  }

  .traffic-light:hover {
    box-shadow: 0 0 8px rgba(0, 0, 0, 0.5);
    transform: scale(1.1);
  }

  /* Enhanced pulsing animations for status changes */
  .traffic-light[data-status="green"] {
    animation: pulse-green 0.8s ease-in-out;
    box-shadow: 0 0 8px rgba(76, 175, 80, 0.8);
  }

  .traffic-light[data-status="red"] {
    animation: pulse-red 0.8s ease-in-out;
    box-shadow: 0 0 8px rgba(244, 67, 54, 0.8);
  }

  .traffic-light[data-status="blue"] {
    animation: pulse-blue 1.5s ease-in-out infinite;
    box-shadow: 0 0 6px rgba(33, 150, 243, 0.6);
  }

  @keyframes pulse-green {
    0% { 
      box-shadow: 0 0 4px rgba(0, 0, 0, 0.3);
      transform: scale(1);
    }
    25% { 
      box-shadow: 0 0 16px rgba(76, 175, 80, 0.9);
      transform: scale(1.1);
    }
    50% { 
      box-shadow: 0 0 20px rgba(76, 175, 80, 1);
      transform: scale(1.15);
    }
    75% { 
      box-shadow: 0 0 16px rgba(76, 175, 80, 0.9);
      transform: scale(1.1);
    }
    100% { 
      box-shadow: 0 0 8px rgba(76, 175, 80, 0.8);
      transform: scale(1);
    }
  }

  @keyframes pulse-red {
    0% { 
      box-shadow: 0 0 4px rgba(0, 0, 0, 0.3);
      transform: scale(1);
    }
    25% { 
      box-shadow: 0 0 16px rgba(244, 67, 54, 0.9);
      transform: scale(1.1);
    }
    50% { 
      box-shadow: 0 0 20px rgba(244, 67, 54, 1);
      transform: scale(1.15);
    }
    75% { 
      box-shadow: 0 0 16px rgba(244, 67, 54, 0.9);
      transform: scale(1.1);
    }
    100% { 
      box-shadow: 0 0 8px rgba(244, 67, 54, 0.8);
      transform: scale(1);
    }
  }

  @keyframes pulse-blue {
    0% { 
      box-shadow: 0 0 4px rgba(33, 150, 243, 0.4);
      opacity: 0.8;
    }
    50% { 
      box-shadow: 0 0 12px rgba(33, 150, 243, 0.8);
      opacity: 1;
    }
    100% { 
      box-shadow: 0 0 4px rgba(33, 150, 243, 0.4);
      opacity: 0.8;
    }
  }
</style>