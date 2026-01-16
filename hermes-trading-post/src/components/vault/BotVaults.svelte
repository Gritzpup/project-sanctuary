<script lang="ts">
  // @ts-nocheck - VaultService module path compatibility
  import type { BotVault } from '../../services/vaultService';
  import { createEventDispatcher } from 'svelte';
  
  export let botVaults: BotVault[] = [];
  export let selectedBot: string | null = null;
  
  const dispatch = createEventDispatcher();
  
  function formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  }
  
  function formatPercent(value: number): string {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(2)}%`;
  }
  
  function selectBot(botId: string) {
    selectedBot = selectedBot === botId ? null : botId;
    dispatch('botSelect', { botId: selectedBot });
  }
</script>

<div class="bots-grid">
  {#if botVaults.length === 0}
    <div class="no-bots">
      <p>No active bot vaults</p>
      <p class="hint">Start a trading bot to see vault allocations</p>
    </div>
  {:else}
    {#each botVaults as bot}
      <button
        type="button"
        class="bot-vault-card"
        class:selected={selectedBot === bot.botId}
        on:click={() => selectBot(bot.botId)}
      >
        <div class="bot-header">
          <h4>{bot.botName}</h4>
          <span class="bot-status" class:running={bot.status === 'running'} class:paused={bot.status === 'paused'}>
            {bot.status}
          </span>
        </div>
        
        <div class="bot-details">
          <div class="bot-metric">
            <span class="label">Strategy:</span>
            <span class="value">{bot.strategy}</span>
          </div>
          
          <div class="bot-metric">
            <span class="label">BTC:</span>
            <span class="value">{bot.btcBalance.toFixed(6)}</span>
          </div>
          
          <div class="bot-metric">
            <span class="label">USD:</span>
            <span class="value">{formatCurrency(bot.usdBalance)}</span>
          </div>
          
          <div class="bot-metric">
            <span class="label">Total Value:</span>
            <span class="value highlight">{formatCurrency(bot.totalValue)}</span>
          </div>
          
          <div class="bot-metric">
            <span class="label">Profit:</span>
            <span class="value" class:positive={bot.profitPercent >= 0} class:negative={bot.profitPercent < 0}>
              {formatPercent(bot.profitPercent)}
            </span>
          </div>
        </div>
      </button>
    {/each}
  {/if}
</div>

<style>
  .bots-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
    gap: 20px;
    padding: 20px 0;
  }

  .no-bots {
    grid-column: 1 / -1;
    text-align: center;
    padding: 60px 20px;
    color: #758696;
  }

  .no-bots p {
    margin: 0 0 10px 0;
    font-size: 18px;
  }

  .no-bots .hint {
    font-size: 14px;
    opacity: 0.7;
  }

  .bot-vault-card {
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(74, 0, 224, 0.3);
    border-radius: 8px;
    padding: 20px;
    cursor: pointer;
    transition: all 0.3s ease;
    /* Button reset styles */
    width: 100%;
    text-align: left;
    font-family: inherit;
    font-size: inherit;
    color: inherit;
  }

  .bot-vault-card:hover {
    background: rgba(255, 255, 255, 0.04);
    border-color: rgba(74, 0, 224, 0.5);
  }

  .bot-vault-card.selected {
    background: rgba(74, 0, 224, 0.1);
    border-color: #4a00e0;
  }

  .bot-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 15px;
  }

  .bot-header h4 {
    margin: 0;
    color: #a78bfa;
    font-size: 16px;
  }

  .bot-status {
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 12px;
    text-transform: uppercase;
    font-weight: 600;
  }

  .bot-status.running {
    background: rgba(38, 166, 154, 0.2);
    color: #26a69a;
  }

  .bot-status.paused {
    background: rgba(255, 169, 77, 0.2);
    color: #ffa94d;
  }

  .bot-details {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .bot-metric {
    display: flex;
    justify-content: space-between;
    font-size: 14px;
  }

  .bot-metric .label {
    color: #758696;
  }

  .bot-metric .value {
    color: #d1d4dc;
    font-weight: 500;
  }

  .bot-metric .value.highlight {
    color: #a78bfa;
    font-weight: 600;
  }

  .bot-metric .value.positive {
    color: #26a69a;
  }

  .bot-metric .value.negative {
    color: #ef5350;
  }
</style>