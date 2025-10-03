<script lang="ts">
  import ChartControlsContainer from './chart-controls/ChartControlsContainer.svelte';
  
  export let selectedPeriod = '1H';
  export let chartSpeed = '1x';
  export let selectedTestDateString = '';
  export let isRunning = false;
  export let isPaused = false;
</script>

<ChartControlsContainer 
  {selectedPeriod}
  {chartSpeed}
  {selectedTestDateString}
  {isRunning}
  {isPaused}
  on:periodChange
  on:speedChange
  on:dateChange
  on:play
  on:pause
  on:stop
/>