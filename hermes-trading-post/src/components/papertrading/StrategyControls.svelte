<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  
  export let selectedStrategyType: string = 'reverse-ratio';
  export let strategies: any[] = [];
  export let isRunning: boolean = false;
  export let isPaused: boolean = false;
  export let balance: number = 10000;
  export let btcBalance: number = 0;
  export let positions: any[] = [];
  export let currentPrice: number = 0;
  
  const dispatch = createEventDispatcher();
  
  function handleStrategyChange(event: Event) {
    const select = event.target as HTMLSelectElement;
    dispatch('strategyChange', { value: select.value });
  }
  
  function startTrading() {
    dispatch('start');
  }
  
  function stopTrading() {
    dispatch('stop');
  }
  
  function pauseTrading() {
    dispatch('pause');
  }
  
  function resumeTrading() {
    dispatch('resume');
  }
</script>

<div class="panel strategy-panel">
  <div class="panel-header">
    <h2>Strategy Controls</h2>
  </div>
  <div class="panel-content">
    <!-- Strategy selection -->
    <div class="control-group">
      <label for="strategy-select">Strategy</label>
      <select 
        id="strategy-select"
        bind:value={selectedStrategyType}
        on:change={handleStrategyChange}
        disabled={isRunning}
      >
        {#each strategies as strategy}
          <option value={strategy.value}>{strategy.label}</option>
        {/each}
      </select>
    </div>
    
    <!-- Strategy Status -->
    <div class="control-group">
      <label>Status</label>
      <div class="status-indicator" class:running={isRunning} class:paused={isPaused}>
        {#if isRunning}
          {#if isPaused}
            <span class="status-dot paused"></span> Paused
          {:else}
            <span class="status-dot running"></span> Running
          {/if}
        {:else}
          <span class="status-dot idle"></span> Idle
        {/if}
      </div>
    </div>
    
    <!-- Balance display -->
    <div class="control-group">
      <label>USD Balance</label>
      <div class="balance-display">
        ${balance.toFixed(2)}
      </div>
    </div>
    
    <!-- BTC Balance -->
    {#if btcBalance > 0}
      <div class="control-group">
        <label>BTC Balance</label>
        <div class="btc-balance">
          {btcBalance.toFixed(8)} BTC
        </div>
      </div>
    {/if}
    
    <!-- Strategy Info -->
    <div class="control-group">
      <label>Strategy Details</label>
      <div class="strategy-info">
        {#each strategies as strategy}
          {#if strategy.value === selectedStrategyType}
            <div class="strategy-description">{strategy.description}</div>
          {/if}
        {/each}
      </div>
    </div>
    
    <!-- Quick Position Summary -->
    <div class="control-group">
      <label>Positions</label>
      <div class="positions-summary-quick">
        {#if positions.length > 0}
          <span class="positions-count">{positions.length} open</span>
          {#if currentPrice > 0}
            {@const totalPnl = positions.reduce((sum, p) => sum + (currentPrice - p.entryPrice) * p.size, 0)}
            <span class="positions-pnl" class:profit={totalPnl > 0} class:loss={totalPnl < 0}>
              ${totalPnl > 0 ? '+' : ''}{totalPnl.toFixed(2)}
            </span>
          {/if}
        {:else}
          <span class="no-positions-text">No positions</span>
        {/if}
      </div>
    </div>
    
    <!-- Trading Controls (at bottom) -->
    <div class="trading-controls">
      {#if !isRunning}
        <button class="control-btn start-btn" on:click={startTrading}>
          <span class="btn-icon">▶</span>
          Start Trading
        </button>
      {:else if isPaused}
        <button class="control-btn resume-btn" on:click={resumeTrading}>
          <span class="btn-icon">▶</span>
          Resume
        </button>
        <button class="control-btn stop-btn" on:click={stopTrading}>
          <span class="btn-icon">■</span>
          Stop
        </button>
      {:else}
        <button class="control-btn pause-btn" on:click={pauseTrading}>
          <span class="btn-icon">⏸</span>
          Pause
        </button>
        <button class="control-btn stop-btn" on:click={stopTrading}>
          <span class="btn-icon">■</span>
          Stop
        </button>
      {/if}
    </div>
  </div>
</div>

<style>
  /* Component styles are inherited from parent */
</style>