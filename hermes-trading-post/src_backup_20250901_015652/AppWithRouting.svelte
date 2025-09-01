<script>
  import { Router, Route, Link } from "svelte-routing";
  import { onMount } from "svelte";
  import Dashboard from "./pages/Dashboard.svelte";
  import PaperTradingDashboard from "./pages/PaperTradingV2/PaperTradingDashboard.svelte";
  import BacktestingDashboard from "./pages/BacktestingV2/BacktestingDashboard.svelte";
  import Trading from "./pages/Trading.svelte";
  import Vault from "./pages/Vault.svelte";
  import News from "./pages/News.svelte";
  import Chart from "./pages/Chart.svelte";
  import { websocketService } from "./services/websocket.js";
  import { connectionStatus, currentPrice, priceHistory, candleHistory } from "./stores/websocket.js";
  
  let url = "";
  
  const connectWebSocket = () => {
    websocketService.connect();
  };

  const disconnectWebSocket = () => {
    websocketService.disconnect();
  };

  onMount(() => {
    connectWebSocket();
    return () => {
      disconnectWebSocket();
    };
  });
</script>

<Router {url}>
  <nav class="main-nav">
    <div class="nav-links">
      <Link to="/" class="nav-link">Dashboard</Link>
      <Link to="/paper-trading" class="nav-link">Paper Trading</Link>
      <Link to="/backtesting" class="nav-link">Backtesting</Link>
      <Link to="/chart" class="nav-link">Chart</Link>
      <Link to="/trading" class="nav-link">Trading</Link>
      <Link to="/vault" class="nav-link">Vault</Link>
      <Link to="/news" class="nav-link">News</Link>
    </div>
    <div class="connection-status">
      {#if $connectionStatus === 'connected'}
        <span class="status-indicator connected"></span>
        Connected
      {:else if $connectionStatus === 'connecting'}
        <span class="status-indicator connecting"></span>
        Connecting...
      {:else}
        <span class="status-indicator disconnected"></span>
        Disconnected
      {/if}
      {#if $currentPrice}
        <span class="price">${$currentPrice.toFixed(2)}</span>
      {/if}
    </div>
  </nav>

  <main class="main-content">
    <Route path="/" component={Dashboard} />
    <Route path="/paper-trading">
      <PaperTradingDashboard 
        {currentPrice}
        {priceHistory}
        {candleHistory}
        {connectionStatus}
      />
    </Route>
    <Route path="/backtesting">
      <BacktestingDashboard 
        {currentPrice}
        {priceHistory}
        {candleHistory}
        {connectionStatus}
      />
    </Route>
    <Route path="/chart">
      <Chart 
        {currentPrice}
        {priceHistory}
        {candleHistory}
        {connectionStatus}
      />
    </Route>
    <Route path="/trading">
      <Trading 
        {currentPrice}
        {connectionStatus}
      />
    </Route>
    <Route path="/vault">
      <Vault 
        {currentPrice}
        {connectionStatus}
      />
    </Route>
    <Route path="/news">
      <News 
        {currentPrice}
        {connectionStatus}
      />
    </Route>
  </main>
</Router>

<style>
  :global(body) {
    margin: 0;
    padding: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
    background: #0a0a0a;
    color: #ffffff;
    overflow: hidden;
  }

  :global(*) {
    box-sizing: border-box;
  }

  .main-nav {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 20px;
    background: rgba(255, 255, 255, 0.02);
    border-bottom: 1px solid rgba(74, 0, 224, 0.3);
  }

  .nav-links {
    display: flex;
    gap: 20px;
  }

  :global(.nav-link) {
    color: #a78bfa;
    text-decoration: none;
    padding: 8px 16px;
    border-radius: 6px;
    transition: all 0.2s;
    font-weight: 500;
  }

  :global(.nav-link:hover) {
    background: rgba(74, 0, 224, 0.2);
  }

  :global(.nav-link[aria-current="page"]) {
    background: rgba(74, 0, 224, 0.3);
    color: #ffffff;
  }

  .connection-status {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 14px;
    color: #888;
  }

  .status-indicator {
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }

  .status-indicator.connected {
    background: #10b981;
  }

  .status-indicator.connecting {
    background: #f59e0b;
    animation: pulse 1s infinite;
  }

  .status-indicator.disconnected {
    background: #ef4444;
  }

  .price {
    color: #10b981;
    font-weight: bold;
  }

  .main-content {
    height: calc(100vh - 60px);
    overflow: auto;
  }

  @keyframes pulse {
    0%, 100% {
      opacity: 1;
    }
    50% {
      opacity: 0.3;
    }
  }
</style>