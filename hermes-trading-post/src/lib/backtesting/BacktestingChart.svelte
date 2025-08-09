<script lang="ts">
  import BacktestChart from '../../components/BacktestChart.svelte';
  import { createEventDispatcher } from 'svelte';
  import type { CandleData } from '../../types/coinbase';
  import type { Trade } from '../../strategies/base/StrategyTypes';
  
  export let historicalCandles: CandleData[] = [];
  export let backtestTrades: Trade[] = [];
  export let selectedGranularity: string;
  export let selectedPeriod: string;
  export let isLoadingChart: boolean;
  export let autoGranularityActive: boolean = false;
  
  const dispatch = createEventDispatcher();
  
  function selectGranularity(granularity: string) {
    dispatch('selectGranularity', { granularity });
  }
  
  function selectPeriod(period: string) {
    dispatch('selectPeriod', { period });
  }
  
  function isGranularityValid(granularity: string, period: string): boolean {
    const validCombos: Record<string, string[]> = {
      '1H': ['1m'],
      '4H': ['1m', '5m'],
      '5D': ['1m', '5m', '15m'],
      '1M': ['5m', '15m', '1h'],
      '3M': ['15m', '1h', '6h'],
      '6M': ['1h', '6h', '1D'],
      '1Y': ['6h', '1D'],
      '5Y': ['1D']
    };
    
    return validCombos[period]?.includes(granularity) || false;
  }
</script>

