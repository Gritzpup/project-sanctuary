<script lang="ts">
  import { chartStore } from '../../stores/chartStore.svelte';
  import { dataStore } from '../../stores/dataStore.svelte';
  import { statusStore } from '../../stores/statusStore.svelte';
  import { performanceStore } from '../../stores/performanceStore.svelte';
  
  export let show: boolean = false;
  export let expanded: boolean = false;
  
  function toggleExpanded() {
    expanded = !expanded;
  }
  
  // Reactive debug data
  $: debugData = {
    chart: {
      initialized: chartStore.chartInstance !== null,
      theme: chartStore.config.theme,
      timeframe: chartStore.config.timeframe,
      granularity: chartStore.config.granularity,
      indicators: chartStore.config.indicators.length
    },
    data: {
      totalCandles: dataStore.stats.totalCount,
      visibleCandles: dataStore.stats.visibleCount,
      cacheStatus: dataStore.getCacheStatus(),
      latestPrice: dataStore.latestPrice,
      isEmpty: dataStore.isEmpty
    },
    status: {
      current: statusStore.status,
      message: statusStore.message,
      isError: statusStore.isError(),
      historyCount: statusStore.history.length
    },
    performance: {
      fps: performanceStore.stats.fps,
      renderTime: performanceStore.stats.renderTime,
      dataLoadTime: performanceStore.stats.dataLoadTime,
      cacheHitRate: performanceStore.stats.cacheHitRate,
      memoryUsage: performanceStore.stats.memoryUsage,
      level: performanceStore.summary.performance
    }
  };
  
  function formatJSON(obj: any): string {
    return JSON.stringify(obj, null, 2);
  }
</script>

{#if show}
  <div class="chart-debug" class:expanded>
    <div class="debug-header" on:click={toggleExpanded} role="button" tabindex="0">
      <span class="debug-icon">🐛</span>
      <span class="debug-title">Chart Debug</span>
      <span class="toggle-icon">{expanded ? '▼' : '▶'}</span>
    </div>
    
    {#if expanded}
      <div class="debug-content">
        <div class="debug-section">
          <h4>Chart State</h4>
          <pre>{formatJSON(debugData.chart)}</pre>
        </div>
        
        <div class="debug-section">
          <h4>Data Store</h4>
          <pre>{formatJSON(debugData.data)}</pre>
        </div>
        
        <div class="debug-section">
          <h4>Status</h4>
          <pre>{formatJSON(debugData.status)}</pre>
        </div>
        
        <div class="debug-section">
          <h4>Performance</h4>
          <pre>{formatJSON(debugData.performance)}</pre>
          {#if performanceStore.summary.issues.length > 0}
            <div class="performance-issues">
              <strong>Issues:</strong>
              <ul>
                {#each performanceStore.summary.issues as issue}
                  <li>{issue}</li>
                {/each}
              </ul>
            </div>
          {/if}
        </div>
        
        <div class="debug-actions">
          <button on:click={() => console.log('Chart Debug:', debugData)}>
            Log to Console
          </button>
          <button on:click={() => navigator.clipboard.writeText(formatJSON(debugData))}>
            Copy Debug Data
          </button>
        </div>
      </div>
    {/if}
  </div>
{/if}

<style>
  .chart-debug {
    position: absolute;
    top: 60px;
    right: 10px;
    background: rgba(0, 0, 0, 0.9);
    color: #0f0;
    font-family: 'Courier New', monospace;
    font-size: 11px;
    border: 1px solid #0f0;
    border-radius: 4px;
    z-index: 1000;
    max-width: 400px;
    max-height: 80vh;
    overflow: hidden;
    transition: all 0.3s ease;
  }
  
  .chart-debug.expanded {
    overflow-y: auto;
  }
  
  .debug-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: rgba(0, 255, 0, 0.1);
    cursor: pointer;
    user-select: none;
  }
  
  .debug-header:hover {
    background: rgba(0, 255, 0, 0.2);
  }
  
  .debug-icon {
    font-size: 14px;
  }
  
  .debug-title {
    flex: 1;
    font-weight: bold;
    text-transform: uppercase;
  }
  
  .toggle-icon {
    font-size: 10px;
  }
  
  .debug-content {
    padding: 12px;
  }
  
  .debug-section {
    margin-bottom: 16px;
    padding-bottom: 16px;
    border-bottom: 1px solid rgba(0, 255, 0, 0.2);
  }
  
  .debug-section:last-child {
    border-bottom: none;
    margin-bottom: 0;
    padding-bottom: 0;
  }
  
  .debug-section h4 {
    margin: 0 0 8px 0;
    color: #0f0;
    font-size: 12px;
    text-transform: uppercase;
  }
  
  .debug-section pre {
    margin: 0;
    padding: 8px;
    background: rgba(0, 0, 0, 0.5);
    border-radius: 2px;
    overflow-x: auto;
    white-space: pre-wrap;
    word-wrap: break-word;
  }
  
  .performance-issues {
    margin-top: 8px;
    padding: 8px;
    background: rgba(255, 0, 0, 0.1);
    border: 1px solid rgba(255, 0, 0, 0.3);
    border-radius: 2px;
  }
  
  .performance-issues strong {
    color: #f00;
  }
  
  .performance-issues ul {
    margin: 4px 0 0 0;
    padding-left: 20px;
  }
  
  .performance-issues li {
    color: #ff0;
  }
  
  .debug-actions {
    display: flex;
    gap: 8px;
    margin-top: 12px;
  }
  
  .debug-actions button {
    flex: 1;
    padding: 6px 12px;
    background: rgba(0, 255, 0, 0.1);
    border: 1px solid #0f0;
    color: #0f0;
    font-family: inherit;
    font-size: 11px;
    cursor: pointer;
    border-radius: 2px;
    transition: all 0.2s;
  }
  
  .debug-actions button:hover {
    background: rgba(0, 255, 0, 0.2);
  }
  
  .debug-actions button:active {
    background: rgba(0, 255, 0, 0.3);
  }
</style>