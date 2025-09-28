<script lang="ts">
  import Chart from '../../trading/chart/Chart.svelte';
  import ChartInfo from '../../trading/chart/components/overlays/ChartInfo.svelte';
  import BotTabs from '../BotTabs.svelte';
  import { chartPreferencesStore } from '../../../stores/chartPreferencesStore';
  import { createEventDispatcher } from 'svelte';
  
  export let selectedPair = 'BTC-USD';
  export let selectedGranularity = '1m';
  export let selectedPeriod = '1H';
  export let chartSpeed = '1x';
  export let selectedTestDateString = '';
  export let botTabs: any[] = [];
  export let activeBotInstance: any = null;
  export let isRunning = false;
  export let isPaused = false;
  export let trades: any[] = [];
  export let isPaperTestRunning = false;
  export let chartComponent: any = null;
  
  const dispatch = createEventDispatcher();
  
  // Load saved chart preferences
  const savedPrefs = chartPreferencesStore.getPreferences('paper-trading');
  selectedGranularity = savedPrefs.granularity;
  selectedPeriod = savedPrefs.period;
  
  // Force fix for 1m granularity to always use 1H period
  if (selectedGranularity === '1m' && selectedPeriod !== '1H') {
    selectedPeriod = '1H';
    chartPreferencesStore.setPreferences('paper-trading', selectedGranularity, '1H');
  }
  
  // Save preferences when they change
  $: chartPreferencesStore.setPreferences('paper-trading', selectedGranularity, selectedPeriod);
  
  // Add trade markers to chart when trades update
  $: if (trades.length > 0 && chartComponent) {
    setTimeout(() => addTradeMarkersToChart(), 500);
  }
  
  function addTradeMarkersToChart() {
    if (!chartComponent || !trades || trades.length === 0) return;
    
    try {
      console.log(`Attempting to add ${trades.length} trade markers to chart...`);
      
      const now = Date.now();
      const nowSeconds = Math.floor(now / 1000);
      
      const markers = trades.map((trade, index) => {
        let time = trade.timestamp;
        const originalTime = time;
        
        if (time > 10000000000) {
          time = Math.floor(time / 1000);
        }
        
        console.log(`📊 Trade ${index + 1} timestamp conversion:`);
        console.log(`  - Original: ${originalTime} (${new Date(originalTime).toISOString()})`);
        console.log(`  - Converted: ${time} (${new Date(time * 1000).toISOString()})`);
        
        const marker = {
          time: time,
          position: trade.side === 'buy' ? 'belowBar' : 'aboveBar',
          color: trade.side === 'buy' ? '#26a69a' : '#ef5350',
          shape: trade.side === 'buy' ? 'arrowUp' : 'arrowDown',
          text: '',
          size: 1
        };
        
        return marker;
      });
      
      if (chartComponent && typeof chartComponent.addMarkers === 'function') {
        try {
          chartComponent.addMarkers(markers);
          console.log(`✅ Added ${markers.length} trade markers to chart`);
        } catch (markerError) {
          console.error('Error calling addMarkers:', markerError);
        }
      }
    } catch (error) {
      console.error('Error adding trade markers:', error);
    }
  }
  
  function selectGranularity(granularity: string) {
    selectedGranularity = granularity;
    dispatch('granularityChange', { granularity });
  }

  function selectPeriod(period: string) {
    selectedPeriod = period;
    dispatch('periodChange', { period });
  }
  
  function handlePairChange(newPair: string) {
    selectedPair = newPair;
    dispatch('pairChange', { pair: newPair });
  }
  
  function handleSpeedChange(event: Event) {
    const select = event.target as HTMLSelectElement;
    chartSpeed = select.value;
    dispatch('speedChange', { speed: chartSpeed });
  }
  
  function handleZoomCorrection() {
    if (chartComponent) {
      chartComponent.fitContent();
    }
  }

  function handleDateSelection(event: Event) {
    const input = event.target as HTMLInputElement;
    selectedTestDateString = input.value;
    dispatch('dateChange', { date: selectedTestDateString });
  }
  
  function handleBotTabSelect(event: CustomEvent) {
    dispatch('botTabSelect', event.detail);
  }
</script>

