<script lang="ts">
  import Dashboard from './lib/Dashboard.svelte';
  import PaperTrading from './lib/PaperTrading.svelte';
  import Backtesting from './lib/Backtesting.svelte';
  import Trading from './lib/Trading.svelte';
  import Vault from './lib/Vault.svelte';
  import News from './lib/News.svelte';
  import { CoinbaseAPI } from './services/coinbaseApi';
  import { onMount } from 'svelte';
  import { sidebarStore } from './stores/sidebarStore';

  let currentPrice: number = 0;
  let connectionStatus: 'connected' | 'disconnected' | 'error' | 'loading' = 'loading';
  let api: CoinbaseAPI;
  let currentSection: 'dashboard' | 'paper-trading' | 'backtesting' | 'trading' | 'vault' | 'news' = 'dashboard';
  
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
    currentSection = event.detail.section;
  }

  function toggleSidebar() {
    sidebarStore.toggle();
  }
</script>

<main>
  {#if currentSection === 'dashboard'}
    <Dashboard {currentPrice} bind:connectionStatus {sidebarCollapsed} on:toggle={toggleSidebar} on:navigate={handleNavigation} />
  {:else if currentSection === 'paper-trading'}
    <PaperTrading {currentPrice} bind:connectionStatus {sidebarCollapsed} on:toggle={toggleSidebar} on:navigate={handleNavigation} />
  {:else if currentSection === 'backtesting'}
    <Backtesting {currentPrice} bind:connectionStatus {sidebarCollapsed} on:toggle={toggleSidebar} on:navigate={handleNavigation} />
  {:else if currentSection === 'trading'}
    <Trading {currentPrice} bind:connectionStatus {sidebarCollapsed} on:toggle={toggleSidebar} on:navigate={handleNavigation} />
  {:else if currentSection === 'vault'}
    <Vault {currentPrice} bind:connectionStatus {sidebarCollapsed} on:toggle={toggleSidebar} on:navigate={handleNavigation} />
  {:else if currentSection === 'news'}
    <News {currentPrice} bind:connectionStatus {sidebarCollapsed} on:toggle={toggleSidebar} on:navigate={handleNavigation} />
  {/if}
</main>

<style>
  :global(body) {
    margin: 0;
    padding: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
    background-color: #0d0d0d;
    color: #d1d4dc;
  }

  main {
    min-height: 100vh;
  }
</style>