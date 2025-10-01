<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let selectedCategory: string;
  export let selectedSentiment: string;
  export let selectedTimeframe: string;
  export let searchQuery: string;
  export let autoRefresh: boolean;
  export let isLoading: boolean;

  const dispatch = createEventDispatcher();

  // Filter options
  const categories = [
    { value: 'all', label: 'All Categories' },
    { value: 'market', label: 'Market Analysis' },
    { value: 'regulation', label: 'Regulation' },
    { value: 'technology', label: 'Technology' },
    { value: 'adoption', label: 'Adoption' },
    { value: 'defi', label: 'DeFi' }
  ];

  const sentiments = [
    { value: 'all', label: 'All Sentiments' },
    { value: 'bullish', label: 'Bullish', color: '#22c55e' },
    { value: 'bearish', label: 'Bearish', color: '#ef4444' },
    { value: 'neutral', label: 'Neutral', color: '#6b7280' }
  ];

  const timeframes = [
    { value: '1h', label: 'Last Hour' },
    { value: '24h', label: 'Last 24 Hours' },
    { value: '7d', label: 'Last 7 Days' },
    { value: '30d', label: 'Last 30 Days' }
  ];

  function handleFilterChange() {
    dispatch('filterChange');
  }

  function toggleAutoRefresh() {
    dispatch('toggleAutoRefresh');
  }

  function handleRefresh() {
    dispatch('refresh');
  }
</script>

<div class="filters-panel">
  <div class="filter-group">
    <label>Category</label>
    <select bind:value={selectedCategory} on:change={handleFilterChange}>
      {#each categories as category}
        <option value={category.value}>{category.label}</option>
      {/each}
    </select>
  </div>
  
  <div class="filter-group">
    <label>Sentiment</label>
    <select bind:value={selectedSentiment} on:change={handleFilterChange}>
      {#each sentiments as sentiment}
        <option value={sentiment.value}>{sentiment.label}</option>
      {/each}
    </select>
  </div>
  
  <div class="filter-group">
    <label>Timeframe</label>
    <select bind:value={selectedTimeframe} on:change={handleFilterChange}>
      {#each timeframes as timeframe}
        <option value={timeframe.value}>{timeframe.label}</option>
      {/each}
    </select>
  </div>
  
  <div class="filter-group">
    <label>Search</label>
    <input 
      type="text" 
      placeholder="Search news..."
      bind:value={searchQuery}
      on:input={handleFilterChange}
    />
  </div>
  
  <button class="refresh-btn" class:active={autoRefresh} on:click={toggleAutoRefresh}>
    {autoRefresh ? '🔄 Auto' : '⏸️ Manual'}
  </button>
  
  <button class="refresh-btn" on:click={handleRefresh} disabled={isLoading}>
    {isLoading ? 'Loading...' : 'Refresh'}
  </button>
</div>

<style>
  .filters-panel {
    display: flex;
    gap: 15px;
    padding: 20px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(74, 0, 224, 0.3);
    border-radius: 8px;
    margin-bottom: 20px;
    flex-wrap: wrap;
    align-items: flex-end;
  }

  .filter-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .filter-group label {
    font-size: 12px;
    color: #758696;
    text-transform: uppercase;
  }

  .filter-group select,
  .filter-group input {
    padding: 8px 12px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(74, 0, 224, 0.3);
    border-radius: 4px;
    color: #d1d4dc;
    font-size: 14px;
  }

  .refresh-btn {
    padding: 8px 16px;
    background: rgba(74, 0, 224, 0.2);
    border: 1px solid rgba(74, 0, 224, 0.4);
    border-radius: 4px;
    color: #a78bfa;
    cursor: pointer;
    font-size: 13px;
    transition: all 0.2s;
  }

  .refresh-btn:hover:not(:disabled) {
    background: rgba(74, 0, 224, 0.3);
    border-color: rgba(74, 0, 224, 0.6);
  }

  .refresh-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .refresh-btn.active {
    background: rgba(34, 197, 94, 0.2);
    border-color: rgba(34, 197, 94, 0.4);
    color: #22c55e;
  }
</style>