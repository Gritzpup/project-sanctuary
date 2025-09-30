<script lang="ts">
  import Chart from '../../trading/chart/Chart.svelte';
  import ChartInfo from '../../trading/chart/components/overlays/ChartInfo.svelte';
  import ChartHeader from './ChartHeader.svelte';
  import ChartControls from './ChartControls.svelte';
  import ChartProgressBar from './ChartProgressBar.svelte';
  import { createEventDispatcher } from 'svelte';
  import { dataStore } from '../../trading/chart/stores/dataStore.svelte';
  
  let {
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
    priceChangePercent24h = 0
  } = $props();
  
  const dispatch = createEventDispatcher();
  
  // Forward test progress state
  let forwardTestProgress = 0;
  let isForwardTestRunning = false;
  
  // Create reactive variable for latest price
  let latestPrice = $state(0);
  let live24hChange = $state(0);
  let live24hPercent = $state(0);
  
  // Set initial price from dataStore and subscribe to updates
  $effect(() => {
    // Set initial price from dataStore
    latestPrice = dataStore.latestPrice || currentPrice || 0;
    console.log('🎯 [TradingChart] Initial price set:', latestPrice);
    
    // Subscribe to data updates for real-time price changes
    const unsubscribe = dataStore.onDataUpdate(() => {
      const newPrice = dataStore.latestPrice;
      if (newPrice && newPrice !== latestPrice) {
        latestPrice = newPrice;
        console.log('🚀 [TradingChart] FAST price update:', newPrice);
      }
    });
    
    return unsubscribe;
  });
  
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
        
        console.log('📊 [TradingChart] 24h data updated:', { 
          currentPrice, 
          change24h: change24h.toFixed(2), 
          percent24h: percent24h.toFixed(2) 
        });
      }
    } catch (error) {
      console.error('Failed to fetch 24h Bitcoin data:', error);
      // Try backup API
      try {
        const backupResponse = await fetch('https://api.coinbase.com/v2/exchange-rates?currency=BTC');
        const backupData = await backupResponse.json();
        console.log('📊 [TradingChart] Using Coinbase as backup, but no 24h data available');
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
    selectedPeriod = event.detail.period;
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
  
  // Simulate forward test progress
  function simulateForwardTest() {
    if (!isForwardTestRunning) return;
    
    const interval = setInterval(() => {
      if (!isForwardTestRunning || forwardTestProgress >= 100) {
        clearInterval(interval);
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
</script>

<div class="panel-base chart-panel">
  <ChartHeader 
    {selectedPair}
    {selectedGranularity}
    currentPrice={latestPrice || currentPrice || 0}
    priceChange24h={live24hChange || priceChange24h || 0}
    priceChangePercent24h={live24hPercent || priceChangePercent24h || 0}
    {botTabs}
    {activeBotInstance}
    on:pairChange={handlePairChange}
    on:granularityChange={handleGranularityChange}
    on:botSelect={handleBotSelect}
  />
  
  <ChartProgressBar 
    {forwardTestProgress}
    {isForwardTestRunning}
  />
  
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
    />
  </div>
  
  <ChartControls 
    {selectedPeriod}
    {chartSpeed}
    {selectedTestDateString}
    {isRunning}
    {isPaused}
    on:periodChange={handlePeriodChange}
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
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  
  .chart-container {
    flex: 1;
    position: relative;
    overflow: hidden;
  }
</style>