<div class="panel chart-panel">
  <div class="granularity-transition" class:active={autoGranularityActive}>
    Switching to {selectedGranularity}
  </div>
  <div class="panel-header">
    <h2>BTC/USD Chart {#if isLoadingChart}<span class="loading-indicator">🔄</span>{/if}</h2>
    <div class="chart-controls">
      <div class="granularity-buttons">
        <button 
          class="granularity-btn" 
          class:active={selectedGranularity === '1m'} 
          class:disabled={!isGranularityValid('1m', selectedPeriod)} 
          on:click={() => selectGranularity('1m')}
        >
          1m
        </button>
        <button 
          class="granularity-btn" 
          class:active={selectedGranularity === '5m'} 
          class:disabled={!isGranularityValid('5m', selectedPeriod)} 
          on:click={() => selectGranularity('5m')}
        >
          5m
        </button>
        <button 
          class="granularity-btn" 
          class:active={selectedGranularity === '15m'} 
          class:disabled={!isGranularityValid('15m', selectedPeriod)} 
          on:click={() => selectGranularity('15m')}
        >
          15m
        </button>
        <button 
          class="granularity-btn" 
          class:active={selectedGranularity === '1h'} 
          class:disabled={!isGranularityValid('1h', selectedPeriod)} 
          on:click={() => selectGranularity('1h')}
        >
          1h
        </button>
        <button 
          class="granularity-btn" 
          class:active={selectedGranularity === '6h'} 
          class:disabled={!isGranularityValid('6h', selectedPeriod)} 
          on:click={() => selectGranularity('6h')}
        >
          6h
        </button>
        <button 
          class="granularity-btn" 
          class:active={selectedGranularity === '1D'} 
          class:disabled={!isGranularityValid('1D', selectedPeriod)} 
          on:click={() => selectGranularity('1D')}
        >
          1D
        </button>
      </div>
    </div>
  </div>
  <div class="panel-content">
    {#if isLoadingChart}
      <div class="loading-overlay">
        <div class="loading-spinner"></div>
        <div class="loading-text">Loading chart data...</div>
        {#if selectedPeriod === '5Y'}
          <div class="loading-hint">This may take a few seconds for large datasets</div>
        {/if}
      </div>
    {/if}
    <BacktestChart 
      data={historicalCandles.map(candle => ({
        ...candle,
        time: candle.time > 1000000000000 ? Math.floor(candle.time / 1000) : candle.time
      }))}
      trades={backtestTrades}
    />
    <div class="period-buttons">
      <button class="period-btn" class:active={selectedPeriod === '1H'} on:click={() => selectPeriod('1H')}>1H</button>
      <button class="period-btn" class:active={selectedPeriod === '4H'} on:click={() => selectPeriod('4H')}>4H</button>
      <button class="period-btn" class:active={selectedPeriod === '5D'} on:click={() => selectPeriod('5D')}>5D</button>
      <button class="period-btn" class:active={selectedPeriod === '1M'} on:click={() => selectPeriod('1M')}>1M</button>
      <button class="period-btn" class:active={selectedPeriod === '3M'} on:click={() => selectPeriod('3M')}>3M</button>
      <button class="period-btn" class:active={selectedPeriod === '6M'} on:click={() => selectPeriod('6M')}>6M</button>
      <button class="period-btn" class:active={selectedPeriod === '1Y'} on:click={() => selectPeriod('1Y')}>1Y</button>
      <button class="period-btn" class:active={selectedPeriod === '5Y'} on:click={() => selectPeriod('5Y')}>5Y</button>
    </div>
  </div>
</div>

<style>
  .panel {
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(74, 0, 224, 0.3);
    border-radius: 8px;
    display: flex;
    flex-direction: column;
  }
  
  .chart-panel {
    position: relative;
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  
  .granularity-transition {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: rgba(167, 139, 250, 0.9);
    color: white;
    padding: 10px 20px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 600;
    z-index: 100;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.3s;
  }
  
  .granularity-transition.active {
    opacity: 1;
  }
  
  .panel-header {
    padding: 15px 20px;
    background: rgba(74, 0, 224, 0.1);
    border-bottom: none;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  .panel-header h2 {
    margin: 0;
    font-size: 16px;
    color: #a78bfa;
  }
  
  .loading-indicator {
    font-size: 14px;
    margin-left: 8px;
    display: inline-block;
    animation: spin 1s linear infinite;
  }
  
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  
  .chart-controls {
    display: flex;
    gap: 10px;
  }
  
  .granularity-buttons {
    display: flex;
    gap: 5px;
  }
  
  .granularity-btn {
    padding: 6px 12px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(74, 0, 224, 0.3);
    border-radius: 6px;
    color: #888;
    cursor: pointer;
    font-size: 12px;
    transition: all 0.2s;
  }
  
  .granularity-btn:hover:not(.disabled) {
    background: rgba(74, 0, 224, 0.1);
    border-color: rgba(74, 0, 224, 0.5);
    color: #a78bfa;
  }
  
  .granularity-btn.active {
    background: rgba(74, 0, 224, 0.3);
    border-color: #a78bfa;
    color: #a78bfa;
  }
  
  .granularity-btn.disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }
  
  .panel-content {
    flex: 1;
    position: relative;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }
  
  .loading-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    z-index: 50;
  }
  
  .loading-spinner {
    width: 40px;
    height: 40px;
    border: 3px solid rgba(167, 139, 250, 0.3);
    border-top-color: #a78bfa;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  
  .loading-text {
    margin-top: 15px;
    color: #a78bfa;
    font-size: 14px;
  }
  
  .loading-hint {
    margin-top: 5px;
    color: #888;
    font-size: 12px;
  }
  
  .period-buttons {
    display: flex;
    gap: 5px;
    padding: 15px;
    background: rgba(0, 0, 0, 0.2);
    border-top: 1px solid rgba(74, 0, 224, 0.2);
  }
  
  .period-btn {
    flex: 1;
    padding: 8px 12px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(74, 0, 224, 0.3);
    border-radius: 6px;
    color: #888;
    cursor: pointer;
    font-size: 13px;
    transition: all 0.2s;
  }
  
  .period-btn:hover {
    background: rgba(74, 0, 224, 0.1);
    border-color: rgba(74, 0, 224, 0.5);
    color: #a78bfa;
  }
  
  .period-btn.active {
    background: rgba(74, 0, 224, 0.3);
    border-color: #a78bfa;
    color: #a78bfa;
  }
</style>