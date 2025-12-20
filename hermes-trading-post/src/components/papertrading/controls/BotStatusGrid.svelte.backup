<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let botTabs: any[];
  export let activeBotInstance: any;
  export let isRunning: boolean;
  export let isPaused: boolean;

  const dispatch = createEventDispatcher();

  // Force component re-render when props change
  $: reactiveKey = `${isRunning}-${isPaused}-${Date.now()}`;

  function selectBot(botId: string) {
    dispatch('selectBot', { botId });
  }

  function getBotStatus(bot: any): 'idle' | 'running' | 'paused' | 'empty' {
    if (!bot) return 'empty';
    // For Bot 1 (reverse-descending-grid bot), use the backend status
    if (bot.name === 'Bot 1' || bot.id === 'reverse-descending-grid-bot-1' || bot.id === 'bot-1') {
      const status = isRunning ? (isPaused ? 'paused' : 'running') : 'idle';
      return status;
    }
    return bot.status || 'idle';
  }

  function getStatusColor(status: string): string {
    const color = (() => {
      switch (status) {
        case 'running': return '#22c55e';
        case 'paused': return '#f59e0b';
        default: return '#6b7280'; // Gray for idle/empty/default
      }
    })();
    return color;
  }
</script>

<div class="control-group">
  <h4 class="control-label">Bot Status</h4>
  <div class="bot-status-row">
    {#each Array(6) as _, i (reactiveKey + i)}
      {@const botIndex = i + 1}
      {@const bot = botTabs.find(b => b.name === `Bot ${botIndex}`) || { id: `bot-${botIndex}`, name: `Bot ${botIndex}`, status: 'empty' }}
      {@const status = getBotStatus(bot)}
      {@const statusColor = getStatusColor(status)}
      {@const isActive = activeBotInstance ? (bot.id === activeBotInstance.id) : (botIndex === 1)}
      <button 
        class="btn-base btn-xs btn-compact"
        class:active={isActive}
        class:running={status === 'running'}
        class:paused={status === 'paused'}
        on:click={() => selectBot(bot.id)}
        title="{bot.name} - {status}"
      >
        <span class="bot-number-compact">Bot {botIndex}</span>
        <div 
          class="status-light-compact status-{status}"
        ></div>
      </button>
    {/each}
  </div>
</div>

<style>
  .control-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 0;
    margin-top: 0;
  }

  /* Desktop spacing */
  @media (min-width: 769px) {
    .control-group {
      gap: 12px;
    }
  }

  .control-group .control-label {
    font-size: 13px;
    color: #888;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    font-weight: 500;
    margin: 0 0 8px 0;
  }

  .bot-status-row {
    display: flex;
    gap: 0;
    margin-top: 0;
  }

  .btn-compact {
    border-radius: 0;
    position: relative;
    flex: 1;
  }

  .btn-compact:not(:first-child) {
    border-left: none;
  }

  .btn-compact.running {
    border-color: rgba(34, 197, 94, 0.4);
  }

  .btn-compact.paused {
    border-color: rgba(245, 158, 11, 0.4);
  }

  .btn-compact.running.active {
    background: rgba(34, 197, 94, 0.1);
    border-color: rgba(34, 197, 94, 0.5);
  }

  .btn-compact.paused.active {
    background: rgba(245, 158, 11, 0.1);
    border-color: rgba(245, 158, 11, 0.5);
  }

  .bot-number-compact {
    flex: none;
    font-size: 12px;
  }

  .status-light-compact {
    position: absolute;
    right: 6px;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    flex-shrink: 0;
    box-shadow: 0 0 4px rgba(0, 0, 0, 0.3);
  }
</style>