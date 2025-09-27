<script lang="ts">
  import { onMount } from 'svelte';
  import type { IChartApi } from 'lightweight-charts';
  import ChartCore from './core/ChartCore.svelte';
  import ChartPanes from './core/ChartPanes.svelte';
  import ChartControls from './components/controls/ChartControls.svelte';
  import ChartStatus from './components/status/ChartStatus.svelte';
  import ChartInfo from './components/overlays/ChartInfo.svelte';
  import ChartError from './components/overlays/ChartError.svelte';
  import ChartDebug from './components/overlays/ChartDebug.svelte';
  import { 
    PluginManager,
    VolumePlugin,
    SMAPlugin,
    EMAPlugin,
    RSIPlugin,
    OrderLinePlugin,
    PositionMarkerPlugin,
    type Plugin
  } from './plugins';
  
  // Props
  export let pair: string = 'BTC-USD';
  export let granularity: string = '1m';
  export let period: string = '1H';
  export let showControls: boolean = true;
  export let showStatus: boolean = true;
  export let showInfo: boolean = true;
  export let showDebug: boolean = false;
  export let enablePlugins: boolean = true;
  export let defaultPlugins: string[] = ['volume'];
  export let multiPane: boolean = false;
  export let onReady: ((chart: IChartApi, pluginManager: PluginManager | null) => void) | undefined = undefined;
  export let onGranularityChange: ((granularity: string) => void) | undefined = undefined;
  export let onPairChange: ((pair: string) => void) | undefined = undefined;
  
  let chartCore: ChartCore;
  let chartPanes: ChartPanes;
  let pluginManager: PluginManager | null = null;
  let chart: IChartApi | null = null;
  let isReady = false;
  
  
  // Initialize plugins
  async function initializePlugins() {
    console.log('🔧 initializePlugins called, enablePlugins:', enablePlugins, 'chartCore:', !!chartCore);
    if (!enablePlugins || !chartCore) return;
    
    pluginManager = chartCore.getPluginManager();
    if (!pluginManager) return;
    
    // Register default plugins
    console.log('🔧 Registering default plugins:', defaultPlugins);
    for (const pluginName of defaultPlugins) {
      console.log('🔧 Processing plugin:', pluginName);
      const plugin = createDefaultPlugin(pluginName);
      if (plugin) {
        console.log('🔧 Plugin created, registering with PluginManager');
        try {
          await pluginManager.register(plugin);
          console.log('✅ Successfully registered plugin:', pluginName);
        } catch (error) {
          console.error(`❌ Failed to register ${pluginName} plugin:`, error);
        }
      } else {
        console.warn('⚠️ Failed to create plugin:', pluginName);
      }
    }
  }
  
  // Create default plugin instances
  function createDefaultPlugin(name: string): Plugin | null {
    console.log('🔧 createDefaultPlugin called with name:', name);
    switch (name) {
      case 'volume':
        console.log('🔊 Creating VolumePlugin in createDefaultPlugin');
        return new VolumePlugin();
      case 'sma20':
        return new SMAPlugin({ period: 20, color: '#2196F3' });
      case 'sma50':
        return new SMAPlugin({ period: 50, color: '#FF9800' });
      case 'ema12':
        return new EMAPlugin({ period: 12, color: '#4CAF50' });
      case 'ema26':
        return new EMAPlugin({ period: 26, color: '#F44336' });
      case 'rsi':
        return new RSIPlugin();
      case 'orderLines':
        return new OrderLinePlugin();
      case 'positionMarkers':
        return new PositionMarkerPlugin();
      default:
        return null;
    }
  }
  
  // Handle chart ready
  async function handleChartReady(chartInstance: IChartApi) {
    chart = chartInstance;
    
    // Initialize plugins after chart is ready
    await initializePlugins();
    
    // Add RSI pane if multi-pane is enabled and RSI plugin is loaded
    if (multiPane && pluginManager?.hasPlugin('rsi-14')) {
      chartPanes?.addPane('rsi', 25);
    }
    
    isReady = true;
    
    // Notify parent
    if (onReady) {
      onReady(chart, pluginManager);
    }
  }
  
  // Public API methods
  export function getChart(): IChartApi | null {
    return chart;
  }
  
  export function getPluginManager(): PluginManager | null {
    return pluginManager;
  }
  
  export async function addPlugin(plugin: Plugin): Promise<void> {
    if (!pluginManager) {
      throw new Error('Plugin manager not initialized');
    }
    await pluginManager.register(plugin);
  }
  
  export async function removePlugin(pluginId: string): Promise<void> {
    if (!pluginManager) {
      throw new Error('Plugin manager not initialized');
    }
    await pluginManager.unregister(pluginId);
  }
  
  export function addPane(id: string, height: number = 30): void {
    if (!multiPane || !chartPanes) {
      console.warn('Multi-pane mode is not enabled');
      return;
    }
    chartPanes.addPane(id, height);
  }
  
  export function removePane(id: string): void {
    if (!multiPane || !chartPanes) {
      console.warn('Multi-pane mode is not enabled');
      return;
    }
    chartPanes.removePane(id);
  }
  
  export function fitContent(): void {
    chartCore?.fitContent();
  }
  
  export function addMarkers(markers: any[]): void {
    if (!chartCore) {
      console.error('ChartCore not available for adding markers');
      return;
    }
    
    // Try the bulk method first
    if (typeof chartCore.addMarkers === 'function') {
      chartCore.addMarkers(markers);
    } else {
      // Fallback: add markers one by one
      console.log('Using fallback: adding markers one by one');
      markers.forEach(marker => {
        if (typeof chartCore.addMarker === 'function') {
          chartCore.addMarker(marker);
        }
      });
    }
  }

  export function scrollToCurrentCandle(): void {
    chartCore?.scrollToCurrentCandle();
  }
  
  export function clearMarkers(): void {
    if (!chartCore) {
      console.error('ChartCore not available for clearing markers');
      return;
    }
    
    if (typeof chartCore.clearMarkers === 'function') {
      chartCore.clearMarkers();
    } else {
      console.error('ChartCore does not have clearMarkers method');
    }
  }
