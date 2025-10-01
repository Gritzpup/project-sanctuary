<script lang="ts">
  export let forwardTestProgress = 0; // 0-100
  export let isForwardTestRunning = false;
</script>

{#if isForwardTestRunning}
  <div class="progress-container">
    <div class="progress-bar">
      <div 
        class="progress-fill"
        class:active={isForwardTestRunning}
        style="width: {forwardTestProgress}%"
      ></div>
    </div>
    <span class="progress-text">{forwardTestProgress.toFixed(1)}%</span>
  </div>
{/if}

<style>
  .progress-container {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    padding: var(--space-sm);
    background: var(--surface-elevated);
    border-bottom: 1px solid var(--border-primary);
  }
  
  .progress-bar {
    flex: 1;
    height: 8px;
    background: var(--surface-panel);
    border-radius: var(--radius-sm);
    overflow: hidden;
  }
  
  .progress-fill {
    height: 100%;
    background: var(--color-primary);
    transition: width 0.3s ease;
  }
  
  .progress-fill.active {
    background: var(--color-success);
  }
  
  .progress-text {
    font-size: var(--font-size-xs);
    color: var(--text-secondary);
    min-width: 40px;
    text-align: right;
  }
</style>