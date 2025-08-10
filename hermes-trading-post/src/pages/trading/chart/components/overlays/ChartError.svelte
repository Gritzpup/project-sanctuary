<script lang="ts">
  import { chartStore } from '../../stores/chartStore.svelte';
  import { slide } from 'svelte/transition';
  
  export let position: 'center' | 'top' | 'bottom' = 'center';
  export let dismissible: boolean = true;
  
  function dismiss() {
    if (dismissible) {
      chartStore.setError(null);
    }
  }
  
  $: error = chartStore.error;
  $: positionClass = `position-${position}`;
</script>

{#if error}
  <div 
    class="chart-error-overlay {positionClass}" 
    transition:slide={{ duration: 300 }}
  >
    <div class="error-container">
      <div class="error-icon">⚠️</div>
      <div class="error-content">
        <h3 class="error-title">Chart Error</h3>
        <p class="error-message">{error}</p>
      </div>
      {#if dismissible}
        <button class="dismiss-button" on:click={dismiss} aria-label="Dismiss error">
          ×
        </button>
      {/if}
    </div>
    
    <div class="error-actions">
      <button class="action-button retry" on:click={() => window.location.reload()}>
        Reload Page
      </button>
    </div>
  </div>
{/if}

<style>
  .chart-error-overlay {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    z-index: 100;
    width: 90%;
    max-width: 400px;
  }
  
  .position-center {
    top: 50%;
    transform: translate(-50%, -50%);
  }
  
  .position-top {
    top: 20px;
  }
  
  .position-bottom {
    bottom: 20px;
  }
  
  .error-container {
    background: rgba(244, 67, 54, 0.95);
    color: white;
    padding: 20px;
    border-radius: 8px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    display: flex;
    align-items: flex-start;
    gap: 12px;
    position: relative;
  }
  
  .error-icon {
    font-size: 24px;
    flex-shrink: 0;
  }
  
  .error-content {
    flex: 1;
  }
  
  .error-title {
    margin: 0 0 8px 0;
    font-size: 16px;
    font-weight: 600;
  }
  
  .error-message {
    margin: 0;
    font-size: 14px;
    line-height: 1.5;
    opacity: 0.95;
  }
  
  .dismiss-button {
    position: absolute;
    top: 8px;
    right: 8px;
    background: none;
    border: none;
    color: white;
    font-size: 24px;
    cursor: pointer;
    width: 30px;
    height: 30px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    transition: background 0.2s;
  }
  
  .dismiss-button:hover {
    background: rgba(255, 255, 255, 0.2);
  }
  
  .error-actions {
    margin-top: 12px;
    display: flex;
    gap: 8px;
    justify-content: center;
  }
  
  .action-button {
    padding: 8px 16px;
    border: 1px solid rgba(255, 255, 255, 0.3);
    background: rgba(255, 255, 255, 0.1);
    color: white;
    font-size: 13px;
    font-weight: 500;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .action-button:hover {
    background: rgba(255, 255, 255, 0.2);
    border-color: rgba(255, 255, 255, 0.5);
  }
  
  .action-button.retry {
    background: white;
    color: #f44336;
    border-color: white;
  }
  
  .action-button.retry:hover {
    background: rgba(255, 255, 255, 0.9);
  }
</style>