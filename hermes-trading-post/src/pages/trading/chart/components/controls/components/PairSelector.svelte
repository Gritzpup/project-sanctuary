<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let pair: string = 'BTC-USD';

  const dispatch = createEventDispatcher();

  function handlePairChange(event: Event) {
    const select = event.target as HTMLSelectElement;
    const newPair = select.value;
    
    dispatch('pairChange', { pair: newPair });
  }
</script>

<div class="control-group">
  <span class="control-label">Pair:</span>
  <select class="pair-dropdown" bind:value={pair} on:change={handlePairChange}>
    <option value="BTC-USD">BTC/USD</option>
    <option value="ETH-USD">ETH/USD</option>
    <option value="PAXG-USD">PAXG/USD</option>
  </select>
</div>

<style>
  .control-group {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .control-label {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-secondary, #666);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .pair-dropdown {
    padding: 6px 12px;
    border: 1px solid #555;
    background: #333;
    color: #9966ff;
    font-size: 13px;
    font-weight: 500;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.2s ease;
    min-width: 90px;
    -webkit-text-fill-color: #9966ff;
    -webkit-appearance: none;
    -moz-appearance: none;
    appearance: none;
  }

  .pair-dropdown:hover {
    background: #444;
    border-color: #666;
  }

  .pair-dropdown:focus {
    outline: none;
    border-color: #2196f3;
    box-shadow: 0 0 0 2px rgba(33, 150, 243, 0.2);
  }

  .pair-dropdown option {
    background: #333;
    color: #9966ff;
    padding: 6px;
    -webkit-text-fill-color: #9966ff;
  }
</style>