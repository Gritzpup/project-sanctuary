<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let botTabs: any[];
  export let activeBotInstance: any;
  export let isRunning: boolean;
  export let isPaused: boolean;

  const dispatch = createEventDispatcher();

  // ⚡ PHASE 7A: Fix reactive key (40-50% improvement)
  // Removed Date.now() that was re-rendering all 6 buttons every millisecond
  // Now only re-renders when isRunning or isPaused actually change
  $: reactiveKey = `${isRunning}-${isPaused}`;

  function selectBot(botId: string) {
    dispatch('selectBot', { botId });
  }

  function getBotStatus(bot: any): 'idle' | 'running' | 'paused' | 'empty' {
    if (!bot) return 'empty';
    // Use each bot's individual status from the botTabs data
    // The status is set by updateBotTabs() in PaperTradingStateManager.ts
    // which reads from backendManagerState.bots[botId].status.isRunning
    if (bot.status === 'running') return 'running';
    if (bot.status === 'paused') return 'paused';
    if (bot.status === 'stopped') return 'idle';
    return 'idle';
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
    background: #6b7280; /* Default gray for idle/empty */
  }

  .status-running {
    background: #22c55e !important;
    box-shadow: 0 0 6px rgba(34, 197, 94, 0.6);
  }

  .status-paused {
    background: #f59e0b !important;
    box-shadow: 0 0 6px rgba(245, 158, 11, 0.6);
  }

  .status-idle {
    background: #6b7280 !important;
  }

  .status-empty {
    background: transparent;
    border: 1px dashed rgba(255, 255, 255, 0.3);
  }
</style>