<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import ChartInfo from '../../../../pages/trading/chart/components/overlays/ChartInfo.svelte';
  import MobileDragHandler from './MobileDragHandler.svelte';
  import TimeframeControls from './TimeframeControls.svelte';
  import PlaybackControls from './PlaybackControls.svelte';
  import HistoricalDataButton from '../../../../pages/trading/chart/components/controls/HistoricalDataButton.svelte';
  import type { ChartControlsProps } from './ChartControlsTypes';
  
  export let selectedPeriod: string = '1H';
  export let chartSpeed: string = '1x';
  export let selectedTestDateString: string = '';
  export let isRunning: boolean = false;
  export let isPaused: boolean = false;
  export let tradingData: { totalReturn?: number } | null = null;
  export let selectedGranularity: string = '1m';
  
  const dispatch = createEventDispatcher();
  
  let controlsGrid: HTMLElement;
  let mobileDragHandler: MobileDragHandler;

  // Forward all events from child components
  function forwardEvent(event: CustomEvent) {
    dispatch(event.type, event.detail);
  }

  // Handle separator click to center the scroll
  function handleSeparatorClick() {
    if (controlsGrid) {
      const maxScroll = controlsGrid.scrollWidth - controlsGrid.clientWidth;
      controlsGrid.scrollTo({
        left: maxScroll / 2,
        behavior: 'smooth'
      });
    }
  }

  function handleSeparatorKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleSeparatorClick();
    }
  }
</script>

<div class="chart-controls">
  <MobileDragHandler bind:this={mobileDragHandler} {controlsGrid} on:dragStart on:dragMove on:dragEnd>
    <div 
      class="controls-grid" 
      bind:this={controlsGrid}
      on:mousedown={mobileDragHandler?.handleDragStart}
      role="toolbar"
      aria-label="Chart controls"
      tabindex="0"
      on:mousemove={mobileDragHandler?.handleDragMove}
      on:mouseup={mobileDragHandler?.handleDragEnd}
      on:mouseleave={mobileDragHandler?.handleDragEnd}
      on:touchstart={mobileDragHandler?.handleDragStart}
      on:touchmove={mobileDragHandler?.handleDragMove}
      on:touchend={mobileDragHandler?.handleDragEnd}
    >
      <!-- Left Column -->
      <div class="left-column">
        <!-- Row 1: Period Buttons -->
        <TimeframeControls 
          {selectedPeriod}
          {selectedGranularity}
          on:periodChange={forwardEvent}
          on:granularityChange={forwardEvent}
        />
        
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
            showTotalPnL={true}
            showTradesCount={true}
            tradingStatus={{isRunning, isPaused}}
            {tradingData}
          />
        </div>
      </div>
      
      <!-- Dual Separator with clickable center -->
      <div class="controls-separator">
        <div class="separator-line left-line"></div>
        <button 
          class="separator-control" 
          on:click={handleSeparatorClick}
          on:keydown={handleSeparatorKeydown}
          aria-label="Center chart controls"
          title="Click to center the chart controls"
        ></button>
        <div class="separator-line right-line"></div>
      </div>
      
      <!-- Right Column -->
      <div class="right-column">
        <PlaybackControls 
          {chartSpeed}
          {selectedTestDateString}
          {isRunning}
          {isPaused}
          on:speedChange={forwardEvent}
          on:dateChange={forwardEvent}
          on:play={forwardEvent}
          on:pause={forwardEvent}
          on:stop={forwardEvent}
        />
        
        <!-- Historical Data Loading -->
        <HistoricalDataButton />
      </div>
    </div>
  </MobileDragHandler>
</div>

<style>
  .chart-controls {
    padding: 0 var(--space-sm);
    background: linear-gradient(to right, rgba(255, 255, 255, 0.02), rgba(0, 0, 0, 0.6));
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
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-self: center;
    align-self: center;
    height: 80px;
    margin-top: var(--space-sm);
    cursor: grab;
    gap: 0px;
  }

  .separator-line {
    width: 2px;
    height: 80px;
    background: var(--border-primary);
    border-radius: 1px;
  }

  .separator-control {
    width: 1px;
    height: 80px;
    background: transparent;
    cursor: pointer;
    transition: all 0.2s ease;
    user-select: none;
    border: none;
    padding: 0;
  }

  .separator-control:hover {
    transform: scale(1.2);
  }

  .separator-control:active {
    transform: scale(0.8);
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
  
  /* Mobile: Enable horizontal scrolling and prevent wrapping */
  @media (max-width: 768px) {
    .controls-grid {
      grid-template-columns: auto auto auto;
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
    
    /* Adjust left column positioning on mobile */
    .chart-controls .left-column {
      margin-top: var(--space-sm);
    }
    
    /* Prevent chart stats from wrapping - keep on single line */
    .chart-controls .chart-stats {
      margin-top: calc(var(--space-sm) - var(--space-xs));
      transform: translateY(-4px);
      white-space: nowrap;
      overflow: visible;
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