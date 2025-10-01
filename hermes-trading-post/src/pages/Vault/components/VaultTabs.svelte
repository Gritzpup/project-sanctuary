<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let selectedView: 'overview' | 'bots' | 'history';

  const dispatch = createEventDispatcher();

  function selectView(view: 'overview' | 'bots' | 'history') {
    selectedView = view;
    dispatch('viewChange', { view });
  }
</script>

<div class="view-tabs">
  <button 
    class="view-tab" 
    class:active={selectedView === 'overview'}
    on:click={() => selectView('overview')}
  >
    Overview
  </button>
  <button 
    class="view-tab" 
    class:active={selectedView === 'bots'}
    on:click={() => selectView('bots')}
  >
    Bot Vaults
  </button>
  <button 
    class="view-tab" 
    class:active={selectedView === 'history'}
    on:click={() => selectView('history')}
  >
    History
  </button>
</div>

<style>
  .view-tabs {
    display: flex;
    gap: 10px;
    margin-bottom: 20px;
  }

  .view-tab {
    padding: 10px 20px;
    background: rgba(74, 0, 224, 0.1);
    border: 1px solid rgba(74, 0, 224, 0.3);
    border-radius: 6px;
    color: #9ca3af;
    cursor: pointer;
    transition: all 0.2s;
  }

  .view-tab.active {
    background: rgba(74, 0, 224, 0.3);
    border-color: rgba(74, 0, 224, 0.6);
    color: #a78bfa;
  }
</style>