<script lang="ts">
  import Chart from '../../Chart.svelte';

  export let connectionStatus: 'connected' | 'disconnected' | 'error' | 'loading';
  export let selectedGranularity: string;
  export let selectedPeriod: string;
  export let autoGranularityActive: boolean;
  export let validGranularities: Record<string, string[]>;

  export let onGranularityChange: (granularity: string) => void;
  export let onPeriodChange: (period: string) => void;
  export let onChartGranularityChange: (granularity: string) => void;

  function isGranularityValid(granularity: string, period: string): boolean {
    return validGranularities[period]?.includes(granularity) || false;
  }

  function selectGranularity(granularity: string) {
    if (isGranularityValid(granularity, selectedPeriod)) {
      onGranularityChange(granularity);
    }
  }

  function selectPeriod(period: string) {
    onPeriodChange(period);
  }
</script>

<div class="panel chart-panel position-relative">
  <div class="granularity-transition" class:active={autoGranularityActive}>
    Switching to {selectedGranularity}
  </div>
  <div class="panel-header">
    <h2>BTC/USD Chart</h2>
    <div class="panel-controls">
      <div class="granularity-buttons">
        <button class="granularity-btn" class:active={selectedGranularity === '1m'} class:auto={autoGranularityActive && selectedGranularity === '1m'} class:disabled={!isGranularityValid('1m', selectedPeriod)} on:click={() => selectGranularity('1m')}>1m{autoGranularityActive && selectedGranularity === '1m' ? ' (auto)' : ''}</button>
        <button class="granularity-btn" class:active={selectedGranularity === '5m'} class:auto={autoGranularityActive && selectedGranularity === '5m'} class:disabled={!isGranularityValid('5m', selectedPeriod)} on:click={() => selectGranularity('5m')}>5m{autoGranularityActive && selectedGranularity === '5m' ? ' (auto)' : ''}</button>
        <button class="granularity-btn" class:active={selectedGranularity === '15m'} class:auto={autoGranularityActive && selectedGranularity === '15m'} class:disabled={!isGranularityValid('15m', selectedPeriod)} on:click={() => selectGranularity('15m')}>15m{autoGranularityActive && selectedGranularity === '15m' ? ' (auto)' : ''}</button>
        <button class="granularity-btn" class:active={selectedGranularity === '1h'} class:auto={autoGranularityActive && selectedGranularity === '1h'} class:disabled={!isGranularityValid('1h', selectedPeriod)} on:click={() => selectGranularity('1h')}>1h{autoGranularityActive && selectedGranularity === '1h' ? ' (auto)' : ''}</button>
        <button class="granularity-btn" class:active={selectedGranularity === '6h'} class:auto={autoGranularityActive && selectedGranularity === '6h'} class:disabled={!isGranularityValid('6h', selectedPeriod)} on:click={() => selectGranularity('6h')}>6h{autoGranularityActive && selectedGranularity === '6h' ? ' (auto)' : ''}</button>
        <button class="granularity-btn" class:active={selectedGranularity === '1D'} class:auto={autoGranularityActive && selectedGranularity === '1D'} class:disabled={!isGranularityValid('1D', selectedPeriod)} on:click={() => selectGranularity('1D')}>1D{autoGranularityActive && selectedGranularity === '1D' ? ' (auto)' : ''}</button>
      </div>
      <button class="panel-btn">⛶</button>
    </div>
  </div>
  <div class="panel-content">
    <Chart
      bind:status={connectionStatus}
      granularity={selectedGranularity}
      period={selectedPeriod}
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
    background: rgba(22, 33, 62, 0.3);
    border: 1px solid rgba(74, 0, 224, 0.3);
    border-radius: 8px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  
  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 15px 20px;
    background: rgba(0, 0, 0, 0.3);
    border-bottom: 1px solid rgba(74, 0, 224, 0.2);
  }
  
  .panel-header h2 {
    font-size: 16px;
    margin: 0;
    color: #a78bfa;
  }
  
  .panel-controls {
    display: flex;
    gap: 10px;
  }
  
  .panel-btn {
    background: none;
    border: 1px solid rgba(74, 0, 224, 0.3);
    color: #9ca3af;
    padding: 4px 8px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
    transition: all 0.2s;
  }
  
  .panel-btn:hover {
    background: rgba(74, 0, 224, 0.2);
    color: #a78bfa;
  }
  
  .panel-content {
    flex: 1;
    padding: 0;
    height: calc(100% - 60px);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  
  .chart-panel {
    min-height: 700px;
    flex: 3;
  }
  
  .chart-panel .panel-content > :global(.chart-container) {
    flex: 1;
  }
  
  .granularity-buttons {
    display: flex;
    gap: 2px;
  }
  
  .granularity-btn {
    background: rgba(74, 0, 224, 0.1);
    border: 1px solid rgba(74, 0, 224, 0.3);
    color: #9ca3af;
    padding: 4px 8px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
    transition: all 0.2s;
  }
  
  .granularity-btn:hover {
    background: rgba(74, 0, 224, 0.2);
    color: #a78bfa;
  }
  
  .granularity-btn.active {
    background: rgba(74, 0, 224, 0.4);
    color: #e9d5ff;
    border-color: #a78bfa;
  }
  
  .granularity-btn.disabled {
    opacity: 0.3;
    cursor: not-allowed;
    pointer-events: none;
  }
  
  .granularity-btn.auto {
    position: relative;
    background: linear-gradient(90deg, #3b82f6 0%, #2563eb 100%);
    animation: pulse 2s ease-out;
  }
  
  @keyframes pulse {
    0% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.7); }
    70% { box-shadow: 0 0 0 10px rgba(59, 130, 246, 0); }
    100% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0); }
  }
  
  .period-buttons {
    display: flex;
    gap: 5px;
    justify-content: center;
    padding: 10px;
    background: rgba(0, 0, 0, 0.3);
    border-top: 1px solid rgba(74, 0, 224, 0.2);
  }
  
  .period-btn {
    background: rgba(74, 0, 224, 0.1);
    border: 1px solid rgba(74, 0, 224, 0.3);
    color: #9ca3af;
    padding: 6px 12px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
    transition: all 0.2s;
  }
  
  .period-btn:hover {
    background: rgba(74, 0, 224, 0.2);
    color: #a78bfa;
  }
  
  .period-btn.active {
    background: rgba(74, 0, 224, 0.4);
    color: #e9d5ff;
    border-color: #a78bfa;
  }
  
  .granularity-transition {
    position: absolute;
    top: 60px;
    right: 20px;
    padding: 4px 8px;
    background: rgba(0, 0, 0, 0.7);
    color: white;
    border-radius: 4px;
    font-size: 12px;
    opacity: 0;
    transition: opacity 0.3s ease;
    z-index: 100;
  }
  
  .granularity-transition.active {
    opacity: 1;
  }
</style>