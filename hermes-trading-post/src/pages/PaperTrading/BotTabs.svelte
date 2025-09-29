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
      <span 
        class="status-dot" 
        style="background-color: {getStatusColor(bot.status)}"
        title={bot.status}
      ></span>
    </button>
  {/each}
</div>

<style>
  :global(.bot-tabs .bot-tab) {
    flex: 1 !important;
    min-width: 60px !important;
    padding: 4px 8px !important;
    background: rgba(255, 255, 255, 0.02) !important;
    border: 1px solid rgba(74, 0, 224, 0.3) !important;
    border-radius: 0 !important;
    color: #9ca3af !important;
    cursor: pointer !important;
    transition: all 0.2s ease !important;
    font-size: 11px !important;
    position: relative !important;
    border-right: none !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    gap: 4px !important;
  }

  :global(.bot-tabs .status-dot) {
    width: 6px !important;
    height: 6px !important;
    border-radius: 50% !important;
    flex-shrink: 0 !important;
    animation: none !important;
  }
  .bot-tabs {
    display: flex;
    gap: 0;
    margin-bottom: 10px;
    overflow-x: auto;
  }
  
  .bot-tabs .bot-tab {
    flex: 1 !important;
    min-width: 60px !important;
    padding: 4px 8px !important;
    background: rgba(255, 255, 255, 0.02) !important;
    border: 1px solid rgba(74, 0, 224, 0.3) !important;
    border-radius: 0 !important;
    color: #9ca3af !important;
    cursor: pointer !important;
    transition: all 0.2s ease !important;
    font-size: 11px !important;
    position: relative !important;
    border-right: none !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    gap: 4px !important;
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
  
  .bot-tabs .status-dot {
    width: 6px !important;
    height: 6px !important;
    border-radius: 50% !important;
    flex-shrink: 0 !important;
    animation: none !important;
  }
</style>