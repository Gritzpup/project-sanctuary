<script lang="ts">
  // @ts-nocheck - BotVault optional property access
  import type { BotVault } from '../../../services/state/vaultService';

  export let botVaults: BotVault[];
  export let selectedBot: string | null;

  // Format currency
  function formatCurrency(value: number): string {
    return `$${value.toFixed(2)}`;
  }

  // Format percentage
  function formatPercent(value: number): string {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(2)}%`;
  }

  function selectBot(botId: string) {
    selectedBot = selectedBot === botId ? null : botId;
  }
</script>

<div class="bots-grid">
  {#each botVaults as bot}
    <div 
      class="bot-vault-card" 
      class:selected={selectedBot === bot.botId}
      on:click={() => selectBot(bot.botId)}
      role="button"
      tabindex="0"
      on:keydown={(e) => e.key === 'Enter' && selectBot(bot.botId)}
    >
      <div class="bot-header">
        <h3>{bot.botName}</h3>
        <span class="bot-status" class:running={bot.status === 'running'}>
          {bot.status}
        </span>
      </div>
      <div class="bot-strategy">{bot.strategy}</div>
      <div class="bot-balances">
        <div>{bot.btcBalance.toFixed(6)} BTC</div>
        <div>{formatCurrency(bot.usdBalance)}</div>
      </div>
      <div class="bot-value">{formatCurrency(bot.totalValue)}</div>
      <div class="bot-profit" class:positive={bot.profitPercent >= 0} class:negative={bot.profitPercent < 0}>
        {formatPercent(bot.profitPercent)}
      </div>
    </div>
  {/each}
</div>

<style>
  .bots-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 20px;
  }

  .bot-vault-card {
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(74, 0, 224, 0.3);
    border-radius: 8px;
    padding: 20px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .bot-vault-card:hover {
    background: rgba(255, 255, 255, 0.04);
    border-color: rgba(74, 0, 224, 0.5);
  }

  .bot-vault-card.selected {
    border-color: rgba(74, 0, 224, 0.8);
    background: rgba(74, 0, 224, 0.1);
  }

  .bot-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 10px;
  }

  .bot-header h3 {
    margin: 0;
    font-size: 16px;
    color: #a78bfa;
  }

  .bot-status {
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 11px;
    text-transform: uppercase;
    background: rgba(107, 114, 128, 0.2);
    color: #6b7280;
  }

  .bot-status.running {
    background: rgba(34, 197, 94, 0.2);
    color: #22c55e;
  }

  .bot-strategy {
    font-size: 12px;
    color: #758696;
    text-transform: uppercase;
    margin-bottom: 12px;
  }

  .bot-balances {
    display: flex;
    justify-content: space-between;
    margin-bottom: 8px;
    font-size: 14px;
    color: #9ca3af;
  }

  .bot-value {
    font-size: 18px;
    font-weight: 600;
    color: #d1d4dc;
    margin-bottom: 8px;
  }

  .bot-profit {
    font-size: 16px;
    font-weight: 600;
  }

  .positive {
    color: #22c55e;
  }

  .negative {
    color: #ef4444;
  }
</style>