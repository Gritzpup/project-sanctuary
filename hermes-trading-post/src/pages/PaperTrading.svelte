<script lang="ts">
  /**
   * @file PaperTrading.svelte
   * @description Paper Trading page - unified entry point for all paper trading features
   *
   * NOTE Phase 5B: Paper Trading Consolidation Status
   * ================================================
   * Current: Using PaperTradingContainer from /src/pages/PaperTradingContainer/
   * Target:  Consolidate to use /src/features/paper-trading/ module (Phase 5B incomplete)
   *
   * Blocker: The /src/features/paper-trading/ components have unresolved dependencies:
   * - TradingChart.svelte imports chart components that don't exist in the expected paths
   * - ChartControlsContainer.svelte imports overlay components that don't exist
   * - PaperTradingStateManager.ts has incorrect service import paths
   *
   * TODO Phase 5B Continuation:
   * 1. Fix all internal component imports in /src/features/paper-trading/
   * 2. Verify all services are properly accessible from the feature module
   * 3. Update this file to import from consolidated feature module
   * 4. Delete /src/pages/PaperTradingContainer/ after successful consolidation
   *
   * See: docs/PHASE5_COMPLETION_SUMMARY.md for module structure details
   */

  import PaperTradingContainer from './PaperTradingContainer/PaperTradingContainer.svelte';

  export let currentPrice: number = 0;
  export let connectionStatus: 'connected' | 'disconnected' | 'error' | 'loading' = 'loading';
  export let sidebarCollapsed = false;
</script>

<PaperTradingContainer {currentPrice} {connectionStatus} {sidebarCollapsed} />
