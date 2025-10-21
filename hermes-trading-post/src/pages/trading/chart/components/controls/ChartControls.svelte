<script lang="ts">
  import { onMount } from 'svelte';
  import { chartStore } from '../../stores/chartStore.svelte';
  import PairSelector from './components/PairSelector.svelte';
  import TimeframeControls from './components/TimeframeControls.svelte';
  import GranularityControls from './components/GranularityControls.svelte';
  import SpeedControls from './components/SpeedControls.svelte';
  import ActionButtons from './components/ActionButtons.svelte';
  import { ChartControlsService } from './services/ChartControlsService.svelte';

  // 🚀 PHASE 7.2: Use $props() for Svelte 5 runes mode
  const {
    showTimeframes = true,
    showGranularities = true,
    showRefresh = true,
    showClearCache = true,
    showSpeed = true,
    availableTimeframes = ['1H', '6H', '1D', '1W', '1M', '5Y'],
    availableGranularities = ['1m', '5m', '15m', '30m', '1h', '4h', '1d'],
    pair = 'BTC-USD',
    onPairChange,
    onGranularityChange
  } = $props<{
    showTimeframes?: boolean;
    showGranularities?: boolean;
    showRefresh?: boolean;
    showClearCache?: boolean;
    showSpeed?: boolean;
    availableTimeframes?: string[];
    availableGranularities?: string[];
    pair?: string;
    onPairChange?: (pair: string) => void;
    onGranularityChange?: (granularity: string) => void;
  }>()
  
  // Speed control
  let currentSpeed: string = '1x';
  const availableSpeeds = ['1x', '1.5x', '2x', '3x', '10x'];

  // 🚀 PHASE 7.1: Make granularity reactive for auto-updates during zoom
  // This ensures the GranularityControls button highlights update when granularity escalates
  let currentGranularity = $state(chartStore.config.granularity);
  let currentTimeframe = $state(chartStore.config.timeframe);

  // Subscribe to store changes and update reactive variables
  $effect(() => {
    currentGranularity = chartStore.config.granularity;
    currentTimeframe = chartStore.config.timeframe;
  });

  // Service instance
  let controlsService: ChartControlsService;
  let isRefreshing = false;
  let isClearingCache = false;

  // Event handlers
  function handlePairChange(event: CustomEvent) {
    const { pair: newPair } = event.detail;
    
    if (onPairChange) {
      onPairChange(newPair);
    }
  }

  function handleTimeframeChange(event: CustomEvent) {
    const { timeframe } = event.detail;
    controlsService.handleTimeframeChange(timeframe);
  }

  function handleGranularityChange(event: CustomEvent) {
    const { granularity } = event.detail;
    // Call parent callback first so props update
    if (onGranularityChange) {
      onGranularityChange(granularity);
    }
    // Also update chartStore for internal tracking
    controlsService.handleGranularityChange(granularity);
  }

  function handleSpeedChange(event: CustomEvent) {
    const { speed } = event.detail;
    currentSpeed = speed;
  }

  async function handleRefresh() {
    isRefreshing = true;
    await controlsService.handleRefresh();
    isRefreshing = false;
  }

  async function handleClearCache() {
    isClearingCache = true;
    await controlsService.handleClearCache();
    isClearingCache = false;
  }

  onMount(() => {
    controlsService = new ChartControlsService();
  });
</script>

<div class="chart-controls">
  <PairSelector 
    {pair} 
    on:pairChange={handlePairChange} 
  />
  
  <TimeframeControls
    {currentTimeframe}
    {availableTimeframes}
    {showTimeframes}
    on:timeframeChange={handleTimeframeChange}
  />

  <GranularityControls
    {currentGranularity}
    {currentTimeframe}
    {availableGranularities}
    {showGranularities}
    {onGranularityChange}
    on:granularityChange={handleGranularityChange}
  />
  
  <SpeedControls
    {currentSpeed}
    {availableSpeeds}
    {showSpeed}
    on:speedChange={handleSpeedChange}
  />
  
  <ActionButtons
    {showRefresh}
    {showClearCache}
    {isRefreshing}
    {isClearingCache}
    on:refresh={handleRefresh}
    on:clearCache={handleClearCache}
  />
</div>

<style>
  .chart-controls {
    display: flex;
    align-items: center;
    gap: var(--space-xl);
    padding: var(--space-md);
    background: var(--surface-elevated);
    border-radius: var(--radius-lg);
    flex-wrap: wrap;
  }

  /* Responsive */
  @media (max-width: 768px) {
    .chart-controls {
      padding: var(--space-sm);
      gap: var(--space-md);
    }
  }
</style>