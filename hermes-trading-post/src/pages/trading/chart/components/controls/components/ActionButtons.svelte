<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let showRefresh: boolean = true;
  export let showClearCache: boolean = true;
  export let isRefreshing: boolean = false;
  export let isClearingCache: boolean = false;

  const dispatch = createEventDispatcher();

  function handleRefresh() {
    if (isRefreshing) return;
    dispatch('refresh');
  }

  function handleClearCache() {
    if (isClearingCache) return;
    dispatch('clearCache');
  }
</script>

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

<style>
  .control-group {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .control-group.actions {
    margin-left: auto;
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
  }

  .control-button:hover:not(:disabled) {
    background: var(--button-hover-bg, #f5f5f5);
    border-color: var(--border-hover-color, #bbb);
  }

  .control-button:disabled {
    opacity: 0.3;
    cursor: not-allowed;
    background: var(--button-bg, white);
    color: var(--text-muted, #999);
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
  :global(.dark) .control-button {
    --button-bg: #2a2a2a;
    --button-hover-bg: #3a3a3a;
    --border-color: #444;
    --border-hover-color: #666;
    --text-primary: #e0e0e0;
    --text-muted: #555;
  }

  /* Responsive */
  @media (max-width: 768px) {
    .control-group.actions {
      margin-left: 0;
      width: 100%;
      justify-content: flex-end;
    }

    .control-button {
      padding: 5px 10px;
      font-size: 12px;
    }
  }
</style>