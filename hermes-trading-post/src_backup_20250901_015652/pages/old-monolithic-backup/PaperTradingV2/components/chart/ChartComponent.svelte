<script lang="ts">
  import TradingChart from './TradingChart.svelte';
  import ChartControls from './ChartControls.svelte';
  import { createEventDispatcher } from 'svelte';
  import { chartPreferencesStore } from '../../../../stores/chartPreferencesStore';
  import type { ChartDataFeed } from '../../../../services/chartDataFeed';

  // Props
  export let currentPrice: number = 0;
  export let connectionStatus: 'connected' | 'disconnected' | 'error' | 'loading' = 'loading';
  export let trades: Array<{timestamp: number, type: string, price: number}> = [];
  export let isRunning: boolean = false;
  export let isPaperTestRunning: boolean = false;
  export let isPaperTestMode: boolean = false;
  export let paperTestSimTime: Date | null = null;
  export let paperTestDate: Date | null = null;
  export let paperTestPlaybackSpeed: number = 1;
  export let paperTestIsPaused: boolean = false;
  export let currentStrategy: any = null;
  export let preferencesKey: string = 'default';

  // Internal state
  let selectedGranularity: string;
  let selectedPeriod: string;
  let autoGranularityActive: boolean = false;
  let selectedTestDate: Date | null = paperTestDate;
  let showSpeedDropdown: boolean = false;

  // Chart component references
  let tradingChartComponent: TradingChart;

  const dispatch = createEventDispatcher();

  // Load saved chart preferences
  const savedPrefs = chartPreferencesStore.getPreferences(preferencesKey);
  selectedGranularity = savedPrefs.granularity;
  selectedPeriod = savedPrefs.period;

  // Save preferences when they change
  $: if (selectedGranularity && selectedPeriod) {
    chartPreferencesStore.setPreferences(preferencesKey, selectedGranularity, selectedPeriod);
  }

  // Sync with external paperTestDate changes
  $: if (paperTestDate !== selectedTestDate) {
    selectedTestDate = paperTestDate;
  }

  // Handle granularity change from controls
  function handleGranularityChange(event: CustomEvent) {
    const { granularity } = event.detail;
    selectedGranularity = granularity;
    autoGranularityActive = true;
    
    setTimeout(() => {
      autoGranularityActive = false;
    }, 2000);

    dispatch('granularityChange', { granularity });
  }

  // Handle granularity change from chart (auto-adjustment)
  function handleChartGranularityChange(event: CustomEvent) {
    const { granularity } = event.detail;
    if (selectedGranularity !== granularity) {
      selectedGranularity = granularity;
      autoGranularityActive = true;
      
      setTimeout(() => {
        autoGranularityActive = false;
      }, 2000);
    }
    dispatch('granularityChange', { granularity });
  }

  // Handle period change
  function handlePeriodChange(event: CustomEvent) {
    const { period, granularity } = event.detail;
    selectedPeriod = period;
    if (granularity !== selectedGranularity) {
      selectedGranularity = granularity;
    }
    dispatch('periodChange', { period, granularity });
  }

  // Handle date change
  function handleDateChange(event: CustomEvent) {
    const { date } = event.detail;
    selectedTestDate = date;
    dispatch('dateChange', { date });
  }

  // Handle speed dropdown toggle
  function handleToggleSpeedDropdown() {
    showSpeedDropdown = !showSpeedDropdown;
  }

  // Handle speed change
  function handleSpeedChange(event: CustomEvent) {
    const { speed } = event.detail;
    showSpeedDropdown = false;
    dispatch('speedChange', { speed });
  }

  // Handle paper test controls
  function handleStartPaperTest() {
    dispatch('startPaperTest');
  }

  function handlePausePaperTest() {
    dispatch('pausePaperTest');
  }

  function handleResumePaperTest() {
    dispatch('resumePaperTest');
  }

  function handleStopPaperTest() {
    dispatch('stopPaperTest');
  }

  // Handle data feed ready
  function handleDataFeedReady(event: CustomEvent) {
    dispatch('dataFeedReady', event.detail);
  }

  // Handle chart ready
  function handleChartReady(event: CustomEvent) {
    dispatch('chartReady', event.detail);
  }

  // Expose chart methods
  export function resetChartZoom() {
    if (tradingChartComponent) {
      tradingChartComponent.resetZoom();
    }
  }

  export function getChartInstance() {
    return tradingChartComponent?.getChartInstance();
  }

  export function getCandleSeriesInstance() {
    return tradingChartComponent?.getCandleSeriesInstance();
  }

  export function getChartDataFeed(): ChartDataFeed | null {
    return tradingChartComponent?.getChartDataFeed() || null;
  }
</script>

<div class="chart-component">
  <TradingChart
    bind:this={tradingChartComponent}
    {currentPrice}
    {connectionStatus}
    {selectedGranularity}
    {selectedPeriod}
    {trades}
    {isPaperTestRunning}
    {isPaperTestMode}
    {paperTestSimTime}
    paperTestDate={selectedTestDate}
    {isRunning}
    {autoGranularityActive}
    {currentStrategy}
    on:granularityChange={handleChartGranularityChange}
    on:dataFeedReady={handleDataFeedReady}
    on:chartReady={handleChartReady}
  >
    <svelte:fragment slot="granularity-controls">
      <ChartControls
        {selectedGranularity}
        {selectedPeriod}
        {isRunning}
        {isPaperTestRunning}
        {paperTestPlaybackSpeed}
        {showSpeedDropdown}
        selectedTestDate={selectedTestDate}
        {paperTestIsPaused}
        on:granularityChange={handleGranularityChange}
        on:periodChange={handlePeriodChange}
        on:dateChange={handleDateChange}
        on:toggleSpeedDropdown={handleToggleSpeedDropdown}
        on:speedChange={handleSpeedChange}
        on:startPaperTest={handleStartPaperTest}
        on:pausePaperTest={handlePausePaperTest}
        on:resumePaperTest={handleResumePaperTest}
        on:stopPaperTest={handleStopPaperTest}
        granularityOnly={true}
      />
    </svelte:fragment>
    
    <svelte:fragment slot="period-controls">
      <ChartControls
        {selectedGranularity}
        {selectedPeriod}
        {isRunning}
        {isPaperTestRunning}
        {paperTestPlaybackSpeed}
        {showSpeedDropdown}
        selectedTestDate={selectedTestDate}
        {paperTestIsPaused}
        on:granularityChange={handleGranularityChange}
        on:periodChange={handlePeriodChange}
        on:dateChange={handleDateChange}
        on:toggleSpeedDropdown={handleToggleSpeedDropdown}
        on:speedChange={handleSpeedChange}
        on:startPaperTest={handleStartPaperTest}
        on:pausePaperTest={handlePausePaperTest}
        on:resumePaperTest={handleResumePaperTest}
        on:stopPaperTest={handleStopPaperTest}
        periodOnly={true}
      />
    </svelte:fragment>
  </TradingChart>
</div>

<style>
  .chart-component {
    width: 100%;
    height: 100%;
  }
</style>