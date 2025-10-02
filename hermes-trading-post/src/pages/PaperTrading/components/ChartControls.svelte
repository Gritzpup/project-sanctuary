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

  // Mobile drag scroll functionality
  let isDragging = false;
  let startX = 0;
  let scrollLeft = 0;
  let controlsGrid: HTMLElement;

  function handleDragStart(event: MouseEvent | TouchEvent) {
    if (window.innerWidth > 768) return; // Only on mobile
    
    isDragging = true;
    const clientX = event instanceof TouchEvent ? event.touches[0].clientX : event.clientX;
    startX = clientX - controlsGrid.offsetLeft;
    scrollLeft = controlsGrid.scrollLeft;
    controlsGrid.style.cursor = 'grabbing';
  }

  function handleDragMove(event: MouseEvent | TouchEvent) {
    if (!isDragging || window.innerWidth > 768) return;
    
    event.preventDefault();
    const clientX = event instanceof TouchEvent ? event.touches[0].clientX : event.clientX;
    const x = clientX - controlsGrid.offsetLeft;
    const walk = (x - startX) * 2; // Scroll speed multiplier
    controlsGrid.scrollLeft = scrollLeft - walk;
  }

  function handleDragEnd() {
    if (!isDragging) return;
    isDragging = false;
    controlsGrid.style.cursor = 'grab';
  }
</script>

<div class="chart-controls">
  <div 
    class="controls-grid" 
    bind:this={controlsGrid}
    on:mousedown={handleDragStart}
    on:mousemove={handleDragMove}
    on:mouseup={handleDragEnd}
    on:mouseleave={handleDragEnd}
    on:touchstart={handleDragStart}
    on:touchmove={handleDragMove}
    on:touchend={handleDragEnd}
  >
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
            <div class="progress-bar" style="width: {(selectedTestDateString && isRunning && !isPaused) ? '75%' : '0%'}"></div>
          </div>
          <!-- Percentage Readout -->
          <div class="progress-percentage">
            {(selectedTestDateString && isRunning && !isPaused) ? '75%' : '0%'}
          </div>
        </div>
      </div>
    </div>
  </div>
</div>

<style>
  .chart-controls {
    padding: 0 var(--space-sm);
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
    align-content: center;
  }
  
  .controls-separator {
    width: 2px;
    height: 80px;
    background: var(--border-primary);
    opacity: 1;
    border-radius: 1px;
    justify-self: center;
    align-self: center;
    cursor: grab;
    margin-top: var(--space-sm);
  }
  
  .controls-separator:active {
    cursor: grabbing;
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
    justify-content: center;
    justify-self: start;
    margin-top: var(--space-sm);
  }
  
  .period-buttons {
    display: flex;
    gap: var(--space-sm);
    margin-top: 12px;
  }
  
  .chart-stats {
    display: flex;
    align-items: center;
    justify-content: center;
    margin-top: 12px;
  }
  
  .chart-controls .chart-stats :global(.clock) {
    margin-left: 0;
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
  
  .second-row-controls {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
  }
  
  /* Consistent sizing for text controls */
  .btn-timeframe,
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
  
  /* Mobile: Enable horizontal scrolling */
  @media (max-width: 768px) {
    .controls-grid {
      overflow-x: auto;
      overflow-y: hidden;
      scroll-behavior: smooth;
      scrollbar-width: none; /* Firefox */
      -ms-overflow-style: none; /* IE/Edge */
      cursor: grab;
    }
    
    .controls-grid::-webkit-scrollbar {
      display: none; /* Chrome/Safari */
    }
    
    .controls-grid:active {
      cursor: grabbing;
    }
    
    .controls-separator {
      cursor: grab;
      user-select: none;
    }
    
    .controls-separator:active {
      cursor: grabbing;
    }
    
    /* Force consistent heights on mobile */
    .btn-timeframe,
    .chart-controls .input-base,
    .chart-controls .speed-dropdown {
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
    .chart-controls .input-base[type="date"] {
      height: 32px;
      padding: 4px 8px;
    }
    
    /* Adjust left column positioning on mobile */
    .chart-controls .left-column {
      margin-top: var(--space-sm);
    }
    
    /* Adjust right column positioning on mobile */
    .chart-controls .right-column {
      margin-top: calc(var(--space-sm) - var(--space-xs));
    }
    
    /* Align chart stats with right column buttons on mobile */
    .chart-controls .chart-stats {
      margin-top: calc(var(--space-sm) - var(--space-xs));
      transform: translateY(-4px);
    }
    
    /* Move timescale buttons up to align with calendar button */
    .period-buttons {
      transform: translateY(-2px);
    }
    
    /* Lower separator on mobile to align with buttons */
    .chart-controls .controls-separator {
      margin-top: calc(var(--space-sm) + var(--space-xs));
    }
  }
  
  /* Desktop: Adjust separator positioning and candle stats alignment */
  @media (min-width: 769px) {
    .chart-controls .controls-separator {
      margin-top: calc(var(--space-sm) + var(--space-xs) + 2px);
    }
    
    .chart-stats {
      transform: translateY(-3px);
    }
  }
</style>