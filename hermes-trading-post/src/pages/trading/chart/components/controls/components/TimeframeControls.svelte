<script lang="ts">
  /**
   * TimeframeControls Wrapper - Trading Page
   * Delegates to shared unified component
   *
   * Phase 4: Component Consolidation
   * This file now serves as a thin wrapper that uses the shared TimeframeControls component.
   * It maintains backward compatibility with existing imports and styling.
   */

  import { PERIOD_DISPLAY_NAMES } from '../../../utils/constants';
  import SharedTimeframeControls from '../../../../../../components/shared/controls/TimeframeControls.svelte';
  import { onMount } from 'svelte';

  export let currentTimeframe: string;
  export let availableTimeframes: string[] = ['1H', '6H', '1D', '1W', '1M', '5Y'];
  export let showTimeframes: boolean = true;

  onMount(() => {
    // Component mounted
  });
</script>

{#if showTimeframes}
  <div class="control-group">
    <SharedTimeframeControls
      {currentTimeframe}
      {availableTimeframes}
      displayNames={PERIOD_DISPLAY_NAMES}
      debounceMs={200}
      showLabel={true}
      labelText="Period:"
      on:timeframeChange
    />
  </div>
{/if}

<style>
  .control-group {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
  }
</style>