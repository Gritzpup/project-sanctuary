<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  
  export let sidebarCollapsed = false;
  
  const dispatch = createEventDispatcher();
</script>

<div class="dashboard-layout">
  <slot name="sidebar" />
  
  <main class="dashboard-content" class:expanded={sidebarCollapsed}>
    <slot name="header" />
    
    <div class="content-wrapper">
      <div class="backtest-grid">
        <slot name="content" />
      </div>
    </div>
  </main>
</div>