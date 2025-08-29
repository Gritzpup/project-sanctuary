<script lang="ts">
  import ChartCore from '../components/chart/core/ChartCore.svelte';
  import ChartControls from '../components/chart/controls/ChartControls.svelte';
  import ChartDataManager from '../components/chart/data/ChartDataManager.svelte';
  import type { IChartApi, ISeriesApi } from 'lightweight-charts';
  import type { CandleData } from '../types/coinbase';
  
  // Export props for compatibility with existing usage
  export let selectedGranularity: string = '1m';
  export let selectedPeriod: string = '1H';
  export let currentPrice: number = 0;
  export let isTradingPage: boolean = false;
  export let isPaperTrading: boolean = false;
  export let showBotTabs: boolean = false;
  export let botTabs: any[] = [];
  export let activeBotId: any = null;
  export let chartInstance: IChartApi | null = null;
  export let candleSeriesInstance: ISeriesApi<'Candlestick'> | null = null;
  
  // Paper test mode props
  export let isPaperTestRunning: boolean = false;
  export let isPaperTestMode: boolean = false;
  export let paperTestSimTime: Date | null = null;
  export let paperTestDate: Date | null = null;
  export let enableZoom: boolean = true;
  export let lockedTimeframe: boolean = false;
  export let autoScroll: boolean = true;
  
  // Trade markers
  export let trades: Array<{timestamp: number, type: string, price: number}> = [];
  
  // Internal state
  let candles: CandleData[] = [];
  let isLoadingChart: boolean = false;
  let status: 'connected' | 'disconnected' | 'error' | 'loading' = 'loading';
  
  // Clock state
  let currentTime = '';
  let countdown = '';
  let clockInterval: number | null = null;
  
  // Update trade markers when trades change
  function updateTradeMarkers() {
    if (!candleSeriesInstance || !trades || trades.length === 0) return;
    
    const markers = trades.map(trade => ({
      time: trade.timestamp > 1000000000000 ? Math.floor(trade.timestamp / 1000) : trade.timestamp,
      position: trade.type === 'buy' ? 'belowBar' : 'aboveBar',
      color: trade.type === 'buy' ? '#26a69a' : '#ef5350',
      shape: trade.type === 'buy' ? 'arrowUp' : 'arrowDown',
      text: `${trade.type.toUpperCase()} @ $${trade.price.toFixed(2)}`
    }));
    
    candleSeriesInstance.setMarkers(markers);
  }
  
  // Update clock
  function updateClock() {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const seconds = now.getSeconds().toString().padStart(2, '0');
    currentTime = `${hours}:${minutes}:${seconds}`;
    
    // Calculate countdown to next candle
    const granularitySeconds = {
      '1m': 60, '5m': 300, '15m': 900,
      '1h': 3600, '6h': 21600, '1D': 86400
    }[selectedGranularity] || 60;
    
    const secondsPassed = (now.getTime() / 1000) % granularitySeconds;
    const secondsRemaining = Math.floor(granularitySeconds - secondsPassed);
    
    const countdownMinutes = Math.floor(secondsRemaining / 60);
    const countdownSeconds = secondsRemaining % 60;
    countdown = `${countdownMinutes}:${countdownSeconds.toString().padStart(2, '0')}`;
  }
  
  // Handle control events
  function handleGranularityChange(event: CustomEvent) {
    selectedGranularity = event.detail.granularity;
  }
  
  function handlePeriodChange(event: CustomEvent) {
    selectedPeriod = event.detail.period;
  }
  
  function handleClearCache() {
    // Clear cache logic here
    console.log('Clearing cache...');
  }
  
  function handleResetZoom() {
    if (chartInstance) {
      chartInstance.timeScale().fitContent();
    }
  }
  
  function handleBotTabSelect(event: CustomEvent) {
    // Forward event to parent
    const customEvent = new CustomEvent('botTabSelect', { detail: event.detail });
    dispatchEvent(customEvent);
  }
  
  // React to trade changes
  $: if (candleSeriesInstance && trades) {
    updateTradeMarkers();
  }
  
  // Start clock updates
  import { onMount, onDestroy } from 'svelte';
  
  onMount(() => {
    updateClock();
    clockInterval = setInterval(updateClock, 1000) as unknown as number;
  });
  
  onDestroy(() => {
    if (clockInterval) {
      clearInterval(clockInterval);
    }
  });
</script>

