<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { BotTab } from './ChartHeaderTypes';
  
  export let botTabs: BotTab[] = [];
  export let activeBotInstance: any = null;
  
  const dispatch = createEventDispatcher();

  function handleBotSelect(botId: string) {
    dispatch('botSelect', { botId });
  }
</script>

{#if botTabs.length > 0}
  <div class="bot-tabs">
    {#each botTabs as bot}
      <button 
        class="btn-base btn-xs"
        class:active={activeBotInstance?.id === bot.id}
        on:click={() => handleBotSelect(bot.id)}
      >
        {bot.name}
        <span class="status-dot status-{bot.status}"></span>
      </button>
    {/each}
  </div>
{/if}

<style>
  .bot-tabs {
    display: flex;
    gap: var(--space-xs);
  }

  .btn-xs {
    font-size: 11px;
    height: 24px;
    padding: 2px 6px;
    position: relative;
  }

  .status-dot {
    position: absolute;
    top: 2px;
    right: 2px;
    width: 6px;
    height: 6px;
    border-radius: 50%;
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
</style>