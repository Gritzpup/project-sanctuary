<script lang="ts">
  import Dashboard from './lib/Dashboard.svelte';
  import { CoinbaseAPI } from './services/coinbaseApi';
  import { onMount } from 'svelte';

  let currentPrice: number = 0;
  let connectionStatus: 'connected' | 'disconnected' | 'error' | 'loading' = 'loading';
  let api: CoinbaseAPI;

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
</script>

<main>
  <Dashboard {currentPrice} bind:connectionStatus />
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
    height: 100vh;
    overflow: hidden;
  }
</style>