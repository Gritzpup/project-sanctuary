<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let isRunning: boolean;
  export let isPaused: boolean;

  const dispatch = createEventDispatcher();

  function startTrading() {
    console.log('StrategyControls startTrading clicked!');
    console.log('Dispatching start event...');
    dispatch('start');
    console.log('Start event dispatched');
  }

  function pauseTrading() {
    dispatch('pause');
  }

  function resumeTrading() {
    dispatch('resume');
  }

  function resetTrading() {
    dispatch('reset');
  }

  function stopTrading() {
    dispatch('stop');
  }
</script>

<div class="trading-controls">
  <div class="main-controls">
    {#if !isRunning}
      <button class="btn-base btn-md btn-success" on:click={startTrading}>
        <span class="btn-icon">▶</span>
        Start Trading
      </button>
      <button class="btn-base btn-md btn-error" on:click={resetTrading}>
        <span class="btn-icon">↻</span>
        Reset
      </button>
    {:else if isPaused}
      <button class="btn-base btn-md btn-success" on:click={resumeTrading}>
        <span class="btn-icon">▶</span>
        Resume
      </button>
      <button class="btn-base btn-md btn-error" on:click={resetTrading}>
        <span class="btn-icon">↻</span>
        Reset
      </button>
    {:else}
      <button class="btn-base btn-md btn-trading" on:click={pauseTrading}>
        <span class="btn-icon spinner"></span>
        Now Trading
      </button>
      <button class="btn-base btn-md btn-error" on:click={stopTrading}>
        <span class="btn-icon">⏹</span>
        Stop
      </button>
    {/if}
  </div>
</div>

<style>
  .trading-controls {
    margin-top: auto;
    padding-top: 0;
    border-top: 1px solid rgba(74, 0, 224, 0.2);
  }

  /* Desktop spacing adjustments */
  @media (min-width: 769px) {
    .trading-controls {
      padding-top: 8px;
    }
  }

  .main-controls {
    display: flex;
    gap: 10px;
    align-items: center;
    width: 100%;
  }

  .main-controls .btn-base {
    flex: 1;
    height: 32px;
    border-radius: 4px;
    font-weight: 500;
    font-size: 13px;
    background: var(--bg-primary);
    color: #c4b5fd;
    border: 1px solid var(--border-primary);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
    transition: all 0.2s ease;
  }

  .main-controls .btn-md:first-child {
    flex: 2;
  }

  .btn-icon {
    font-size: 12px;
    line-height: 1;
    display: inline-flex;
    align-items: center;
  }

  /* Add consistent spacing between icons and text */
  .btn-icon {
    margin-right: 4px;
  }

  /* Reset other properties for text icons */
  .btn-icon:not(.spinner) {
    font-size: 11px;
    margin-right: 4px;
    padding: 0;
    width: auto;
    height: auto;
  }
  
  /* Success button (Start/Resume) - Subtle green theme */
  .main-controls .btn-success {
    background: rgba(34, 197, 94, 0.1);
    color: #22c55e;
    border-color: rgba(34, 197, 94, 0.3);
    box-shadow: none;
  }
  
  .main-controls .btn-success:hover {
    background: rgba(34, 197, 94, 0.15);
    border-color: rgba(34, 197, 94, 0.4);
    color: #16a34a;
  }
  
  .main-controls .btn-success:active {
    background: rgba(34, 197, 94, 0.2);
    border-color: rgba(34, 197, 94, 0.5);
    color: #15803d;
  }
  
  /* Error button (Reset) - Subtle red theme */
  .main-controls .btn-error {
    background: rgba(239, 68, 68, 0.1);
    color: #ef4444;
    border-color: rgba(239, 68, 68, 0.3);
    box-shadow: none;
  }
  
  .main-controls .btn-error:hover {
    background: rgba(239, 68, 68, 0.15);
    border-color: rgba(239, 68, 68, 0.4);
    color: #dc2626;
  }
  
  .main-controls .btn-error:active {
    background: rgba(239, 68, 68, 0.2);
    border-color: rgba(239, 68, 68, 0.5);
    color: #b91c1c;
  }
  
  /* Trading button - Amber/yellow theme */
  .main-controls .btn-trading {
    background: rgba(251, 191, 36, 0.1);
    color: #fbbf24;
    border-color: rgba(251, 191, 36, 0.3);
    box-shadow: none;
  }
  
  .main-controls .btn-trading:hover {
    background: rgba(251, 191, 36, 0.15);
    border-color: rgba(251, 191, 36, 0.4);
    color: #f59e0b;
  }
  
  .main-controls .btn-trading:active {
    background: rgba(251, 191, 36, 0.2);
    border-color: rgba(251, 191, 36, 0.5);
    color: #d97706;
  }

  /* Spinner animation for trading button */
  .spinner {
    width: 12px;
    height: 12px;
    border: 2px solid transparent;
    border-top: 2px solid currentColor;
    border-radius: 50%;
    display: inline-block;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }
</style>