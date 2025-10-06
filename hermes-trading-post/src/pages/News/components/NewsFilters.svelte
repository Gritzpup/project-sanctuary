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
  
  <button class="btn-base btn-md btn-secondary refresh-btn" class:active={autoRefresh} on:click={toggleAutoRefresh}>
    {autoRefresh ? '🔄 Auto' : '⏸️ Manual'}
  </button>
  
  <button class="btn-base btn-md btn-primary" on:click={handleRefresh} disabled={isLoading}>
    {isLoading ? 'Loading...' : 'Refresh'}
  </button>
</div>

<style>
  .filters-panel {
    display: flex;
    gap: var(--space-md);
    padding: var(--space-xl);
    background: var(--bg-primary);
    border: 1px solid var(--border-primary);
    border-radius: var(--radius-lg);
    margin-bottom: var(--space-xl);
    flex-wrap: wrap;
    align-items: flex-end;
  }

  .filter-group {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
    min-width: 120px;
  }

  .filter-group label {
    font-size: var(--font-size-xs);
    color: var(--text-secondary);
    text-transform: uppercase;
    font-weight: var(--font-weight-medium);
    letter-spacing: 0.5px;
  }

  .filter-group select,
  .filter-group input {
    padding: var(--space-sm) var(--space-md);
    background: var(--bg-surface);
    border: 1px solid var(--border-primary);
    border-radius: var(--radius-sm);
    color: var(--text-primary);
    font-size: var(--font-size-sm);
    transition: all var(--transition-normal);
  }

  .filter-group select:focus,
  .filter-group input:focus {
    outline: none;
    border-color: var(--border-primary-hover);
    background: var(--bg-primary);
  }

  .filter-group input::placeholder {
    color: var(--text-muted);
  }

  .refresh-btn.active {
    background: rgba(34, 197, 94, 0.1) !important;
    border-color: var(--color-success) !important;
    color: var(--color-success) !important;
  }

  .btn-base:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Mobile responsive */
  @media (max-width: 768px) {
    .filters-panel {
      flex-direction: column;
      gap: var(--space-md);
      padding: var(--space-lg);
    }
    
    .filter-group {
      min-width: 100%;
    }
    
    .btn-base {
      align-self: stretch;
    }
  }

  /* Tablet responsive */
  @media (max-width: 1024px) and (min-width: 769px) {
    .filters-panel {
      gap: var(--space-sm);
    }
    
    .filter-group {
      min-width: 100px;
    }
  }
</style>