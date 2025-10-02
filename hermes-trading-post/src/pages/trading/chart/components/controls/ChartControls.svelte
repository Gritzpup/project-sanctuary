<script lang="ts">
  import { onMount } from 'svelte';
  import { chartStore } from '../../stores/chartStore.svelte';
  import PairSelector from './components/PairSelector.svelte';
  import TimeframeControls from './components/TimeframeControls.svelte';
  import GranularityControls from './components/GranularityControls.svelte';
  import SpeedControls from './components/SpeedControls.svelte';
  import ActionButtons from './components/ActionButtons.svelte';
  import { ChartControlsService } from './services/ChartControlsService.svelte';
  
  export let showTimeframes: boolean = true;
  export let showGranularities: boolean = true;
  export let showRefresh: boolean = true;
  export let showClearCache: boolean = true;
  export let showSpeed: boolean = true;
  export let availableTimeframes: string[] = ['1H', '6H', '1D', '1W', '1M'];
  export let availableGranularities: string[] = ['1m', '5m', '15m', '30m', '1h', '4h', '1d'];
  export let pair: string = 'BTC-USD';
  export let onPairChange: ((pair: string) => void) | undefined = undefined;
  
  // Speed control
  let currentSpeed: string = '1x';
  const availableSpeeds = ['1x', '1.5x', '2x', '3x', '10x'];
  
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
    currentTimeframe={chartStore.config.timeframe}
    {availableTimeframes}
    {showTimeframes}
    on:timeframeChange={handleTimeframeChange}
  />
  
  <GranularityControls
    currentGranularity={chartStore.config.granularity}
    currentTimeframe={chartStore.config.timeframe}
    {availableGranularities}
    {showGranularities}
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