<div class="panel chart-panel">
  <div class="panel-header">
    <h2>
      <select class="pair-selector" bind:value={selectedPair} on:change={() => handlePairChange(selectedPair)}>
        <option value="BTC-USD">BTC/USD Chart</option>
        <option value="ETH-USD">ETH/USD Chart</option>
        <option value="PAXG-USD">PAXG/USD Chart</option>
      </select>
      {#if isPaperTestRunning}
        <span class="paper-test-indicator">📄 Paper Test Mode</span>
      {/if}
    </h2>
    <div class="header-controls">
      <button class="zoom-btn" on:click={handleZoomCorrection} title="Zoom to fit data">
        🔍
      </button>
      <div class="separator">|</div>
      <div class="granularity-buttons">
        <button class="granularity-btn" class:active={selectedGranularity === '1m'} on:click={() => selectGranularity('1m')}>1m</button>
        <button class="granularity-btn" class:active={selectedGranularity === '5m'} on:click={() => selectGranularity('5m')}>5m</button>
        <button class="granularity-btn" class:active={selectedGranularity === '15m'} on:click={() => selectGranularity('15m')}>15m</button>
        <button class="granularity-btn" class:active={selectedGranularity === '1h'} on:click={() => selectGranularity('1h')}>1h</button>
        <button class="granularity-btn" class:active={selectedGranularity === '6h'} on:click={() => selectGranularity('6h')}>6h</button>
        <button class="granularity-btn" class:active={selectedGranularity === '1D'} on:click={() => selectGranularity('1D')}>1D</button>
      </div>
    </div>
  </div>
  
  {#if botTabs.length > 0}
    <BotTabs
      bots={botTabs}
      activeTabId={activeBotInstance?.id}
      on:selectTab={handleBotTabSelect}
    />
  {/if}
  
  <div class="panel-content">
    <Chart
      bind:this={chartComponent}
      pair={selectedPair}
      granularity={selectedGranularity}
      period={selectedPeriod}
      showControls={false}
      showStatus={true}
      showInfo={false}
      showDebug={false}
      enablePlugins={true}
      defaultPlugins={['volume']}
      onPairChange={handlePairChange}
    />
    <div class="period-buttons">
      <div class="left-column">
        <div class="timeframe-buttons-group">
          <button class="period-btn" class:active={selectedPeriod === '1H'} on:click={() => selectPeriod('1H')}>1H</button>
          <button class="period-btn" class:active={selectedPeriod === '4H'} on:click={() => selectPeriod('4H')}>4H</button>
          <button class="period-btn" class:active={selectedPeriod === '5D'} on:click={() => selectPeriod('5D')}>5D</button>
          <button class="period-btn" class:active={selectedPeriod === '1M'} on:click={() => selectPeriod('1M')}>1M</button>
          <button class="period-btn" class:active={selectedPeriod === '3M'} on:click={() => selectPeriod('3M')}>3M</button>
          <button class="period-btn" class:active={selectedPeriod === '6M'} on:click={() => selectPeriod('6M')}>6M</button>
          <button class="period-btn" class:active={selectedPeriod === '1Y'} on:click={() => selectPeriod('1Y')}>1Y</button>
          <button class="period-btn" class:active={selectedPeriod === '5Y'} on:click={() => selectPeriod('5Y')}>5Y</button>
        </div>
        
        <div class="candle-info-inline">
          <ChartInfo 
            position="footer"
            showCandleCount={true}
            showTimeRange={false}
            showClock={true}
            showPerformance={false}
            showLatestPrice={true}
            showLatestCandleTime={false}
            showCandleCountdown={true}
            tradingStatus={{ isRunning, isPaused }}
          />
        </div>
      </div>
      
      <div class="separator-border"></div>
      
      <div class="right-column">
        <div class="top-row">
          <input 
            type="date" 
            id="paper-test-date-input"
            class="period-btn date-picker-btn"
            max={(() => {
              const yesterday = new Date();
              yesterday.setDate(yesterday.getDate() - 1);
              return yesterday.toISOString().split('T')[0];
            })()}
            min="2024-01-01"
            value={selectedTestDateString}
            on:change={handleDateSelection}
          />
          <button class="period-btn chart-play-btn" title="Start Chart Playback">
            ▶
          </button>
        </div>
        
        <div class="bottom-row">
          <select class="period-btn speed-dropdown" bind:value={chartSpeed} on:change={handleSpeedChange}>
            <option value="1x">1x Speed</option>
            <option value="1.5x">1.5x Speed</option>
            <option value="2x">2x Speed</option>
            <option value="3x">3x Speed</option>
            <option value="10x">10x Speed</option>
          </select>
          <button class="period-btn chart-stop-btn" title="Stop Chart Playback">
            ⏹
          </button>
        </div>
      </div>
    </div>
  </div>
</div>

<style>
  /* Import paper trading styles */
  @import '../../../styles/paper-trading.css';
  
  /* Chart-specific styles */
  .panel.chart-panel {
    border: none !important;
    border-radius: 0 !important;
    background: transparent !important;
  }
  
  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 15px 20px;
    border: 1px solid rgba(74, 0, 224, 0.3);
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px 8px 0 0;
    background: rgba(255, 255, 255, 0.02);
  }
  
  .panel-header h2 {
    margin: 0;
    font-size: 16px;
    color: #a78bfa;
    font-weight: 500;
  }
  
  .pair-selector {
    background: transparent;
    border: none;
    color: #a78bfa;
    font-size: 16px;
    font-weight: 500;
    cursor: pointer;
  }
  
  .header-controls {
    display: flex;
    align-items: center;
    gap: 15px;
  }
  
  .granularity-buttons {
    display: flex;
    gap: 5px;
  }
  
  .zoom-btn {
    background: rgba(74, 0, 224, 0.2);
    border: 1px solid rgba(74, 0, 224, 0.3);
    color: #9ca3af;
    border-radius: 4px;
    padding: 4px 8px;
    cursor: pointer;
    font-size: 12px;
    transition: all 0.2s;
  }
  
  .zoom-btn:hover {
    background: rgba(74, 0, 224, 0.3);
    color: #d1d4dc;
  }
  
  .separator {
    color: rgba(255, 255, 255, 0.3);
    font-size: 14px;
  }
  
  .panel-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    border-left: 1px solid rgba(74, 0, 224, 0.3);
    border-right: 1px solid rgba(74, 0, 224, 0.3);
    background: rgba(255, 255, 255, 0.02);
  }
  
  /* Remove rounded edges from chart */
  :global(.panel-content .chart-container) {
    border-radius: 0 !important;
  }
  
  :global(.panel-content .chart-container .chart-body) {
    border-radius: 0 !important;
  }
  
  /* Ensure the actual TradingView chart canvas doesn't have rounded edges */
  :global(.panel-content canvas),
  :global(.panel-content .tv-lightweight-charts),
  :global(.panel-content .chart-container > *) {
    border-radius: 0 !important;
  }
  
  .period-buttons {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 20px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(74, 0, 224, 0.3);
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 0 0 8px 8px;
    flex-shrink: 0;
    gap: 20px;
    flex-wrap: nowrap;
  }
  
  .left-column {
    display: flex;
    flex-direction: column;
    gap: 8px;
    align-items: flex-end;
    flex-shrink: 1;
    min-width: 0;
  }
  
  .timeframe-buttons-group {
    display: flex;
    gap: 4px;
    flex-wrap: nowrap;
  }
  
  .candle-info-inline {
    color: #888;
    font-size: 12px;
  }
  
  .separator-border {
    width: 1px;
    height: 35px;
    background: rgba(255, 255, 255, 0.3);
    flex-shrink: 0;
  }
  
  .right-column {
    display: flex;
    flex-direction: column;
    gap: 4px;
    align-items: flex-start;
    flex-shrink: 0;
    min-width: 210px;
  }
  
  .top-row {
    display: flex;
    gap: 4px;
    align-items: center;
  }
  
  .bottom-row {
    display: flex;
    gap: 4px;
    align-items: center;
  }
  
  .speed-dropdown {
    min-width: 100px;
    width: 100px;
    height: 20px;
    padding: 1px 4px;
    font-size: 9px;
  }
  
  .date-picker-btn {
    min-width: 100px;
    height: 20px;
    padding: 1px 6px;
    font-size: 9px;
  }
  
  .chart-play-btn,
  .chart-stop-btn {
    width: 100px;
    height: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 8px;
  }
  
  /* Responsive layout for smaller screens */
  @media (max-width: 1200px) {
    .period-buttons {
      gap: 15px;
      padding: 10px 15px;
    }
    
    .right-column {
      min-width: 190px;
    }
    
    .timeframe-buttons-group {
      gap: 3px;
    }
    
    .timeframe-buttons-group .period-btn {
      padding: 3px 6px;
      font-size: 10px;
    }
  }
  
  @media (max-width: 1000px) {
    .period-buttons {
      flex-direction: column;
      gap: 10px;
      align-items: center;
    }
    
    .separator-border {
      display: none;
    }
    
    .left-column,
    .right-column {
      align-items: center;
    }
  }
</style>