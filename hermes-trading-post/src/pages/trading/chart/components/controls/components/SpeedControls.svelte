<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let currentSpeed: string = '1x';
  export let availableSpeeds: string[] = ['1x', '1.5x', '2x', '3x', '10x'];
  export let showSpeed: boolean = true;

  const dispatch = createEventDispatcher();

  function handleSpeedChange(event: Event) {
    const select = event.target as HTMLSelectElement;
    currentSpeed = select.value;
    dispatch('speedChange', { speed: select.value });
  }
</script>

{#if showSpeed}
  <div class="control-group">
    <span class="control-label">Speed:</span>
    <select 
      class="speed-dropdown" 
      bind:value={currentSpeed} 
      on:change={handleSpeedChange}
    >
      {#each availableSpeeds as speed}
        <option value={speed}>{speed}</option>
      {/each}
    </select>
  </div>
{/if}

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

  /* Speed Dropdown - Same styling as pair dropdown with high specificity */
  select.speed-dropdown,
  .control-group select.speed-dropdown {
    padding: 6px 12px;
    border: 1px solid #555;
    background: #333;
    color: #9966ff;
    font-size: 13px;
    font-weight: 500;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.2s ease;
    min-width: 60px;
    -webkit-text-fill-color: #9966ff;
    -webkit-appearance: none;
    -moz-appearance: none;
    appearance: none;
  }

  select.speed-dropdown:hover,
  .control-group select.speed-dropdown:hover {
    background: #444;
    border-color: #666;
  }

  select.speed-dropdown:focus,
  .control-group select.speed-dropdown:focus {
    outline: none;
    border-color: #2196f3;
    box-shadow: 0 0 0 2px rgba(33, 150, 243, 0.2);
  }

  .speed-dropdown option {
    background: #333;
    color: #9966ff;
    padding: 6px;
    -webkit-text-fill-color: #9966ff;
  }
</style>