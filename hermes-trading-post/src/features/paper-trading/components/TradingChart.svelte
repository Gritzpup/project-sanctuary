<script lang="ts">
  import { onDestroy } from 'svelte';
  import Chart from '../../../pages/trading/chart/Chart.svelte';
  import ChartInfo from '../../../pages/trading/chart/components/overlays/ChartInfo.svelte';
  import ChartHeader from './ChartHeader.svelte';
  import ChartControls from './ChartControls.svelte';
  import ChartProgressBar from './ChartProgressBar.svelte';
  import { createEventDispatcher } from 'svelte';
  import { dataStore } from '../../../pages/trading/chart/stores/dataStore.svelte';
  
  let {
    chartRefreshKey = Date.now(),
    selectedPair = 'BTC-USD',
    selectedGranularity = '1m',
    selectedPeriod = '1H',
    chartSpeed = '1x',
    selectedTestDateString = '',
    botTabs = [],
    activeBotInstance = null,
    isRunning = false,
    isPaused = false,
    trades = [],
    isPaperTestRunning = false,
    chartComponent = $bindable(null),
    currentPrice = 0,
    priceChange24h = 0,
    priceChangePercent24h = 0,
    tradingData = null,
    hideProgressBar = false,
    hidePlaybackControls = false
  } = $props();
  
  const dispatch = createEventDispatcher();
  
  
  // Forward test progress state
  let forwardTestProgress = $state(0);
  let isForwardTestRunning = $state(false);
  let forwardTestInterval: number | null = null;
  
  // 🔧 FIX: Use $derived for instant reactive updates from L2 orderbook
  // dataStore.latestPrice updates from L2 orderbook mid-price (fastest possible)
  // Using $derived ensures header price updates instantly with ZERO delay
  let latestPrice = $derived(dataStore.latestPrice || currentPrice || 0);
  let live24hChange = $state(0);
  let live24hPercent = $state(0);
  
  // Fetch live 24-hour Bitcoin data
  async function fetch24hData() {
    try {
      // Use CoinGecko API which has reliable 24h change data
      const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true');
      const data = await response.json();
      
      if (data.bitcoin) {
        const currentPrice = data.bitcoin.usd;
        const percent24h = data.bitcoin.usd_24h_change;
        
        // Calculate absolute change from percentage
        const change24h = (currentPrice * percent24h) / 100;
        
        live24hChange = change24h;
        live24hPercent = percent24h;
        
      }
    } catch (error) {
      console.error('Failed to fetch 24h Bitcoin data:', error);
      // Try backup API
      try {
        const backupResponse = await fetch('https://api.coinbase.com/v2/exchange-rates?currency=BTC');
        const backupData = await backupResponse.json();
      } catch (backupError) {
        console.error('Backup API also failed:', backupError);
      }
    }
  }
  
  // Fetch 24h data on mount and every 5 minutes
  $effect(() => {
    fetch24hData();
    const interval = setInterval(fetch24hData, 5 * 60 * 1000); // 5 minutes
    return () => clearInterval(interval);
  });
  
  // Event handlers
  function handlePairChange(event: CustomEvent) {
    selectedPair = event.detail.pair;
    dispatch('pairChange', event.detail);
  }
  
  function handleGranularityChange(event: CustomEvent) {
    selectedGranularity = event.detail.granularity;
    dispatch('granularityChange', event.detail);
  }
  
  function handlePeriodChange(event: CustomEvent) {
    console.log(`📊 [TradingChart] handlePeriodChange received:`, event.detail);
    selectedPeriod = event.detail.period;
    console.log(`📊 [TradingChart] Updated selectedPeriod to: ${selectedPeriod}`);
    dispatch('periodChange', event.detail);
  }
  
  function handleSpeedChange(event: CustomEvent) {
    chartSpeed = event.detail.speed;
    dispatch('speedChange', event.detail);
  }
  
  function handleDateChange(event: CustomEvent) {
    selectedTestDateString = event.detail.date;
    dispatch('dateChange', event.detail);
  }
  
  function handlePlay() {
    isForwardTestRunning = true;
    dispatch('play');
    simulateForwardTest();
  }
  
  function handlePause() {
    dispatch('pause');
  }
  
  function handleStop() {
    isForwardTestRunning = false;
    forwardTestProgress = 0;
    dispatch('stop');
  }
  
  function handleBotSelect(event: CustomEvent) {
    dispatch('botSelect', event.detail);
  }

  function handleZoomReset() {
    // Call the chart's show60Candles method
    if (chartComponent && chartComponent.show60Candles) {
      chartComponent.show60Candles();
    }
  }
  
  // Simulate forward test progress
  function simulateForwardTest() {
    if (!isForwardTestRunning) return;
    
    // Clear any existing interval
    if (forwardTestInterval) {
      clearInterval(forwardTestInterval);
    }
    
    forwardTestInterval = setInterval(() => {
      if (!isForwardTestRunning || forwardTestProgress >= 100) {
        if (forwardTestInterval) {
          clearInterval(forwardTestInterval);
          forwardTestInterval = null;
        }
        if (forwardTestProgress >= 100) {
          isForwardTestRunning = false;
        }
        return;
      }
      
      const speedMultiplier = parseFloat(chartSpeed.replace('x', ''));
      forwardTestProgress += (0.5 * speedMultiplier);
      
      if (forwardTestProgress > 100) {
        forwardTestProgress = 100;
      }
    }, 100);
  }

  // Cleanup timers on component destroy
  onDestroy(() => {
    if (forwardTestInterval) {
      clearInterval(forwardTestInterval);
      forwardTestInterval = null;
    }
  });
