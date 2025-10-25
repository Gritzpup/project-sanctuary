<script lang="ts">
  /**
   * @file PaperTrading.svelte
   * @description Paper Trading page - unified entry point for all paper trading features
   *
   * Phase 5B Consolidation: ✅ COMPLETE (Oct 24, 2025)
   * ================================================
   * - Fixed import paths in /src/features/paper-trading/services/
   * - Removed duplicate PaperTradingOrchestrator from old location
   * - Deleted deprecated dataFeed.ts legacy file
   * - Successfully using consolidated /src/features/paper-trading/ module
   * - Old /src/pages/PaperTrading/services/ removed
   *
   * Next: Can safely delete /src/pages/PaperTradingContainer/ directory
   * once confirmed all functionality works correctly.
   */

  import PaperTradingWrapper from '../features/paper-trading/PaperTradingWrapper.svelte';

  export let currentPrice: number = 0;
  export let connectionStatus: 'connected' | 'disconnected' | 'error' | 'loading' = 'loading';
  export let sidebarCollapsed = false;
</script>

<PaperTradingWrapper {currentPrice} {connectionStatus} {sidebarCollapsed} />
