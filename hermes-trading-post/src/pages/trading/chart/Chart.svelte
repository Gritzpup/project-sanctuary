<script lang="ts">

  import ChartContainer from './ChartContainer.svelte';
  import type { IChartApi } from 'lightweight-charts';
  import type { PluginManager } from './plugins';
  import { onMount } from 'svelte';
  import { statusStore } from './stores/statusStore.svelte';

  // Status monitoring - only set ready if stuck in loading state too long
  onMount(() => {
    setTimeout(() => {
      try {
        // Only intervene if truly stuck, not to mask real issues
        if (statusStore.status === 'loading' || statusStore.status === 'initializing') {
          statusStore.setReady();
        }
      } catch (error) {
      }
    }, 5000); // Increased timeout to allow proper initialization
  });
  
  // Runes mode: use $props() instead of export let
  let {
    pair = 'BTC-USD',
    granularity = '1m',
    period = '1H',
    showControls = true,
    showStatus = true,
    showInfo = true,
    showDebug = false,
    enablePlugins = true,
    enableAutoGranularity = true,
    defaultPlugins = ['volume'],
    multiPane = false,
    chartRefreshKey = Date.now(),
    onReady = undefined,
    onGranularityChange = undefined,
    onPairChange = undefined
  } = $props<{
    pair?: string;
    granularity?: string;
    period?: string;
    showControls?: boolean;
    showStatus?: boolean;
    showInfo?: boolean;
    showDebug?: boolean;
    enablePlugins?: boolean;
    enableAutoGranularity?: boolean;
    defaultPlugins?: string[];
    multiPane?: boolean;
    chartRefreshKey?: number;
    onReady?: (chart: IChartApi, pluginManager: PluginManager | null) => void;
    onGranularityChange?: (granularity: string) => void;
    onPairChange?: (pair: string) => void;
  }>();

  // Debug period changes
  let previousPeriod = period;
  $effect(() => {
    console.log(`[Chart] $effect triggered - period=${period}, previousPeriod=${previousPeriod}`);
    if (period !== previousPeriod) {
      console.log(`[Chart] 🔍 period prop CHANGED: ${previousPeriod} → ${period}`);
      previousPeriod = period;
    } else {
      console.log(`[Chart] period unchanged (${period})`);
    }
  });
  
  let chartContainer: ChartContainer;
  
  // Forward public API methods
  export function getChart(): IChartApi | null {
    return chartContainer?.getChart() || null;
  }
  
  export function getPluginManager(): PluginManager | null {
    return chartContainer?.getPluginManager() || null;
  }
  
  export async function addPlugin(plugin: any): Promise<void> {
    return chartContainer?.addPlugin(plugin);
  }
  
  export async function removePlugin(pluginId: string): Promise<void> {
    return chartContainer?.removePlugin(pluginId);
  }
  
  export function addPane(id: string, height: number = 30): void {
    return chartContainer?.addPane(id, height);
  }
  
  export function removePane(id: string): void {
    return chartContainer?.removePane(id);
  }
  
  export function fitContent(): void {
    return chartContainer?.fitContent();
  }

  export function scrollToCurrentCandle(): void {
    return chartContainer?.scrollToCurrentCandle();
  }
  
  export function addMarkers(markers: any[]): void {
    return chartContainer?.addMarkers(markers);
  }
  
  export function clearMarkers(): void {
    return chartContainer?.clearMarkers();
  }

  export function show60Candles(): void {
    return chartContainer?.show60Candles();
  }

  export async function reloadForGranularity(newGranularity: string): Promise<void> {
    return chartContainer?.reloadForGranularity(newGranularity);
  }
</script>

<ChartContainer
  bind:this={chartContainer}
  {pair}
  {granularity}
  {period}
  {showControls}
  {showStatus}
  {showInfo}
  {showDebug}
  {enablePlugins}
  {enableAutoGranularity}
  {defaultPlugins}
  {multiPane}
  {chartRefreshKey}
  {onReady}
  {onGranularityChange}
  {onPairChange}
/>