<script lang="ts">
  import { chartStore } from '../../stores/chartStore.svelte';
  import { dataStore } from '../../stores/dataStore.svelte';
  import { statusStore } from '../../stores/statusStore.svelte';
  import { 
    PERIOD_DISPLAY_NAMES, 
    GRANULARITY_DISPLAY_NAMES,
    RECOMMENDED_GRANULARITIES 
  } from '../../utils/constants';
  import { ChartDebug } from '../../utils/debug';
  
  export let showTimeframes: boolean = true;
  export let showGranularities: boolean = true;
  export let showRefresh: boolean = true;
  export let showClearCache: boolean = true;
  export let availableTimeframes: string[] = ['1H', '6H', '1D', '1W', '1M'];
  export let availableGranularities: string[] = ['1m', '5m', '15m', '30m', '1h', '4h', '1d'];
  
  let isRefreshing = false;
  let isClearingCache = false;
  
  // Get recommended granularities for current timeframe
  $: recommendedGranularities = RECOMMENDED_GRANULARITIES[chartStore.config.timeframe] || [];
  
  // Filter available granularities based on recommendations
  $: filteredGranularities = showGranularities ? 
    availableGranularities.filter(g => recommendedGranularities.includes(g)) :
    [];
  
  function handleTimeframeChange(timeframe: string) {
    ChartDebug.log(`Timeframe button clicked: ${timeframe}`);
    chartStore.setTimeframe(timeframe);
    
    // Auto-select appropriate granularity if current one isn't recommended
    const currentGranularity = chartStore.config.granularity;
    const recommended = RECOMMENDED_GRANULARITIES[timeframe] || [];
    
    if (!recommended.includes(currentGranularity) && recommended.length > 0) {
      ChartDebug.log(`Auto-selecting granularity: ${recommended[0]}`);
      chartStore.setGranularity(recommended[0]);
    }
  }
  
  function handleGranularityChange(granularity: string) {
    chartStore.setGranularity(granularity);
  }
  
  async function handleRefresh() {
    if (isRefreshing) return;
    
    isRefreshing = true;
    statusStore.setLoading('Refreshing data...');
    
    try {
      const stats = dataStore.stats;
      if (stats.oldestTime && stats.newestTime) {
        await dataStore.reloadData(stats.oldestTime, stats.newestTime);
      }
      statusStore.setReady();
    } catch (error) {
      console.error('ChartControls: Error refreshing data:', error);
      statusStore.setError('Failed to refresh data');
    } finally {
      isRefreshing = false;
    }
  }
  
  async function handleClearCache() {
    if (isClearingCache) return;
    
    isClearingCache = true;
    
    try {
      await dataStore.clearCache();
      await handleRefresh();
    } catch (error) {
      console.error('ChartControls: Error clearing cache:', error);
      statusStore.setError('Failed to clear cache');
    } finally {
      isClearingCache = false;
    }
  }
  
  function getButtonClass(isActive: boolean, isRecommended: boolean = false): string {
    let classes = ['control-button'];
    
    if (isActive) {
      classes.push('active');
    }
    
    if (isRecommended && !isActive) {
      classes.push('recommended');
    }
    
    return classes.join(' ');
  }
</script>

<div class="chart-controls">
  {#if showTimeframes}
    <div class="control-group">
      <span class="control-label">Period:</span>
      <div class="button-group">
        {#each availableTimeframes as timeframe}
          <button
            class={getButtonClass(chartStore.config.timeframe === timeframe)}
            on:click={() => handleTimeframeChange(timeframe)}
            title={PERIOD_DISPLAY_NAMES[timeframe] || timeframe}
          >
            {timeframe}
          </button>
        {/each}
      </div>
    </div>
  {/if}
  
  {#if showGranularities && filteredGranularities.length > 0}
    <div class="control-group">
      <span class="control-label">Interval:</span>
      <div class="button-group">
        {#each filteredGranularities as granularity}
          <button
            class={getButtonClass(
              chartStore.config.granularity === granularity,
              recommendedGranularities.includes(granularity)
            )}
            on:click={() => handleGranularityChange(granularity)}
            title={GRANULARITY_DISPLAY_NAMES[granularity] || granularity}
          >
            {granularity}
          </button>
        {/each}
      </div>
    </div>
  {/if}
  
  <div class="control-group actions">
    {#if showRefresh}
      <button 
        class="control-button icon-button"
        on:click={handleRefresh}
        disabled={isRefreshing}
        title="Refresh data"
      >
        <span class="icon" class:spinning={isRefreshing}>↻</span>
      </button>
    {/if}
    
    {#if showClearCache}
      <button 
        class="control-button icon-button"
        on:click={handleClearCache}
        disabled={isClearingCache}
        title="Clear cache and refresh"
      >
        <span class="icon">🗑</span>
      </button>
    {/if}
  </div>
</div>

<style>
  .chart-controls {
    display: flex;
    align-items: center;
    gap: 20px;
    padding: 10px;
    background: var(--control-bg, rgba(0, 0, 0, 0.05));
    border-radius: 8px;
    flex-wrap: wrap;
  }
  
  .control-group {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  
  .control-group.actions {
    margin-left: auto;
  }
  
  .control-label {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-secondary, #666);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  
  .button-group {
    display: flex;
    gap: 4px;
  }
  
  .control-button {
    padding: 6px 12px;
    border: 1px solid var(--border-color, #ddd);
    background: var(--button-bg, white);
    color: var(--text-primary, #333);
    font-size: 13px;
    font-weight: 500;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.2s ease;
    position: relative;
    overflow: hidden;
  }
  
  .control-button:hover:not(:disabled) {
    background: var(--button-hover-bg, #f5f5f5);
    border-color: var(--border-hover-color, #bbb);
  }
  
  .control-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .control-button.active {
    background: var(--primary-color, #2196f3);
    color: white;
    border-color: var(--primary-color, #2196f3);
  }
  
  .control-button.recommended:not(.active)::after {
    content: '';
    position: absolute;
    top: 2px;
    right: 2px;
    width: 4px;
    height: 4px;
    background: var(--accent-color, #4caf50);
    border-radius: 50%;
  }
  
  .icon-button {
    padding: 6px 10px;
    min-width: 32px;
  }
  
  .icon {
    display: inline-block;
    font-size: 16px;
    line-height: 1;
  }
  
  .icon.spinning {
    animation: spin 1s linear infinite;
  }
  
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  
  /* Dark theme support */
  :global(.dark) .chart-controls {
    --control-bg: rgba(255, 255, 255, 0.05);
    --text-primary: #e0e0e0;
    --text-secondary: #999;
    --button-bg: #2a2a2a;
    --button-hover-bg: #3a3a3a;
    --border-color: #444;
    --border-hover-color: #666;
    --primary-color: #2196f3;
    --accent-color: #4caf50;
  }
  
  /* Responsive */
  @media (max-width: 768px) {
    .chart-controls {
      padding: 8px;
      gap: 12px;
    }
    
    .control-button {
      padding: 5px 10px;
      font-size: 12px;
    }
    
    .control-group.actions {
      margin-left: 0;
      width: 100%;
      justify-content: flex-end;
    }
  }
</style>