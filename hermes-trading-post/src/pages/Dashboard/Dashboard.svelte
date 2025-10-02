<script lang="ts">
  import CollapsibleSidebar from '../../components/layout/CollapsibleSidebar.svelte';
  import DashboardHeader from './components/DashboardHeader.svelte';
  import ChartPanel from './components/ChartPanel.svelte';
  import PortfolioPanel from './components/PortfolioPanel.svelte';
  import MarketStatsPanel from './components/MarketStatsPanel.svelte';
  import { 
    loadDashboardPreferences, 
    saveDashboardPreferences, 
    validGranularities, 
    autoSelectGranularity 
  } from './services/DashboardPreferences.svelte';
  import { onMount, createEventDispatcher } from 'svelte';
  
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

  // Load saved chart preferences
  const savedPrefs = loadDashboardPreferences();
  let selectedGranularity = savedPrefs.granularity;
  let selectedPeriod = savedPrefs.period;
  let autoGranularityActive = false;

  // Portfolio data (would typically come from stores/API)
  let btcBalance = 0.00000000;
  let usdBalance = 0.00;
  let totalValue = 0.00;

  // Market data (would typically come from API)
  let volume24h = '$2.4B';
  let high24h = '$118,234';
  let low24h = '$116,892';

  // Save preferences when they change
  $: if (selectedGranularity && selectedPeriod) {
    saveDashboardPreferences(selectedGranularity, selectedPeriod);
  }

  function handleGranularityChange(granularity: string) {
    selectedGranularity = granularity;
    console.log('Selected granularity:', granularity);
  }

  function handlePeriodChange(period: string) {
    selectedPeriod = period;
    console.log('Selected period:', period);
    
    // If current granularity is not valid for new period, select the best default
    selectedGranularity = autoSelectGranularity(period, selectedGranularity);
    if (selectedGranularity !== savedPrefs.granularity) {
      console.log('Auto-selected granularity:', selectedGranularity);
    }
  }

  function handleChartGranularityChange(newGranularity: string) {
    // Update button states smoothly
    if (selectedGranularity !== newGranularity) {
      console.log(`Auto-granularity changed to: ${newGranularity}`);
      selectedGranularity = newGranularity;
      autoGranularityActive = true;
      
      // Show auto indicator for 2 seconds
      setTimeout(() => {
        autoGranularityActive = false;
      }, 2000);
    }
  }

  onMount(() => {
    console.log('Dashboard mounted successfully');
  });
</script>

<div class="dashboard-layout">
  <CollapsibleSidebar 
    {currentPrice}
    {sidebarCollapsed} 
    activeSection="dashboard"
    on:toggle={toggleSidebar} 
    on:navigate={handleNavigation} 
  />
  
  <main class="dashboard-content" class:expanded={sidebarCollapsed}>
    <DashboardHeader {currentPrice} {connectionStatus} />
    
    <!-- Dashboard Grid -->
    <div class="dashboard-grid">
      <ChartPanel 
        bind:connectionStatus
        {selectedGranularity}
        {selectedPeriod}
        {autoGranularityActive}
        {validGranularities}
        onGranularityChange={handleGranularityChange}
        onPeriodChange={handlePeriodChange}
        onChartGranularityChange={handleChartGranularityChange}
      />
      
      <!-- Bottom Panels Row -->
      <div class="bottom-panels">
        <PortfolioPanel {btcBalance} {usdBalance} {totalValue} />
        <MarketStatsPanel {volume24h} {high24h} {low24h} />
      </div>
    </div>
  </main>
</div>

<style>
  .dashboard-layout {
    display: flex;
    height: 100vh;
    min-height: 600px;
    background: #0a0a0a;
    color: #d1d4dc;
  }

  /* Scrollbar styles are now centralized in design-system-consolidated.css */
  
  .dashboard-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    margin-left: 250px;
    width: calc(100% - 250px);
    transition: all 0.3s ease;
    overflow: hidden;
  }
  
  .dashboard-content.expanded {
    margin-left: 80px;
    width: calc(100% - 80px);
  }
  
  /* Dashboard Grid */
  .dashboard-grid {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 20px;
    padding: 20px;
    overflow: auto;
    min-height: 0; /* Allow flexbox to shrink properly */
  }
  
  .bottom-panels {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 20px;
    flex: 0 0 auto; /* Don't grow */
  }
</style>