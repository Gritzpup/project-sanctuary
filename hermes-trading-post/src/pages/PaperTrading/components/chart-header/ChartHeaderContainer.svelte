<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import PriceDisplay from '../PriceDisplay.svelte';
  import BotTabs from './BotTabs.svelte';
  import HeaderControls from './HeaderControls.svelte';
  import MobileHeaderDragHandler from './MobileHeaderDragHandler.svelte';
  import type { ChartHeaderProps } from './ChartHeaderTypes';
  
  export let selectedPair: string = 'BTC-USD';
  export let currentPrice: number = 0;
  export let priceChange24h: number = 0;
  export let priceChangePercent24h: number = 0;
  export let botTabs: any[] = [];
  export let activeBotInstance: any = null;
  export let selectedGranularity: string = '1m';
  export let selectedPeriod: string = '1H';
  
  const dispatch = createEventDispatcher();
  
  let headerRow2: HTMLElement;
  let mobileHeaderDragHandler: MobileHeaderDragHandler;

  // Forward all events from child components
  function forwardEvent(event: CustomEvent) {
    dispatch(event.type, event.detail);
  }
</script>

<div class="chart-header">
  <!-- Row 1: Price Display and Bot Tabs -->
  <div class="header-row-1">
    <div class="price-section">
      <PriceDisplay 
        {currentPrice}
        {priceChange24h}
        {priceChangePercent24h}
      />
    </div>
    
    <div class="bot-section">
      <BotTabs 
        {botTabs}
        {activeBotInstance}
        on:botSelect={forwardEvent}
      />
    </div>
  </div>
  
  <!-- Row 2: Controls with Mobile Drag Support -->
  <MobileHeaderDragHandler bind:this={mobileHeaderDragHandler} {headerRow2} on:dragStart on:dragMove on:dragEnd>
    <div 
      class="header-row-2" 
      bind:this={headerRow2}
      on:mousedown={mobileHeaderDragHandler?.handleHeaderDragStart}
      on:mousemove={mobileHeaderDragHandler?.handleHeaderDragMove}
      on:mouseup={mobileHeaderDragHandler?.handleHeaderDragEnd}
      on:mouseleave={mobileHeaderDragHandler?.handleHeaderDragEnd}
      on:touchstart={mobileHeaderDragHandler?.handleHeaderDragStart}
      on:touchmove={mobileHeaderDragHandler?.handleHeaderDragMove}
      on:touchend={mobileHeaderDragHandler?.handleHeaderDragEnd}
    >
      <HeaderControls 
        {selectedPair}
        {selectedGranularity}
        {selectedPeriod}
        on:pairChange={forwardEvent}
        on:granularityChange={forwardEvent}
        on:zoomReset={forwardEvent}
      />
      
      <div class="bot-section">
        <BotTabs 
          {botTabs}
          {activeBotInstance}
          on:botSelect={forwardEvent}
        />
      </div>
    </div>
  </MobileHeaderDragHandler>
</div>

<style>
  .chart-header {
    background: var(--surface-elevated);
    border-bottom: 1px solid var(--border-primary);
    padding: var(--space-sm);
    box-sizing: border-box;
  }

  .header-row-1 {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--space-sm);
    margin-left: var(--space-sm);
  }

  .header-row-2 {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--space-md);
    margin-bottom: var(--space-xs);
    margin-left: var(--space-sm);
  }

  .price-section {
    flex: 1;
  }

  .bot-section {
    flex-shrink: 0;
  }

  /* Mobile responsive adjustments */
  @media (max-width: 768px) {
    .chart-header {
      padding: var(--space-xs);
    }
    
    .header-row-1 {
      margin-bottom: var(--space-xs);
    }
    
    .header-row-2 {
      overflow-x: auto;
      overflow-y: hidden;
      scroll-behavior: smooth;
      scrollbar-width: none; /* Firefox */
      -ms-overflow-style: none; /* IE/Edge */
      cursor: grab;
      gap: var(--space-sm);
    }
    
    .header-row-2::-webkit-scrollbar {
      display: none; /* Chrome/Safari */
    }
    
    .header-row-2:active {
      cursor: grabbing;
    }
    
    /* Hide bot tabs in row 2 on mobile to avoid duplication */
    .header-row-2 .bot-section {
      display: none;
    }
  }

  /* Desktop: Hide bot tabs in row 1 */
  @media (min-width: 769px) {
    .header-row-1 .bot-section {
      display: none;
    }
  }
</style>