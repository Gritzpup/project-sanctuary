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
      class="btn-base btn-xs" 
      class:active={activeTabId === bot.id}
      class:first={i === 0}
      class:last={i === bots.length - 1}
      on:click={() => selectTab(bot.id)}
    >
      <span class="bot-name">{bot.name}</span>
      <span 
        class="status-dot status-{bot.status}" 
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
  
  .btn-xs {
    flex: 1;
    min-width: 60px;
    border-radius: 0;
    position: relative;
    border-right: none;
    gap: 4px;
  }
  
  .btn-xs:last-child {
    border-right: 1px solid var(--border-primary);
  }
  
  .btn-xs.first {
    border-radius: var(--radius-sm) 0 0 var(--radius-sm);
  }
  
  .btn-xs.last {
    border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
  }
  
  .bot-name {
    font-weight: 500;
  }
  
  .status-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    flex-shrink: 0;
    background: #6b7280;
  }

  .status-running {
    background: #10b981;
    box-shadow: 0 0 4px rgba(16, 185, 129, 0.5);
  }

  .status-paused {
    background: #f59e0b;
    box-shadow: 0 0 4px rgba(245, 158, 11, 0.5);
  }

  .status-stopped {
    background: #6b7280;
  }

  .status-empty {
    background: transparent;
    border: 1px dashed rgba(255, 255, 255, 0.3);
  }
</style>