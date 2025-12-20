<script lang="ts">
  /**
   * TimeframeControls Wrapper - PaperTrading Page
   * Delegates to shared unified component
   *
   * Phase 4: Component Consolidation
   * This file now serves as a thin wrapper that uses the shared TimeframeControls component.
   * It maintains backward compatibility with existing imports.
   */

  import { EXTENDED_PERIODS, type ExtendedPeriod, isCompatible, getBestGranularityForPeriod } from '../../../../lib/chart/TimeframeCompatibility';
  import SharedTimeframeControls from '../../../../components/shared/controls/TimeframeControls.svelte';

  export let selectedPeriod: string = '1H';
  export let selectedGranularity: string = '1m';

  function checkGranularityCompatibility(currentGranularity: string, period: string): string | null {
    if (!isCompatible(currentGranularity, period)) {
      return getBestGranularityForPeriod(period as ExtendedPeriod);
    }
    return null;
  }

  function handleTimeframeChange(event: any) {
    selectedPeriod = event.detail.timeframe;
    // Dispatch event for backward compatibility
    dispatch('periodChange', { period: selectedPeriod });
  }

  function handleGranularityChange(event: any) {
    selectedGranularity = event.detail.granularity;
    // Dispatch event for backward compatibility
    dispatch('granularityChange', { granularity: selectedGranularity });
  }

  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher();
</script>

<SharedTimeframeControls
  currentTimeframe={selectedPeriod}
  availableTimeframes={EXTENDED_PERIODS}
  onGranularityCheck={checkGranularityCompatibility}
  debounceMs={200}
  on:timeframeChange={handleTimeframeChange}
  on:granularityChange={handleGranularityChange}
/>