<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  
  export let bots: Array<{
    id: string;
    name: string;
    status: 'running' | 'paused' | 'stopped' | 'empty';
    balance?: number;
    profitLoss?: number;
  }> = [];
  export let activeTabId: string;
  
  const dispatch = createEventDispatcher();
  
  function selectTab(botId: string) {
    dispatch('selectTab', { botId });
  }
  
  function getStatusColor(status: string): string {
    switch (status) {
      case 'running': return '#22c55e';
      case 'paused': return '#f59e0b';
      case 'stopped': return '#ef4444';
      default: return '#6b7280';
    }
  }
  
  function getStatusIcon(status: string): string {
    switch (status) {
      case 'running': return '▶';
      case 'paused': return '⏸';
      case 'stopped': return '■';
      default: return '○';
    }
  }
</script>

<div class="bot-tabs">
  {#each bots as bot, i}
    <button 
      class="bot-tab" 
      class:active={activeTabId === bot.id}
      class:first={i === 0}
      class:last={i === bots.length - 1}
      on:click={() => selectTab(bot.id)}
    >
      <span class="bot-name">{bot.name}</span>
      {#if bot.status !== 'empty' && bot.profitLoss !== undefined}
        <span 
          class="profit-indicator" 
          class:positive={bot.profitLoss >= 0}
          class:negative={bot.profitLoss < 0}
        >
          {bot.profitLoss >= 0 ? '+' : ''}{bot.profitLoss.toFixed(0)}%
        </span>
      {/if}
      <span 
        class="status-dot" 
        style="background-color: {getStatusColor(bot.status)}"
        title={bot.status}
      ></span>
    </button>
  {/each}
</div>

<style>
  .bot-tabs {
    display: flex;
    gap: 0;
    margin-bottom: 10px;
    overflow-x: auto;
  }
  
  .bot-tab {
    flex: 1;
    min-width: 60px;
    padding: 4px 8px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(74, 0, 224, 0.3);
    border-radius: 0;
    color: #9ca3af;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    position: relative;
    border-right: none;
  }
  
  .bot-tab:last-child {
    border-right: 1px solid rgba(74, 0, 224, 0.3);
  }
  
  .bot-tab.first {
    border-radius: 4px 0 0 4px;
  }
  
  .bot-tab.last {
    border-radius: 0 4px 4px 0;
  }
  
  .bot-tab:hover {
    background: rgba(74, 0, 224, 0.1);
    color: #d1d4dc;
  }
  
  .bot-tab.active {
    background: rgba(74, 0, 224, 0.3);
    color: #a78bfa;
    z-index: 1;
  }
  
  .bot-name {
    font-weight: 500;
  }
  
  .status-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    flex-shrink: 0;
    margin-left: auto;
  }
  
  .profit-indicator {
    font-weight: 600;
    font-size: 10px;
    margin-left: auto;
  }
  
  .profit-indicator.positive {
    color: #22c55e;
  }
  
  .profit-indicator.negative {
    color: #ef4444;
  }
</style>