</script>

<div class="chart-container">
  {#if showControls}
    <div class="chart-header">
      <ChartControls 
        showTimeframes={true}
        showGranularities={true}
        showRefresh={true}
        showClearCache={true}
        showSpeed={true}
        {pair}
        {onPairChange}
      />
    </div>
  {/if}
  
  <div class="chart-body">
    <ChartCore
      bind:this={chartCore}
      {pair}
      {granularity}
      {period}
      {enablePlugins}
      onReady={handleChartReady}
    >
      <div slot="overlays">
        {#if multiPane}
          <ChartPanes bind:this={chartPanes}>
            <div slot="main-pane" class="main-pane">
              <!-- Main chart is rendered by ChartCore -->
            </div>
            
            <div slot="indicator-pane" let:pane class="indicator-pane">
              <!-- Indicator panes would be rendered here based on pane.id -->
              {#if pane.id === 'rsi'}
                <div class="pane-label">RSI</div>
              {/if}
            </div>
          </ChartPanes>
        {/if}
        
        {#if showInfo}
          <ChartInfo 
            position="bottom-left"
            showCandleCount={true}
            showTimeRange={false}
            showClock={true}
            showPerformance={false}
            showLatestPrice={true}
            showLatestCandleTime={false}
            showCandleCountdown={true}
          />
        {/if}
        
        <ChartError 
          position="center"
          dismissible={true}
        />
        
        {#if showDebug}
          <ChartDebug 
            show={true}
            expanded={false}
          />
        {/if}
      </div>
    </ChartCore>
  </div>
</div>

<style>
  .chart-container {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    background: var(--chart-bg, #1a1a1a);
    color: var(--chart-text, #d1d4dc);
  }
  
  .chart-header {
    flex-shrink: 0;
    padding: 10px;
    background: var(--header-bg, rgba(0, 0, 0, 0.2));
    border-bottom: 1px solid var(--border-color, #333);
  }
  
  .chart-body {
    flex: 1;
    position: relative;
    min-height: 0;
    overflow: hidden;
  }
  
  .main-pane {
    width: 100%;
    height: 100%;
  }
  
  .indicator-pane {
    width: 100%;
    height: 100%;
    position: relative;
    background: var(--pane-bg, rgba(0, 0, 0, 0.1));
  }
  
  .pane-label {
    position: absolute;
    top: 5px;
    left: 10px;
    font-size: 11px;
    font-weight: 600;
    color: var(--label-color, #999);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  
  /* Theme variables */
  :global(.dark) .chart-container {
    --chart-bg: #1a1a1a;
    --chart-text: #d1d4dc;
    --header-bg: rgba(0, 0, 0, 0.2);
    --border-color: #333;
    --pane-bg: rgba(0, 0, 0, 0.1);
    --label-color: #999;
  }
  
  :global(.light) .chart-container {
    --chart-bg: #ffffff;
    --chart-text: #191919;
    --header-bg: rgba(0, 0, 0, 0.05);
    --border-color: #e1e1e1;
    --pane-bg: rgba(0, 0, 0, 0.02);
    --label-color: #666;
  }
  
  /* Responsive */
  @media (max-width: 768px) {
    .chart-header {
      padding: 8px;
    }
  }
</style>