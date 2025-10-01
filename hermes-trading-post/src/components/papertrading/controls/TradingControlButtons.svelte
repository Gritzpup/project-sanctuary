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
      <button class="btn-base btn-md btn-warning" on:click={pauseTrading}>
        <span class="btn-icon">⏸</span>
        Pause
      </button>
      <button class="btn-base btn-md btn-error" on:click={resetTrading}>
        <span class="btn-icon">↻</span>
        Reset
      </button>
    {/if}
  </div>
</div>

<style>
  .trading-controls {
    margin-top: auto;
    padding-top: 20px;
    border-top: 1px solid rgba(74, 0, 224, 0.2);
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
    gap: 4px;
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
  
  /* Purple theme styling */
  .main-controls .btn-success {
    background: rgba(74, 0, 224, 0.4);
    color: white;
    border-color: rgba(74, 0, 224, 0.6);
  }
  
  .main-controls .btn-success:hover {
    background: rgba(74, 0, 224, 0.5);
    border-color: rgba(74, 0, 224, 0.7);
  }
  
  .main-controls .btn-error {
    background: rgba(74, 0, 224, 0.2);
    color: #c4b5fd;
    border-color: rgba(74, 0, 224, 0.4);
  }
  
  .main-controls .btn-error:hover {
    background: rgba(74, 0, 224, 0.3);
    border-color: rgba(74, 0, 224, 0.5);
    color: white;
  }
  
  .main-controls .btn-warning {
    background: rgba(74, 0, 224, 0.3);
    color: white;
    border-color: rgba(74, 0, 224, 0.5);
  }
  
  .main-controls .btn-warning:hover {
    background: rgba(74, 0, 224, 0.4);
    border-color: rgba(74, 0, 224, 0.6);
  }
</style>