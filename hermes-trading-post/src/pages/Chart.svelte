<script lang="ts">
  // This is a wrapper component that avoids cyclical dependency by importing ChartContainer directly
  import ChartContainer from './trading/chart/ChartContainer.svelte';
  import type { IChartApi, ISeriesApi } from 'lightweight-charts';
  import type { CandleData } from '../types/coinbase';

  // Export props for compatibility with existing usage
  export let selectedGranularity: string = '1m';
  export let selectedPeriod: string = '1H';
  export let chartInstance: IChartApi | null = null;
  export let candleSeriesInstance: ISeriesApi<'Candlestick'> | null = null;
  export let currentPrice: number = 0;
  export let granularity: string = '1m';
  export let period: string = '1H';
  export let trades: Array<{timestamp: number, type: string, price: number}> = [];
  export let status: 'connected' | 'disconnected' | 'error' | 'loading' = 'loading';
  export let onGranularityChange: ((g: string) => void) | undefined = undefined;

  // Sync granularity props - use one-way binding to avoid cycles
  $: granularity = selectedGranularity || '1m';
  $: period = selectedPeriod || '1H';
</script>

<ChartContainer
  pair="BTC-USD"
  granularity={granularity}
  period={period}
  showControls={false}
  showStatus={true}
  showInfo={true}
  showDebug={false}
  enablePlugins={true}
  defaultPlugins={['volume']}
  onGranularityChange={onGranularityChange}
/>