<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  // Props
  export let balance: number = 10000;
  export let btcBalance: number = 0;
  export let vaultBalance: number = 0;
  export let btcVaultBalance: number = 0;
  export let totalReturn: number = 0;
  export let currentPrice: number = 0;
  export let isRunning: boolean = false;
  export let tradesCount: number = 0;

  const dispatch = createEventDispatcher();

  // Editing state
  let isEditingBalance = false;
  let editingBalance = '10000';

  // Calculated values
  $: totalPortfolioValue = balance + (btcBalance * currentPrice) + vaultBalance + btcVaultBalance * currentPrice;
  $: totalPnl = totalPortfolioValue - 10000;
  $: totalPnlPercent = (totalPnl / 10000) * 100;
  $: startingBalanceGrowth = totalPortfolioValue - 10000;

  function startEditingBalance() {
    if (!isRunning) {
      isEditingBalance = true;
      editingBalance = balance.toString();
    }
  }

  function saveBalance() {
    const newBalance = parseFloat(editingBalance);
    if (!isNaN(newBalance) && newBalance > 0) {
      dispatch('balanceUpdate', { balance: newBalance });
      isEditingBalance = false;
    } else {
      // Reset to current balance if invalid
      editingBalance = balance.toString();
      isEditingBalance = false;
    }
  }

  function cancelEditBalance() {
    editingBalance = balance.toString();
    isEditingBalance = false;
  }

  // Update editingBalance when balance prop changes
  $: if (!isEditingBalance) {
    editingBalance = balance.toString();
  }
</script>

<div class="balance-display">
  <div class="balances">
    <!-- First row: USD and BTC balances -->
    <div class="balance-row">
      <div class="balance-item">
        <span class="balance-label">USD Balance:</span>
        {#if isEditingBalance}
          <div class="balance-edit">
            $<input 
              type="number" 
              bind:value={editingBalance} 
              on:keydown={(e) => {
                if (e.key === 'Enter') saveBalance();
                if (e.key === 'Escape') cancelEditBalance();
              }}
              on:blur={saveBalance}
              autofocus
            />
          </div>
        {:else}
          <button 
            class="balance-value" 
            class:editable={!isRunning} 
            on:click={startEditingBalance} 
            type="button"
            disabled={isRunning}
          >
            ${balance.toFixed(2)}
            {#if !isRunning}
              <span class="edit-icon">✏️</span>
            {/if}
          </button>
        {/if}
      </div>
      <div class="balance-item">
        <span class="balance-label">BTC Positions:</span>
        <span class="balance-value">{btcBalance.toFixed(8)} BTC</span>
      </div>
    </div>

    <!-- Second row: Vault balances -->
    <div class="balance-row">
      <div class="balance-item">
        <span class="balance-label">USDC Vault:</span>
        <span class="balance-value vault">${vaultBalance.toFixed(2)}</span>
      </div>
      <div class="balance-item">
        <span class="balance-label">BTC Vault:</span>
        <span class="balance-value vault">{btcVaultBalance.toFixed(8)} BTC (${(btcVaultBalance * currentPrice).toFixed(2)})</span>
      </div>
    </div>

    <!-- Third row: Trading stats -->
    <div class="balance-row">
      <div class="balance-item">
        <span class="balance-label">Total Trades:</span>
        <span class="balance-value">{tradesCount}</span>
      </div>
      <div class="balance-item">
        <span class="balance-label">Total Return:</span>
        <span class="balance-value" class:profit={totalReturn > 0} class:loss={totalReturn < 0}>
          ${totalReturn.toFixed(2)}
        </span>
      </div>
    </div>

    <!-- Fourth row: Portfolio metrics -->
    <div class="balance-row">
      <div class="balance-item">
        <span class="balance-label">Starting Balance Growth:</span>
        <span class="balance-value" class:profit={startingBalanceGrowth > 0} class:loss={startingBalanceGrowth < 0}>
          ${startingBalanceGrowth.toFixed(2)} ({(startingBalanceGrowth/10000*100).toFixed(2)}%)
        </span>
      </div>
      <div class="balance-item">
        <span class="balance-label">Current BTC Price:</span>
        <span class="balance-value">${currentPrice.toFixed(2)}</span>
      </div>
    </div>

    <!-- Summary row -->
    <div class="balance-divider"></div>
    <div class="balance-row">
      <div class="balance-item">
        <span class="balance-label total-label">Total Value:</span>
        <span class="balance-value total">${totalPortfolioValue.toFixed(2)}</span>
      </div>
      <div class="balance-item">
        <span class="balance-label total-label">Total P&L:</span>
        <span class="balance-value total" class:profit={totalPnl > 0} class:loss={totalPnl < 0}>
          ${totalPnl.toFixed(2)} ({totalPnlPercent.toFixed(2)}%)
        </span>
      </div>
    </div>
  </div>
</div>

<style>
  .balance-display {
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(74, 0, 224, 0.3);
    border-radius: 8px;
    padding: 12px;
    margin-bottom: 15px;
    max-height: 280px;
    overflow-y: auto;
  }

  .balances {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .balance-row {
    display: flex;
    gap: 20px;
    margin-bottom: 8px;
  }

  .balance-row:last-child {
    margin-bottom: 0;
  }

  .balance-item {
    flex: 1;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
  }

  .balance-label {
    color: #9ca3af;
    font-size: 13px;
    font-weight: 500;
    white-space: nowrap;
  }

  .balance-label.total-label {
    font-weight: 600;
    color: #a78bfa;
  }

  .balance-value {
    color: #d1d5db;
    font-size: 13px;
    font-weight: 600;
    text-align: right;
    background: none;
    border: none;
    cursor: default;
    padding: 0;
  }

  .balance-value.editable {
    cursor: pointer;
    padding: 2px 4px;
    border-radius: 4px;
    transition: all 0.2s ease;
    position: relative;
  }

  .balance-value.editable:hover:not(:disabled) {
    background: rgba(74, 0, 224, 0.1);
    color: #a78bfa;
  }

  .balance-value.editable:disabled {
    cursor: not-allowed;
    opacity: 0.7;
  }

  .balance-value.total {
    font-size: 14px;
    font-weight: 700;
  }

  .balance-value.vault {
    color: #a78bfa;
  }

  .balance-value.profit {
    color: #22c55e;
  }

  .balance-value.loss {
    color: #ef4444;
  }

  .edit-icon {
    opacity: 0;
    margin-left: 4px;
    font-size: 10px;
    transition: opacity 0.2s ease;
  }

  .balance-value.editable:hover .edit-icon {
    opacity: 0.7;
  }

  .balance-edit {
    display: flex;
    align-items: center;
    gap: 2px;
  }

  .balance-edit input {
    background: rgba(74, 0, 224, 0.2);
    border: 1px solid rgba(74, 0, 224, 0.5);
    border-radius: 4px;
    color: #a78bfa;
    font-size: 13px;
    font-weight: 600;
    padding: 2px 6px;
    width: 80px;
    text-align: right;
  }

  .balance-edit input:focus {
    outline: none;
    border-color: #a78bfa;
    box-shadow: 0 0 0 2px rgba(167, 139, 250, 0.2);
  }

  .balance-divider {
    height: 1px;
    background: rgba(74, 0, 224, 0.3);
    margin: 8px 0;
  }
</style>