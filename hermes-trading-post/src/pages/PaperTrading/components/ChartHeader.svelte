<script lang="ts">
  import ChartHeaderContainer from './chart-header/ChartHeaderContainer.svelte';

  export let selectedPair = 'BTC-USD';
  export let currentPrice: number = 0;
  export let priceChange24h: number = 0;
  export let priceChangePercent24h: number = 0;
  export let selectedGranularity = '1m';
  export let selectedPeriod = '1H';
  // Optional bot-related props (used by TradingChart)
  export let botTabs: any[] = [];
  export let activeBotInstance: any = null;
</script>

<ChartHeaderContainer
  {selectedPair}
  {currentPrice}
  {priceChange24h}
  {priceChangePercent24h}
  {selectedGranularity}
  {selectedPeriod}
  on:pairChange
  on:granularityChange
  on:zoomReset
/>