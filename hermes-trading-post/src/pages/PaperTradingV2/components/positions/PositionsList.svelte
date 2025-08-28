<script lang="ts">
  import type { Position } from '../../../strategies/base/StrategyTypes';
  import type { Strategy } from '../../../strategies/base/Strategy';
  import PositionItem from './PositionItem.svelte';

  export let positions: Position[] = [];
  export let currentPrice: number = 0;
  export let currentStrategy: Strategy | null = null;

  // Filter out closed positions (size = 0)
  $: displayPositions = positions.filter(pos => pos.size > 0);
</script>

<div class="panel positions-panel">
  <div class="panel-header">
    <h2>Open Positions</h2>
  </div>
  <div class="panel-content">
    <div class="positions-list">
      {#if displayPositions.length === 0}
        <p class="no-positions">No open positions</p>
      {:else}
        {#each displayPositions as position}
          <PositionItem 
            {position} 
            {currentPrice} 
            {currentStrategy} 
          />
        {/each}
      {/if}
    </div>
  </div>
</div>

<style>
  .panel {
    background: rgba(0, 0, 0, 0.8);
    border: 1px solid rgba(74, 0, 224, 0.3);
    border-radius: 8px;
    overflow: hidden;
  }

  .positions-panel {
    min-height: 200px;
  }

  .panel-header {
    background: rgba(74, 0, 224, 0.1);
    border-bottom: 1px solid rgba(74, 0, 224, 0.3);
    padding: 12px 16px;
  }

  .panel-header h2 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: #fff;
  }

  .panel-content {
    padding: 16px;
    max-height: 400px;
    overflow-y: auto;
  }

  .positions-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .no-positions {
    text-align: center;
    color: #758696;
    padding: 20px;
    margin: 0;
  }
</style>