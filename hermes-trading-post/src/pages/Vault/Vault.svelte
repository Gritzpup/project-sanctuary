<script lang="ts">
  // @ts-nocheck - VaultData type compatibility with mock data structures
  import CollapsibleSidebar from '../../components/layout/CollapsibleSidebar.svelte';
  import VaultHeader from './components/VaultHeader.svelte';
  import VaultTabs from './components/VaultTabs.svelte';
  import VaultOverview from './components/VaultOverview.svelte';
  import BotVaults from './components/BotVaults.svelte';
  import TransactionHistory from './components/TransactionHistory.svelte';
  import { loadVaultData } from './components/VaultDataService.svelte';
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import { type VaultData, type BotVault } from '../../services/state/vaultService';
  
  export let currentPrice: number = 0;
  export const connectionStatus: 'connected' | 'disconnected' | 'error' | 'loading' = 'loading';
  export let sidebarCollapsed = false;

  const dispatch = createEventDispatcher();

  function toggleSidebar() {
    dispatch('toggle');
  }

  function handleNavigation(event: CustomEvent) {
    dispatch('navigate', event.detail);
  }

  // Vault state
  let vaultData: VaultData | null = null;
  let isLoading = false;
  let selectedView: 'overview' | 'bots' | 'history' = 'overview';

  // Growth calculations
  let totalValue = 0;
  let dailyGrowth = 0;
  let weeklyGrowth = 0;
  let monthlyGrowth = 0;

  // Bot vaults
  let botVaults: BotVault[] = [];
  let selectedBot: string | null = null;

  // Transaction history
  let transactions: any[] = [];
  let transactionPage = 1;
  let transactionsPerPage = 20;

  // Auto-refresh
  let refreshInterval: NodeJS.Timer | null = null;

  // Load vault data
  async function loadData() {
    isLoading = true;
    
    try {
      const data = await loadVaultData(currentPrice);
      vaultData = data.vaultData;
      botVaults = data.botVaults;
      transactions = data.transactions;
      
      // Calculate totals
      if (vaultData) {
        totalValue = vaultData.totalValue;
        dailyGrowth = vaultData.dailyGrowth;
        weeklyGrowth = vaultData.weeklyGrowth;
        monthlyGrowth = vaultData.monthlyGrowth;
      }
    } catch (error) {
    } finally {
      isLoading = false;
    }
  }

  function handleViewChange(event: CustomEvent) {
    selectedView = event.detail.view;
  }

  onMount(() => {
    loadData();
    
    // Set up auto-refresh
    refreshInterval = setInterval(loadData, 30000); // Refresh every 30 seconds
  });

  onDestroy(() => {
    if (refreshInterval) {
      clearInterval(refreshInterval);
    }
  });
</script>

<div class="dashboard-layout">
  <CollapsibleSidebar 
    {sidebarCollapsed}
    activeSection="vault"
    on:toggle={toggleSidebar}
    on:navigate={handleNavigation}
  />
  
  <main class="dashboard-content" class:expanded={sidebarCollapsed}>
    <VaultHeader {totalValue} {dailyGrowth} />
    
    <div class="content-wrapper">
      <div class="vault-container">
        <VaultTabs {selectedView} on:viewChange={handleViewChange} />
        
        {#if isLoading && !vaultData}
          <div class="loading">Loading vault data...</div>
        {:else if selectedView === 'overview'}
          <VaultOverview {vaultData} {dailyGrowth} {weeklyGrowth} {monthlyGrowth} />
        {:else if selectedView === 'bots'}
          <BotVaults {botVaults} bind:selectedBot />
        {:else if selectedView === 'history'}
          <TransactionHistory {transactions} bind:transactionPage {transactionsPerPage} />
        {/if}
      </div>
    </div>
  </main>
</div>

<style>
  .dashboard-layout {
    display: flex;
    min-height: 100vh;
    background: #0a0a0a;
    color: #d1d4dc;
  }

  .dashboard-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    margin-left: 250px;
    width: calc(100% - 250px);
    transition: all 0.3s ease;
  }

  .dashboard-content.expanded {
    margin-left: 80px;
    width: calc(100% - 80px);
  }

  .content-wrapper {
    flex: 1;
    overflow-y: auto;
    padding: 20px;
  }

  .vault-container {
    max-width: 1400px;
    margin: 0 auto;
  }

  .loading {
    text-align: center;
    padding: 40px;
    color: #758696;
  }
</style>