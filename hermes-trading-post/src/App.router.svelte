<script lang="ts">
  import { Router, Route, navigate } from 'svelte-routing';
  import Dashboard from './pages/Dashboard.svelte';
  import PaperTrading from './pages/PaperTrading.svelte';
  import Backtesting from './pages/Backtesting.svelte';
  import Trading from './pages/Trading.svelte';
  import Vault from './pages/Vault.svelte';
  import News from './pages/News.svelte';
  import { CoinbaseAPI } from './services/api/coinbaseApi';
  import { onMount } from 'svelte';
  import { sidebarStore } from './stores/sidebarStore';

  export let url = "";

  let currentPrice: number = 0;
  let connectionStatus: 'connected' | 'disconnected' | 'error' | 'loading' = 'loading';
  let api: CoinbaseAPI;
  
  // Subscribe to sidebar store
  let sidebarCollapsed = false;
  sidebarStore.subscribe(value => {
    sidebarCollapsed = value;
  });

  let priceInterval: number;

  onMount(() => {
    api = new CoinbaseAPI();
    
    // Get initial price
    api.getTicker().then(price => {
      currentPrice = price;
    }).catch(error => {
      console.error('Error fetching initial price:', error);
    });

    // Update price periodically
    priceInterval = setInterval(async () => {
      if (connectionStatus === 'connected') {
        try {
          currentPrice = await api.getTicker();
        } catch (error) {
          console.error('Error updating price:', error);
        }
      }
    }, 1000) as unknown as number;

    return () => {
      clearInterval(priceInterval);
    };
  });

  function handleNavigation(event: CustomEvent) {
    navigate(event.detail.section);
  }

  function toggleSidebar() {
    sidebarStore.toggle();
  }
</script>

<Router {url}>
  <main>
    <Route path="/">
      <Dashboard {currentPrice} bind:connectionStatus {sidebarCollapsed} on:toggle={toggleSidebar} on:navigate={handleNavigation} />
    </Route>
    <Route path="/dashboard">
      <Dashboard {currentPrice} bind:connectionStatus {sidebarCollapsed} on:toggle={toggleSidebar} on:navigate={handleNavigation} />
    </Route>
    <Route path="/paper-trading">
      <PaperTrading {currentPrice} bind:connectionStatus {sidebarCollapsed} on:toggle={toggleSidebar} on:navigate={handleNavigation} />
    </Route>
    <Route path="/backtesting">
      <Backtesting {currentPrice} bind:connectionStatus {sidebarCollapsed} on:toggle={toggleSidebar} on:navigate={handleNavigation} />
    </Route>
    <Route path="/trading">
      <Trading {currentPrice} bind:connectionStatus {sidebarCollapsed} on:toggle={toggleSidebar} on:navigate={handleNavigation} />
    </Route>
    <Route path="/vault">
      <Vault {currentPrice} bind:connectionStatus {sidebarCollapsed} on:toggle={toggleSidebar} on:navigate={handleNavigation} />
    </Route>
    <Route path="/news">
      <News {currentPrice} bind:connectionStatus {sidebarCollapsed} on:toggle={toggleSidebar} on:navigate={handleNavigation} />
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