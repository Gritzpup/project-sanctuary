<script lang="ts">
  // @ts-nocheck - Page component prop compatibility across different parent/child relationships
  import { Router, Route } from 'svelte-routing';
  import { CoinbaseAPI } from './services/api/coinbaseApi';
  import { onMount, onDestroy } from 'svelte';
  import { sidebarStore } from './stores/sidebarStore';
  import { tradingBackendService } from './services/state/tradingBackendService';
  import { chartRealtimeService } from './shared/services/chartRealtimeService';
  import Dashboard from './pages/Dashboard.svelte';
  import Portfolio from './pages/Portfolio.svelte';
  import PaperTrading from './pages/PaperTrading.svelte';
  import Backtesting from './pages/Backtesting/Backtesting.svelte';
  import Trading from './pages/Trading.svelte';
  import Vault from './pages/Vault.svelte';
  import News from './pages/News.svelte';

  export let url = "";

  let currentPrice: number = 0;
  let connectionStatus: 'connected' | 'disconnected' | 'error' | 'loading' = 'loading';
  let api: CoinbaseAPI;

  // ⚡ MEMORY LEAK FIX: Track store subscription for cleanup
  let sidebarCollapsed = false;
  let unsubscribeSidebar: (() => void) | null = null;

  let priceInterval: number;

  // ⚡ MEMORY LEAK FIX: Cleanup WebSockets on page unload/reload
  function handleBeforeUnload() {
    tradingBackendService.disconnect();
    chartRealtimeService.disconnect();
  }

  onMount(() => {
    // ⚡ MEMORY LEAK FIX: Subscribe and store unsubscribe function
    unsubscribeSidebar = sidebarStore.subscribe(value => {
      sidebarCollapsed = value;
    });

    api = new CoinbaseAPI();

    // Get initial price
    api.getTicker().then(price => {
      currentPrice = price;
    }).catch(error => {
    });

    // Update price periodically
    priceInterval = setInterval(async () => {
      if (connectionStatus === 'connected') {
        try {
          currentPrice = await api.getTicker();
        } catch (error) {
        }
      }
    }, 1000) as unknown as number;

    // ⚡ MEMORY LEAK FIX: Disconnect WebSockets on page close/reload
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      clearInterval(priceInterval);
      // ⚡ MEMORY LEAK FIX: Unsubscribe from sidebar store
      if (unsubscribeSidebar) {
        unsubscribeSidebar();
        unsubscribeSidebar = null;
      }
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  });

  onDestroy(() => {
    // ⚡ MEMORY LEAK FIX: Cleanup all WebSocket connections on component destroy
    tradingBackendService.disconnect();
    chartRealtimeService.disconnect();
  });

  function toggleSidebar(event: Event) {
    sidebarStore.toggle();
  }

  function handleDashboardToggle(event: CustomEvent) {
    toggleSidebar(event);
  }

  function handleNavigation(event: CustomEvent) {
    // Navigation is handled by the router
  }
</script>

<Router {url}>
  <main>
    <Route path="/">
      <Dashboard
        {currentPrice}
        bind:connectionStatus
        {sidebarCollapsed}
        on:toggle={handleDashboardToggle}
        on:navigate={handleNavigation}
      />
    </Route>
    <Route path="/dashboard">
      <Dashboard
        {currentPrice}
        bind:connectionStatus
        {sidebarCollapsed}
        on:toggle={handleDashboardToggle}
        on:navigate={handleNavigation}
      />
    </Route>
    <Route path="/portfolio">
      <Portfolio
        {currentPrice}
        bind:connectionStatus
        {sidebarCollapsed}
        on:toggle={toggleSidebar}
        on:navigate={handleNavigation}
      />
    </Route>
    <Route path="/paper-trading">
      <PaperTrading
        {currentPrice}
        bind:connectionStatus
        {sidebarCollapsed}
        on:toggle={toggleSidebar}
        on:navigate={handleNavigation}
      />
    </Route>
    <Route path="/backtesting">
      <Backtesting
        {currentPrice}
        bind:connectionStatus
        {sidebarCollapsed}
        on:toggle={toggleSidebar}
        on:navigate={handleNavigation}
      />
    </Route>
    <Route path="/trading">
      <Trading
        {currentPrice}
        bind:connectionStatus
        {sidebarCollapsed}
        on:toggle={toggleSidebar}
        on:navigate={handleNavigation}
      />
    </Route>
    <Route path="/vault">
      <Vault
        {currentPrice}
        bind:connectionStatus
        {sidebarCollapsed}
        on:toggle={toggleSidebar}
        on:navigate={handleNavigation}
      />
    </Route>
    <Route path="/news">
      <News
        {currentPrice}
        bind:connectionStatus
        {sidebarCollapsed}
        on:toggle={toggleSidebar}
        on:navigate={handleNavigation}
      />
    </Route>
  </main>
</Router>

<style>
  /* Global styles are centralized in design-system-consolidated.css */
  main {
    block-size: 100vh;
    background-color: var(--bg-main);
    overflow: auto;
  }
</style>