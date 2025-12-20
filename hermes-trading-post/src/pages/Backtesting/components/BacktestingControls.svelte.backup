<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { loadChartData, isGranularityValid, autoSelectGranularity } from '../services/BacktestingDataService.svelte';
  import type { CandleData } from '../../../types/coinbase';

  export let selectedGranularity: string;
  export let selectedPeriod: string;
  export let historicalCandles: CandleData[];
  export let isLoadingChart: boolean;
  export let connectionStatus: 'connected' | 'disconnected' | 'error' | 'loading';

  const dispatch = createEventDispatcher();

  async function selectGranularity(granularity: string) {
    console.log('selectGranularity called:', granularity, 'valid:', isGranularityValid(granularity, selectedPeriod));
    if (isGranularityValid(granularity, selectedPeriod)) {
      selectedGranularity = granularity;
      await loadData(true);
      dispatch('dataUpdated', { historicalCandles, connectionStatus });
    }
  }

  async function selectPeriod(period: string) {
    console.log('selectPeriod called:', period);
    selectedPeriod = period;
    
    // Auto-select valid granularity if current one is invalid
    selectedGranularity = autoSelectGranularity(period, selectedGranularity);
    console.log('Auto-selected granularity:', selectedGranularity);
    
    await loadData(true);
    dispatch('dataUpdated', { historicalCandles, connectionStatus });
  }

  async function loadData(forceReload = false) {
    isLoadingChart = true;
    connectionStatus = 'loading';
    
    try {
      const result = await loadChartData(selectedPeriod, selectedGranularity, forceReload);
      historicalCandles = result.data;
      connectionStatus = result.connectionStatus;
    } catch (error) {
      console.error('Failed to load chart data:', error);
      connectionStatus = 'error';
    } finally {
      isLoadingChart = false;
    }
  }

  export { selectGranularity, selectPeriod, loadData };
</script>

<!-- This component manages data loading but doesn't render UI -->
<!-- Chart and period controls are handled by BacktestingChart component -->