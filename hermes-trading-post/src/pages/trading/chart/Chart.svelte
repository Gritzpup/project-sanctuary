<script lang="ts">
  import ChartContainer from './ChartContainer.svelte';
  import type { IChartApi } from 'lightweight-charts';
  import type { PluginManager } from './plugins';
  
  // Export all the props that ChartContainer accepts
  export let pair: string = 'BTC-USD';
  export let showControls: boolean = true;
  export let showStatus: boolean = true;
  export let showInfo: boolean = true;
  export let showDebug: boolean = false;
  export let enablePlugins: boolean = true;
  export let defaultPlugins: string[] = ['volume'];
  export let multiPane: boolean = false;
  export let onReady: ((chart: IChartApi, pluginManager: PluginManager | null) => void) | undefined = undefined;
  export let onGranularityChange: ((granularity: string) => void) | undefined = undefined;
  
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
</script>

<ChartContainer
  bind:this={chartContainer}
  {pair}
  {showControls}
  {showStatus}
  {showInfo}
  {showDebug}
  {enablePlugins}
  {defaultPlugins}
  {multiPane}
  {onReady}
  {onGranularityChange}
/>

<style>
  /* All styles are now in ChartContainer */
</style>