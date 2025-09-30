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
        <button 
          class="btn-base btn-icon"
          on:click={handleStop}
        >
          ⏹
        </button>
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
  }
  
  .controls-separator {
    width: 2px;
    height: 80px;
    background: var(--border-primary);
    opacity: 1;
    border-radius: 1px;
    justify-self: center;
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
    color: var(--text-primary);
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 40px;
  }
  
  .speed-dropdown {
    min-width: 125px;
    appearance: none;
    background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e");
    background-position: right 8px center;
    background-repeat: no-repeat;
    background-size: 16px;
    padding-right: 32px;
  }
  
  .input-base {
    min-width: 120px;
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
  
</style>