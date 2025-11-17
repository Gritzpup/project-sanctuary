<script lang="ts">
  import { onMount } from 'svelte';

  export let component: () => Promise<any>;
  export let currentPrice: number;
  export let connectionStatus: 'connected' | 'disconnected' | 'error' | 'loading';
  export let sidebarCollapsed: boolean;

  let Component: any = null;
  let loading = true;
  let error: Error | null = null;

  onMount(async () => {
    try {
      const module = await component();
      Component = module.default;
      loading = false;
    } catch (err) {
      error = err as Error;
      loading = false;
    }
  });
</script>

{#if loading}
  <div class="lazy-loading">
    <div class="spinner"></div>
    <p>Loading...</p>
  </div>
{:else if error}
  <div class="lazy-error">
    <p>Failed to load component</p>
    <p class="error-message">{error.message}</p>
  </div>
{:else if Component}
  <svelte:component
    this={Component}
    {currentPrice}
    bind:connectionStatus
    {sidebarCollapsed}
    on:toggle
    on:navigate
  />
{/if}

<style>
  .lazy-loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    background-color: var(--bg-main);
    color: var(--text-primary);
  }

  .lazy-error {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    background-color: var(--bg-main);
    color: var(--color-error);
  }

  .spinner {
    width: 50px;
    height: 50px;
    border: 3px solid var(--border-color);
    border-top-color: var(--color-primary);
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-bottom: var(--space-md);
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .error-message {
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
    margin-top: var(--space-sm);
  }
</style>
