<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import StrategySelector from './controls/StrategySelector.svelte';
  import BotStatusGrid from './controls/BotStatusGrid.svelte';
  import TradingStats from './controls/TradingStats.svelte';
  import TradingControlButtons from './controls/TradingControlButtons.svelte';
  
  export let selectedStrategyType: string = 'reverse-descending-grid';
  export let strategies: any[] = [];
  export let isRunning: boolean = false;
  export let isPaused: boolean = false;
  export let balance: number = 10000;
  export let btcBalance: number = 0;
  export let vaultBalance: number = 0;
  export let btcVaultBalance: number = 0;
  export let positions: any[] = [];
  export let currentPrice: number = 0;
  export let botTabs: any[] = [];
  export let activeBotInstance: any = null;

  // Additional stats tracking
  export let totalTrades: number = 0;
  export let startingBalance: number = 10000;
  export let totalFees: number = 0;
  export let totalRebates: number = 0;
  export let nextBuyDistance: number | null = null;
  export let nextSellDistance: number | null = null;
  export let nextBuyPrice: number | null = null;
  export let nextSellPrice: number | null = null;

  const dispatch = createEventDispatcher();

  function handleEvent(event: CustomEvent) {
    dispatch(event.type, event.detail);
  }
</script>

<div class="panel strategy-panel">
  <div class="panel-header">
    <h2>Strategy Controls</h2>
  </div>
  <div class="panel-content">
    <StrategySelector
      {selectedStrategyType}
      {strategies}
      on:strategyChange={handleEvent}
    />
    
    <BotStatusGrid 
      {botTabs} 
      {activeBotInstance} 
      {isRunning} 
      {isPaused}
      on:selectBot={handleEvent}
    />
    
    <TradingStats
      {balance}
      {startingBalance}
      {totalTrades}
      {totalFees}
      {totalRebates}
      {positions}
      {currentPrice}
      {btcBalance}
      {vaultBalance}
      {btcVaultBalance}
      {nextBuyDistance}
      {nextSellDistance}
      {nextBuyPrice}
      {nextSellPrice}
    />
    
    <TradingControlButtons
      {isRunning}
      {isPaused}
      on:start={handleEvent}
      on:pause={handleEvent}
      on:resume={handleEvent}
      on:reset={handleEvent}
      on:stop={handleEvent}
    />
  </div>
</div>

<style>
  .panel {
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(74, 0, 224, 0.3);
    border-radius: 8px;
    overflow: hidden;
  }

  .strategy-panel {
    width: 100%;
    min-width: 350px;
    flex-shrink: 0;
    height: 100%;
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
  }

  .panel-header {
    background: var(--bg-primary-subtle);
    padding: 15px 20px;
    border-bottom: 1px solid var(--border-primary);
  }

  .panel-header h2 {
    margin: 0;
    font-size: 16px;
    color: #a78bfa;
    font-weight: 500;
  }

  /* Remove top spacing on mobile */
  @media (max-width: 768px) {
    .strategy-panel {
      margin-top: 0;
    }
    
    .panel-header {
      padding-top: 15px;
    }
  }

  .panel-content {
    padding: 16px 20px 12px 20px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    flex: 1;
    height: 100%;
    background: linear-gradient(to right, rgba(255, 255, 255, 0.02), rgba(0, 0, 0, 0.6));
  }

  /* Desktop spacing adjustments */
  @media (min-width: 769px) {
    .panel-content {
      gap: 10px;
      padding: 20px 20px 12px 20px;
    }
  }

  /* Responsive adjustments */
  @media (max-width: 1400px) {
    .strategy-panel {
      width: 100%;
      max-width: none;
    }
  }
</style>