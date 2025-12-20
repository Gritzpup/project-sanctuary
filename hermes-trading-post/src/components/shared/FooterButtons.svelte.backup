<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  
  export let buttons: string[] = [];
  export let activeButton: string = '';
  export let disabledButtons: string[] = [];
  
  const dispatch = createEventDispatcher();
  
  function handleClick(button: string) {
    if (!disabledButtons.includes(button)) {
      dispatch('buttonClick', { button });
    }
  }
</script>

<div class="footer-buttons">
  {#each buttons as button}
    <button
      class="footer-btn"
      class:active={button === activeButton}
      class:disabled={disabledButtons.includes(button)}
      on:click={() => handleClick(button)}
    >
      {button}
    </button>
  {/each}
</div>

<style>
  .footer-buttons {
    display: flex;
    gap: 4px;
  }
  
  .footer-btn {
    background: rgba(74, 0, 224, 0.1);
    border: 1px solid var(--border-primary);
    color: var(--text-tertiary);
    padding: 4px 8px;
    border-radius: var(--radius-md);
    cursor: pointer;
    font-size: var(--font-size-xs);
    transition: all 0.2s;
  }
  
  .footer-btn:hover:not(.disabled) {
    background: rgba(74, 0, 224, 0.2);
    color: var(--text-secondary);
  }
  
  .footer-btn.active {
    background: rgba(74, 0, 224, 0.4);
    color: #e9d5ff;
    border-color: var(--text-secondary);
  }
  
  .footer-btn.disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }
</style>