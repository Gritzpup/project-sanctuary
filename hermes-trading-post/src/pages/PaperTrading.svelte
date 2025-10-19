<script lang="ts">
  /**
   * @file PaperTrading.svelte
   * @description Paper Trading page - unified entry point for all paper trading features
   * Consolidates 3 separate implementations into a single modular interface
   */

  import PaperTradingContainer from './PaperTradingContainer/PaperTradingContainer.svelte';

  export let currentPrice: number = 0;
  export let connectionStatus: 'connected' | 'disconnected' | 'error' | 'loading' = 'loading';
  export let sidebarCollapsed = false;
</script>

<PaperTradingContainer {currentPrice} {connectionStatus} {sidebarCollapsed} />
