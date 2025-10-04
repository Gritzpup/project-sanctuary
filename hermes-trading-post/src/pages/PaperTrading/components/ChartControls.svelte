<script lang="ts">
  import ChartControlsContainer from './chart-controls/ChartControlsContainer.svelte';
  
  export let selectedPeriod = '1H';
  export let chartSpeed = '1x';
  export let selectedTestDateString = '';
  export let isRunning = false;
  export let isPaused = false;
  export let tradingData = null;
  export let selectedGranularity = '1m';
</script>

<ChartControlsContainer 
  {selectedPeriod}
  {chartSpeed}
  {selectedTestDateString}
  {isRunning}
  {isPaused}
  {tradingData}
  {selectedGranularity}
  on:periodChange
  on:granularityChange
  on:speedChange
  on:dateChange
  on:play
  on:pause
  on:stop
/>