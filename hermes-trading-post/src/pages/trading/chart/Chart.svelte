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
          console.warn('Chart status stuck in', statusStore.status, 'state - setting to ready');
          statusStore.setReady();
        }
      } catch (error) {
        console.error('Error checking status:', error);
      }
    }, 5000); // Increased timeout to allow proper initialization
  });
  
  // Export all the props that ChartContainer accepts
  export let pair: string = 'BTC-USD';
  export let granularity: string = '1m';
  export let period: string = '1H';
  export let showControls: boolean = true;
  export let showStatus: boolean = true;
  export let showInfo: boolean = true;
  export let showDebug: boolean = false;
  export let enablePlugins: boolean = true; // Enable plugins by default (especially volume)
  export let enableAutoGranularity: boolean = true; // Enable automatic granularity switching
  export let defaultPlugins: string[] = ['volume'];
  export let multiPane: boolean = false;
  export let onReady: ((chart: IChartApi, pluginManager: PluginManager | null) => void) | undefined = undefined;
  export let onGranularityChange: ((granularity: string) => void) | undefined = undefined;
  export let onPairChange: ((pair: string) => void) | undefined = undefined;
  
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
  {onReady}
  {onGranularityChange}
  {onPairChange}
/>

<style>
  /* All styles are now in ChartContainer */
</style>