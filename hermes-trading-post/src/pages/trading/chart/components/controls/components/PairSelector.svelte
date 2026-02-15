<script lang="ts">
  import { onMount } from 'svelte';
  import { createEventDispatcher } from 'svelte';

  export let pair: string = 'BTC-USD';

  const dispatch = createEventDispatcher();

  // Hardcoded fallback if API fetch fails
  const FALLBACK_PAIRS = ['BTC-USD', 'ETH-USD', 'PAXG-USD'];
  let pairs: string[] = FALLBACK_PAIRS;

  onMount(async () => {
    try {
      const res = await fetch('/api/trading/pairs');
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data?.pairs?.length > 0) {
          pairs = json.data.pairs;
        }
      }
    } catch {
      // Use fallback pairs
    }
  });

  function handlePairChange(event: Event) {
    const select = event.target as HTMLSelectElement;
    const newPair = select.value;

    dispatch('pairChange', { pair: newPair });
  }

  function formatPairLabel(p: string): string {
    return p.replace('-', '/');
  }
</script>

<div class="control-group">
  <span class="control-label">Pair:</span>
  <select class="pair-dropdown" bind:value={pair} on:change={handlePairChange}>
    {#each pairs as p}
      <option value={p}>{formatPairLabel(p)}</option>
    {/each}
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
