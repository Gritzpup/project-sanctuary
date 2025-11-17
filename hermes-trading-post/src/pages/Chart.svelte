<script lang="ts">
  // This is a wrapper component that avoids cyclical dependency by importing ChartContainer directly
  import ChartContainer from './trading/chart/ChartContainer.svelte';
  import type { IChartApi, ISeriesApi } from 'lightweight-charts';
  import type { CandleData } from '../types/coinbase';

  // Export props for compatibility with existing usage - external reference only
  export let selectedGranularity: string = '1m';
  export let selectedPeriod: string = '1H';
  export const chartInstance: IChartApi | null = null;
  export const candleSeriesInstance: ISeriesApi<'Candlestick'> | null = null;
  export const currentPrice: number = 0;
  export let granularity: string = '1m';
  export let period: string = '1H';
  export const trades: Array<{timestamp: number, type: string, price: number}> = [];
  export const status: 'connected' | 'disconnected' | 'error' | 'loading' = 'loading';
  export let onGranularityChange: ((g: string) => void) | undefined = undefined;

  // Sync granularity props - use one-way binding to avoid cycles
  $: granularity = selectedGranularity || '1m';
  $: period = selectedPeriod || '1H';

  // Debug: Log prop changes
  $: if (period) {
  }
</script>

<ChartContainer
  pair="BTC-USD"
  granularity={granularity}
  period={period}
  showControls={true}
  showStatus={true}
  showInfo={true}
  showDebug={false}
  enablePlugins={true}
  defaultPlugins={['volume']}
  onGranularityChange={onGranularityChange}
/>