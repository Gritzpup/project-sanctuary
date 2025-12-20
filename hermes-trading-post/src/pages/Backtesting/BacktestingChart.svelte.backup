<script lang="ts">
  import BacktestChart from '../../components/backtesting/BacktestChart.svelte';
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