<div class="chart-wrapper">
  <!-- Chart controls at the top -->
  <ChartControls
    bind:selectedGranularity
    bind:selectedPeriod
    {isLoadingChart}
    {isPaperTestMode}
    {lockedTimeframe}
    on:granularityChange={handleGranularityChange}
    on:periodChange={handlePeriodChange}
    on:clearCache={handleClearCache}
    on:resetZoom={handleResetZoom}
  />
  
  <!-- Bot tabs if enabled -->
  {#if showBotTabs && botTabs.length > 0}
    <div class="bot-tabs">
      {#each botTabs as bot}
        <button 
          class="bot-tab"
          class:active={bot.id === activeBotId}
          on:click={() => handleBotTabSelect({ detail: { botId: bot.id } })}
        >
          {bot.label}
          <span class="bot-status" class:running={bot.status === 'running'}>
            {bot.status}
          </span>
        </button>
      {/each}
    </div>
  {/if}
  
  <!-- Data manager (hidden, manages data) -->
  <div style="display: none;">
    <ChartDataManager
      granularity={selectedGranularity}
      period={selectedPeriod}
      {isPaperTestMode}
      {paperTestDate}
      bind:candles
      bind:isLoading={isLoadingChart}
      bind:status
    />
  </div>
  
  <!-- Main chart -->
  <div class="chart-container">
    <ChartCore
      data={candles}
      {enableZoom}
      {autoScroll}
      bind:chartInstance
      bind:candleSeriesInstance
    />
    
    <!-- Clock overlay -->
    <div class="clock-overlay">
      <div class="clock-time">{currentTime}</div>
      <div class="clock-countdown">Next: {countdown}</div>
    </div>
    
    <!-- Status overlay -->
    <div class="status-overlay" class:connected={status === 'connected'}>
      {status}
    </div>
    
    <!-- Current price overlay -->
    {#if currentPrice > 0}
      <div class="price-overlay">
        ${currentPrice.toFixed(2)}
      </div>
    {/if}
    
    <!-- Paper test overlay -->
    {#if isPaperTestMode}
      <div class="paper-test-overlay">
        <div class="paper-test-label">Paper Test Mode</div>
        {#if paperTestSimTime}
          <div class="paper-test-time">
            Sim Time: {paperTestSimTime.toLocaleString()}
          </div>
        {/if}
      </div>
    {/if}
  </div>
</div>

<style>
  .chart-wrapper {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: #0a0a0a;
  }
  
  .chart-container {
    flex: 1;
    position: relative;
    min-height: 400px;
  }
  
  .bot-tabs {
    display: flex;
    gap: 10px;
    padding: 10px;
    background: rgba(0, 0, 0, 0.5);
    border-bottom: 1px solid rgba(74, 0, 224, 0.3);
  }
  
  .bot-tab {
    padding: 8px 16px;
    background: rgba(74, 0, 224, 0.1);
    border: 1px solid rgba(74, 0, 224, 0.3);
    border-radius: 4px;
    color: #9ca3af;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .bot-tab.active {
    background: rgba(74, 0, 224, 0.3);
    border-color: rgba(74, 0, 224, 0.6);
    color: #a78bfa;
  }
  
  .bot-status {
    margin-left: 8px;
    font-size: 11px;
    opacity: 0.7;
  }
  
  .bot-status.running {
    color: #26a69a;
  }
  
  /* Overlays */
  .clock-overlay {
    position: absolute;
    top: 10px;
    right: 10px;
    background: rgba(0, 0, 0, 0.8);
    padding: 8px 12px;
    border-radius: 4px;
    border: 1px solid rgba(74, 0, 224, 0.3);
    font-size: 12px;
    z-index: 10;
  }
  
  .clock-time {
    color: #a78bfa;
    font-weight: 600;
  }
  
  .clock-countdown {
    color: #758696;
    font-size: 11px;
    margin-top: 2px;
  }
  
  .status-overlay {
    position: absolute;
    top: 10px;
    left: 10px;
    padding: 4px 8px;
    background: rgba(239, 68, 68, 0.2);
    border: 1px solid rgba(239, 68, 68, 0.4);
    border-radius: 4px;
    color: #ef4444;
    font-size: 11px;
    text-transform: uppercase;
    z-index: 10;
  }
  
  .status-overlay.connected {
    background: rgba(34, 197, 94, 0.2);
    border-color: rgba(34, 197, 94, 0.4);
    color: #22c55e;
  }
  
  .price-overlay {
    position: absolute;
    bottom: 10px;
    right: 10px;
    padding: 8px 12px;
    background: rgba(0, 0, 0, 0.8);
    border: 1px solid rgba(74, 0, 224, 0.3);
    border-radius: 4px;
    color: #26a69a;
    font-size: 16px;
    font-weight: 600;
    z-index: 10;
  }
  
  .paper-test-overlay {
    position: absolute;
    top: 50px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(251, 146, 60, 0.2);
    border: 1px solid rgba(251, 146, 60, 0.4);
    border-radius: 4px;
    padding: 8px 16px;
    z-index: 10;
  }
  
  .paper-test-label {
    color: #fb923c;
    font-weight: 600;
    font-size: 12px;
    text-transform: uppercase;
  }
  
  .paper-test-time {
    color: #fed7aa;
    font-size: 11px;
    margin-top: 4px;
  }
</style>