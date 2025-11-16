<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  
  export let sidebarCollapsed = false;
  
  const dispatch = createEventDispatcher();
</script>

<div class="dashboard-layout">
  <slot name="sidebar" />

  <main class="dashboard-content" class:expanded={sidebarCollapsed}>
    <div class="content-wrapper">
      <div class="backtest-grid">
        <slot name="content" />
      </div>
    </div>
  </main>
</div>

<style>
  .dashboard-layout {
    display: flex;
    height: 100vh;
    background: var(--bg-main);
    color: var(--text-primary);
    overflow: hidden;
  }

  .dashboard-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    margin-left: 250px;
    width: calc(100% - 250px);
    transition: all var(--transition-slow);
  }

  .dashboard-content.expanded {
    margin-left: 80px;
    width: calc(100% - 80px);
  }

  .content-wrapper {
    flex: 1;
    overflow-y: auto;
    padding: var(--space-xl) var(--space-xl) 0 0;
  }

  .backtest-grid {
    display: flex;
    flex-direction: column;
    gap: var(--space-xl);
    padding-bottom: 40px;
  }

  /* Mobile responsive layout */
  @media (max-width: 768px) {
    .dashboard-content,
    .dashboard-content.expanded {
      margin-left: 0;
      width: 100%;
      margin-top: 60px;
    }

    .content-wrapper {
      padding: var(--space-lg) var(--space-sm);
    }

    .backtest-grid {
      gap: var(--space-lg);
    }
  }
</style>