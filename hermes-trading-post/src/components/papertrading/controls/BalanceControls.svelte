<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let balance: number;
  export let vaultBalance: number;
  export let btcVaultBalance: number;
  export let currentPrice: number;

  const dispatch = createEventDispatcher();

  $: btcVaultUsdValue = btcVaultBalance * currentPrice;

  function handleBalanceChange() {
    dispatch('balanceChange', { balance });
  }
</script>

<div class="control-group">
  <label>Account Balances</label>
  <div class="balance-controls-simple">
    <div class="balance-pair">
      <span class="balance-label-inline">USD</span>
      <input 
        type="number" 
        class="input-base input-narrow"
        bind:value={balance}
        min="0"
        step="100"
        placeholder="10000"
        on:change={handleBalanceChange}
      />
    </div>
    
    <div class="balance-pair">
      <span class="balance-label-inline">USDC Vault</span>
      <span class="vault-balance-inline">
        ${vaultBalance.toFixed(2)}
      </span>
    </div>
    
    <div class="balance-pair">
      <span class="balance-label-inline">BTC Vault</span>
      <span class="vault-balance-inline">
        ${btcVaultUsdValue.toFixed(2)}
      </span>
    </div>
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

  .control-group:has(.balance-controls-simple) {
    margin-bottom: 0;
  }

  .control-group label {
    font-size: 13px;
    color: #888;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    font-weight: 500;
  }

  .balance-controls-simple {
    display: flex;
    gap: 24px;
    margin-bottom: 0;
    margin-top: 0;
  }

  .balance-pair {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .balance-label-inline {
    font-size: 14px;
    color: rgba(255, 255, 255, 0.7);
    font-weight: 500;
  }

  .vault-balance-inline {
    padding: 8px 10px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(74, 0, 224, 0.2);
    border-radius: 4px;
    color: #a78bfa;
    font-size: 14px;
    font-family: 'Courier New', monospace;
  }
</style>