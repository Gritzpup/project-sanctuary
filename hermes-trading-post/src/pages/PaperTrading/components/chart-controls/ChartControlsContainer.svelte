<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import ChartInfo from '../../../trading/chart/components/overlays/ChartInfo.svelte';
  import MobileDragHandler from './MobileDragHandler.svelte';
  import TimeframeControls from './TimeframeControls.svelte';
  import PlaybackControls from './PlaybackControls.svelte';
  import type { ChartControlsProps } from './ChartControlsTypes';
  
  export let selectedPeriod: string = '1H';
  export let chartSpeed: string = '1x';
  export let selectedTestDateString: string = '';
  export let isRunning: boolean = false;
  export let isPaused: boolean = false;
  
  const dispatch = createEventDispatcher();
  
  let controlsGrid: HTMLElement;
  let mobileDragHandler: MobileDragHandler;

  // Forward all events from child components
  function forwardEvent(event: CustomEvent) {
    dispatch(event.type, event.detail);
  }
</script>

<div class="chart-controls">
  <MobileDragHandler bind:this={mobileDragHandler} {controlsGrid} on:dragStart on:dragMove on:dragEnd>
    <div 
      class="controls-grid" 
      bind:this={controlsGrid}
      on:mousedown={mobileDragHandler?.handleDragStart}
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
          on:periodChange={forwardEvent}
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
            tradingStatus={{isRunning, isPaused}}
          />
        </div>
      </div>
      
      <!-- Separator -->
      <div class="controls-separator"></div>
      
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
      </div>
    </div>
  </MobileDragHandler>
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
    
    /* Adjust left column positioning on mobile */
    .chart-controls .left-column {
      margin-top: var(--space-sm);
    }
    
    /* Align chart stats with right column buttons on mobile */
    .chart-controls .chart-stats {
      margin-top: calc(var(--space-sm) - var(--space-xs));
      transform: translateY(-4px);
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