</script>

<div class="panel-base chart-panel">
  <div class="chart-header-wrapper">
    <ChartHeader 
      {selectedPair}
      {selectedGranularity}
      {selectedPeriod}
      currentPrice={latestPrice || currentPrice || 0}
      priceChange24h={live24hChange || priceChange24h || 0}
      priceChangePercent24h={live24hPercent || priceChangePercent24h || 0}
      {botTabs}
      {activeBotInstance}
      on:pairChange={handlePairChange}
      on:granularityChange={handleGranularityChange}
      on:botSelect={handleBotSelect}
      on:zoomReset={handleZoomReset}
    />
  </div>

  {#if !hideProgressBar}
    <ChartProgressBar
      {forwardTestProgress}
      {isForwardTestRunning}
    />
  {/if}

  <!-- ⚡ SEAMLESS REFRESH: Chart handles its own canvas refresh internally -->
  <div class="chart-container">
    <Chart
      bind:this={chartComponent}
      pair={selectedPair}
      granularity={selectedGranularity}
      period={selectedPeriod}
      showControls={false}
      showStatus={false}
      showInfo={false}
      enablePlugins={true}
      defaultPlugins={['volume']}
      {chartRefreshKey}
    />
  </div>

  <ChartControls
    {selectedPeriod}
    {chartSpeed}
    {selectedTestDateString}
    {isRunning}
    {isPaused}
    {tradingData}
    {selectedGranularity}
    {hidePlaybackControls}
    on:periodChange={handlePeriodChange}
    on:granularityChange={handleGranularityChange}
    on:speedChange={handleSpeedChange}
    on:dateChange={handleDateChange}
    on:play={handlePlay}
    on:pause={handlePause}
    on:stop={handleStop}
  />
</div>

<style>
  .chart-panel {
    height: 100%;
    width: 100%;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    max-width: 100%;
    padding: 0;
    margin: 0;
    box-sizing: border-box;
  }
  
  .chart-header-wrapper {
    margin-bottom: 0;
  }

  .chart-container {
    flex: 1;
    position: relative;
    overflow: hidden;
    width: 100%;
    min-width: 0;
    max-width: 100%;
    box-sizing: border-box;
  }

  /* Global styles to fix LightweightCharts layout issues */
  :global(.chart-panel .chart-container .tv-lightweight-charts) {
    width: 100%;
    height: 100%;
    margin: 0;
    padding: 0;
    left: 0;
    right: 0;
    top: 0;
    position: relative;
  }

  :global(.chart-panel .chart-container .tv-lightweight-charts > div) {
    width: 100%;
    margin: 0;
    padding: 0;
    left: 0;
    right: 0;
  }

  :global(.chart-panel .chart-container canvas) {
    width: 100%;
    margin: 0;
    padding: 0;
    left: 0;
    right: 0;
  }

  /* Force chart content to start from absolute left edge */
  :global(.chart-panel .chart-container .tv-lightweight-charts table) {
    margin: 0;
    padding: 0;
    border-spacing: 0;
  }

  :global(.chart-panel .chart-container .tv-lightweight-charts td) {
    margin: 0;
    padding: 0;
  }
</style>