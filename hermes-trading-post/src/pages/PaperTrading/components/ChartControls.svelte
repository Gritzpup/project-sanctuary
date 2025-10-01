<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import ChartInfo from '../../trading/chart/components/overlays/ChartInfo.svelte';
  
  export let selectedPeriod = '1H';
  export let chartSpeed = '1x';
  export let selectedTestDateString = '';
  export let isRunning = false;
  export let isPaused = false;
  
  const dispatch = createEventDispatcher();
  
  const periods = ['1H', '2H', '4H', '6H', '12H', '1D'];
  const speeds = ['0.25x', '0.5x', '1x', '2x', '4x', '8x', '16x', '32x'];
  
  function handlePeriodChange(period: string) {
    dispatch('periodChange', { period });
  }
  
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

<div class="chart-controls">
  <div class="controls-grid">
    <!-- Left Column -->
    <div class="left-column">
      <!-- Row 1: Period Buttons -->
      <div class="period-buttons">
        {#each periods as period}
          <button 
            class="btn-base btn-sm btn-timeframe"
            class:active={selectedPeriod === period}
            on:click={() => handlePeriodChange(period)}
          >
            {period}
          </button>
        {/each}
      </div>
      
      <!-- Row 2: Chart Stats -->
      <div class="chart-stats">
        <ChartInfo 
          position="footer"
          showCandleCount={true}
          showTimeRange={false}
          showClock={true}
          showPerformance={false}
          showLatestPrice={false}
          showLatestCandleTime={false}
          showCandleCountdown={true}
          tradingStatus={{isRunning, isPaused}}
        />
      </div>
    </div>
    
    <!-- Separator -->
    <div class="controls-separator"></div>
    
    <!-- Right Column -->
    <div class="right-column">
      <!-- Row 1: Date, Controls -->
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
          {#each speeds as speed}
            <option value={speed}>{speed} Speed   </option>
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
            <div class="progress-bar" style="width: {(isRunning && !isPaused) ? '75%' : '0%'}"></div>
          </div>
          <!-- Percentage Readout -->
          <div class="progress-percentage">
            {(isRunning && !isPaused) ? '75%' : '0%'}
          </div>
        </div>
      </div>
    </div>
  </div>
</div>

<style>
  .chart-controls {
    padding: var(--space-sm);
    background: var(--surface-elevated);
    border-top: 1px solid var(--border-primary);
    border-bottom: 1px solid var(--border-primary);
  }
  
  .controls-grid {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    gap: var(--space-md);
    align-items: center;
    grid-template-rows: auto auto;
    justify-items: center;
    width: 100%;
    max-width: 100%;
    box-sizing: border-box;
  }
  
  .controls-separator {
    width: 2px;
    height: 80px;
    background: var(--border-primary);
    opacity: 1;
    border-radius: 1px;
    justify-self: center;
    margin-top: 8px;
  }
  
  .left-column {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
    align-items: center;
    justify-content: center;
    justify-self: end;
  }
  
  .right-column {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
    align-items: center;
    justify-content: flex-start;
    justify-self: start;
    padding-top: var(--space-sm);
  }
  
  .period-buttons {
    display: flex;
    gap: var(--space-sm);
  }
  
  .chart-stats {
    display: flex;
    align-items: flex-start;
    margin-top: var(--space-sm);
  }
  
  .chart-stats :global(.clock) {
    margin-left: 0 !important;
  }
  
  .control-row {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
  }
  
  .playback-controls {
    display: flex;
    flex-direction: column;
    gap: 0;
  }
  
  .second-row-controls {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
  }
  
  /* Consistent sizing for all controls */
  .btn-timeframe,
  .btn-icon,
  .input-base,
  .speed-dropdown {
    height: 32px;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-medium);
    border: 1px solid var(--border-primary);
    background: var(--bg-primary);
    color: #c4b5fd;
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 40px;
    transition: all 0.2s ease;
  }

  .btn-timeframe.active {
    background: rgba(74, 0, 224, 0.4);
    color: white;
    border-color: rgba(74, 0, 224, 0.7);
    box-shadow: inset 0 2px 4px rgba(74, 0, 224, 0.5);
    font-weight: 600;
  }

  .btn-timeframe:hover {
    background: rgba(74, 0, 224, 0.2);
    border-color: rgba(74, 0, 224, 0.5);
    color: white;
  }
  
  .speed-dropdown {
    min-width: 125px;
    appearance: none;
    background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%23ffffff' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e");
    background-position: right 8px center;
    background-repeat: no-repeat;
    background-size: 16px;
    padding-right: 32px;
  }
  
  .input-base {
    min-width: 120px;
  }
  
  /* Make calendar icon white */
  .input-base[type="date"]::-webkit-calendar-picker-indicator {
    filter: invert(1);
    cursor: pointer;
  }
  
  .input-base[type="date"]::-moz-calendar-picker-indicator {
    filter: invert(1);
    cursor: pointer;
  }
  
  /* Ensure period buttons are consistent */
  .period-buttons .btn-timeframe {
    min-width: 45px;
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
  
</style>