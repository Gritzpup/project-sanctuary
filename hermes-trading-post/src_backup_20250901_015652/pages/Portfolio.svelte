<script lang="ts">
  import CollapsibleSidebar from './CollapsibleSidebar.svelte';
  import { createEventDispatcher } from 'svelte';
  
  export let currentPrice: number = 0;
  export let connectionStatus: 'connected' | 'disconnected' | 'error' | 'loading' = 'loading';
  export let sidebarCollapsed = false;
  
  const dispatch = createEventDispatcher();
  
  function toggleSidebar() {
    dispatch('toggle');
  }
  
  function handleNavigation(event: CustomEvent) {
    dispatch('navigate', event.detail);
  }
</script>

<div class="portfolio-container">
  <CollapsibleSidebar 
    {sidebarCollapsed} 
    activeSection="portfolio"
    on:toggle={toggleSidebar}
    on:navigate={handleNavigation}
  />
  
  <div class="main-content" class:sidebar-collapsed={sidebarCollapsed}>
    <div class="portfolio-header">
      <div class="header-left">
        <h1>Portfolio</h1>
        <div class="price-display">
          BTC/USD: ${currentPrice.toFixed(2)}
        </div>
      </div>
      <div class="header-right">
        <div class="connection-status" class:connected={connectionStatus === 'connected'}>
          {connectionStatus === 'connected' ? '🟢' : '🔴'} {connectionStatus}
        </div>
      </div>
    </div>
    
    <div class="portfolio-content">
      <div class="coming-soon">
        <h2>Portfolio View</h2>
        <p>Portfolio management features coming soon...</p>
      </div>
    </div>
  </div>
</div>

<style>
  .portfolio-container {
    display: flex;
    height: 100vh;
    background: #0a0a0a;
  }
  
  .main-content {
    flex: 1;
    margin-left: 250px;
    transition: margin-left 0.3s ease;
    display: flex;
    flex-direction: column;
  }
  
  .main-content.sidebar-collapsed {
    margin-left: 80px;
  }
  
  .portfolio-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20px;
    background: rgba(15, 15, 15, 0.95);
    border-bottom: 1px solid rgba(74, 0, 224, 0.3);
  }
  
  .header-left {
    display: flex;
    align-items: center;
    gap: 20px;
  }
  
  .header-left h1 {
    margin: 0;
    font-size: 24px;
    color: #a78bfa;
  }
  
  .price-display {
    font-size: 16px;
    color: #d1d4dc;
    font-weight: 500;
  }
  
  .header-right {
    display: flex;
    align-items: center;
    gap: 20px;
  }
  
  .connection-status {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 14px;
    color: #888;
  }
  
  .connection-status.connected {
    color: #26a69a;
  }
  
  .portfolio-content {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
  }
  
  .coming-soon {
    text-align: center;
    color: #888;
  }
  
  .coming-soon h2 {
    color: #a78bfa;
    margin-bottom: 10px;
  }
</style>