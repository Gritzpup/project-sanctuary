<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { SPEEDS, type Speed } from './ChartControlsTypes';
  
  export let chartSpeed: string = '1x';
  export let selectedTestDateString: string = '';
  export let isRunning: boolean = false;
  export let isPaused: boolean = false;
  
  const dispatch = createEventDispatcher();

  function handleSpeedChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    dispatch('speedChange', { speed: target.value });
  }
  
  function handleDateChange(event: Event) {
    const target = event.target as HTMLInputElement;
    dispatch('dateChange', { date: target.value });
  }

  function handlePlayPause() {
    if (isRunning && !isPaused) {
      dispatch('pause');
    } else {
      dispatch('play');
    }
  }

  function handleStop() {
    dispatch('stop');
  }
</script>

<div class="playback-container">
  <!-- Row 1: Date and Play Controls -->
  <div class="control-row">
    <input 
      type="date" 
      class="input-base"
      value={selectedTestDateString}
      on:change={handleDateChange}
    />
    
    <div class="playback-controls">
      <button 
        class="btn-base btn-icon"
        on:click={handlePlayPause}
      >
        {#if isRunning && !isPaused}⏸{:else}▶{/if}
      </button>
    </div>
  </div>
  
  <!-- Row 2: Speed dropdown and Stop button -->
  <div class="right-row-2">
    <select 
      class="select-base btn-chart-control speed-dropdown"
      value={chartSpeed}
      on:change={handleSpeedChange}
    >
      {#each SPEEDS as speed}
        <option value={speed}>{speed} Speed</option>
      {/each}
    </select>
    
    <div class="stop-button-wrapper">
      <button 
        class="btn-base btn-icon"
        on:click={handleStop}
      >
        ⏹
      </button>
      
      <!-- Progress Bar -->
      <div class="progress-container">
        <div class="progress-bar" style="width: {(selectedTestDateString && isRunning && !isPaused) ? '75%' : '0%'}"></div>
      </div>
      
      <!-- Percentage Readout -->
      <div class="progress-percentage">
        {(selectedTestDateString && isRunning && !isPaused) ? '75%' : '0%'}
      </div>
    </div>
  </div>
</div>

<style>
  .playback-container {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
    align-items: center;
    justify-content: center;
    margin-top: var(--space-sm);
  }
  
  .control-row {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    margin-top: var(--space-sm);
  }
  
  .playback-controls {
    display: flex;
    flex-direction: column;
    gap: 0;
  }
  
  .right-row-2 {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
  }
  
  .stop-button-wrapper {
    position: relative;
    display: inline-block;
  }
  
  /* Consistent sizing for controls */
  .input-base,
  .speed-dropdown {
    height: 32px;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: var(--font-size-sm);
    font-weight: 500;
    border: 1px solid var(--border-primary);
    background: var(--bg-primary);
    color: #c4b5fd;
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 40px;
    transition: all 0.2s ease;
  }

  /* Icon buttons - square and same height as other controls */
  .btn-icon {
    height: 32px;
    min-height: 32px;
    width: 32px;
    min-width: 32px;
    padding: 0;
    border-radius: 4px;
    font-size: 16px;
    font-weight: 500;
    border: 1px solid var(--border-primary);
    background: var(--bg-primary);
    color: #c4b5fd;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
  }
  
  .speed-dropdown {
    min-width: 125px;
    appearance: none;
    background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%23c4b5fd' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e");
    background-position: right 8px center;
    background-repeat: no-repeat;
    background-size: 16px;
    padding-right: 32px;
  }
  
  .input-base {
    min-width: 120px;
  }
  
  /* Make calendar icon purple */
  .input-base[type="date"]::-webkit-calendar-picker-indicator {
    filter: brightness(0) saturate(100%) invert(84%) sepia(25%) saturate(1034%) hue-rotate(208deg) brightness(102%) contrast(96%);
    cursor: pointer;
  }
  
  .input-base[type="date"]::-moz-calendar-picker-indicator {
    filter: brightness(0) saturate(100%) invert(84%) sepia(25%) saturate(1034%) hue-rotate(208deg) brightness(102%) contrast(96%);
    cursor: pointer;
  }
  
  .progress-container {
    position: absolute;
    left: calc(100% + 8px);
    top: 50%;
    transform: translateY(-50%);
    width: 80px;
    height: 6px;
    background: rgba(74, 0, 224, 0.2);
    border-radius: 3px;
    overflow: hidden;
    border: 1px solid rgba(74, 0, 224, 0.3);
  }
  
  .progress-bar {
    height: 100%;
    background: linear-gradient(90deg, #c4b5fd 0%, #a78bfa 50%, #8b5cf6 100%);
    border-radius: 2px;
    transition: width 0.3s ease;
    box-shadow: 0 0 6px rgba(167, 139, 250, 0.4);
  }
  
  .progress-percentage {
    position: absolute;
    left: calc(100% + 8px + 80px + 8px);
    top: 50%;
    transform: translateY(-50%);
    font-size: 11px;
    font-weight: 500;
    color: #c4b5fd;
    min-width: 30px;
    text-align: left;
  }
  
  /* Mobile adjustments */
  @media (max-width: 768px) {
    .input-base,
    .speed-dropdown {
      height: 32px;
      min-height: 32px;
      max-height: 32px;
      box-sizing: border-box;
      line-height: 1;
    }

    /* Ensure icon buttons stay square and proper height on mobile */
    .btn-icon {
      height: 32px;
      width: 32px;
      min-width: 32px;
      max-width: 32px;
      min-height: 32px;
      max-height: 32px;
    }
    
    /* Ensure date input specifically matches */
    .input-base[type="date"] {
      height: 32px;
      padding: 4px 8px;
    }
    
    /* Adjust positioning on mobile */
    .playback-container {
      margin-top: calc(var(--space-sm) - var(--space-xs));
    }
  }
</style>