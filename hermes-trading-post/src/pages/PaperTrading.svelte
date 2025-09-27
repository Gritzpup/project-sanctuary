<script lang="ts">
  import PaperTradingContainer from './PaperTradingContainer.svelte';
  import { createEventDispatcher } from 'svelte';
  
  export let currentPrice: number = 0;
  export let connectionStatus: 'connected' | 'disconnected' | 'error' | 'loading' = 'loading';
  export let sidebarCollapsed = false;
  
  const dispatch = createEventDispatcher();
  
  function handleToggle() {
    dispatch('toggle');
  }
  
  function handleNavigation(event: CustomEvent) {
    dispatch('navigate', event.detail);
  }
</script>

<PaperTradingContainer 
  {sidebarCollapsed}
  on:toggle={handleToggle}
  on:navigate={handleNavigation}
/>