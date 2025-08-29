<script lang="ts">
  import CollapsibleSidebar from './CollapsibleSidebar.svelte';
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import { vaultService, type VaultData, type BotVault } from '../services/vaultService';
  
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
  
  // Vault state
  let vaultData: VaultData | null = null;
  let isLoading = false;
  let selectedView: 'overview' | 'bots' | 'history' = 'overview';
  let selectedTimeframe = '7d';
  
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
  
  // Mock data generator
  function generateMockVaultData(): VaultData {
    return {
      btcVault: {
        balance: 0.5234,
        value: 0.5234 * currentPrice,
        growthPercent: 5.2
      },
      usdVault: {
        balance: 15000,
        value: 15000,
        growthPercent: 3.1
      },
      usdcVault: {
        balance: 10000,
        value: 10000,
        growthPercent: 2.8
      },
      totalValue: 0.5234 * currentPrice + 25000,
      dailyGrowth: 1.2,
      weeklyGrowth: 5.8,
      monthlyGrowth: 12.3,
      lastUpdated: Date.now()
    };
  }
  
  // Generate mock bot vaults
  function generateMockBotVaults(): BotVault[] {
    return [
      {
        botId: 'reverse-ratio-bot-1',
        botName: 'Reverse Ratio Bot 1',
        strategy: 'reverse-ratio',
        btcBalance: 0.0234,
        usdBalance: 2500,
        totalValue: 0.0234 * currentPrice + 2500,
        profitPercent: 8.5,
        status: 'running'
      },
      {
        botId: 'grid-bot-1',
        botName: 'Grid Trading Bot 1',
        strategy: 'grid-trading',
        btcBalance: 0.0156,
        usdBalance: 1800,
        totalValue: 0.0156 * currentPrice + 1800,
        profitPercent: -2.3,
        status: 'paused'
      },
      {
        botId: 'dca-bot-1',
        botName: 'DCA Bot 1',
        strategy: 'dca',
        btcBalance: 0.0412,
        usdBalance: 500,
        totalValue: 0.0412 * currentPrice + 500,
        profitPercent: 15.7,
        status: 'running'
      }
    ];
  }
  
  // Generate mock transactions
  function generateMockTransactions(): any[] {
    const types = ['deposit', 'withdraw', 'trade', 'compound'];
    const transactions = [];
    
    for (let i = 0; i < 50; i++) {
      transactions.push({
        id: `tx-${i}`,
        type: types[Math.floor(Math.random() * types.length)],
        amount: Math.random() * 1000,
        currency: Math.random() > 0.5 ? 'BTC' : 'USD',
        timestamp: Date.now() - Math.random() * 86400000 * 30,
        status: 'completed',
        description: 'Vault transaction'
      });
    }
    
    return transactions.sort((a, b) => b.timestamp - a.timestamp);
  }
  
  // Load vault data
  async function loadVaultData() {
    isLoading = true;
    
    try {
      // Use mock data for now
      vaultData = generateMockVaultData();
      botVaults = generateMockBotVaults();
      transactions = generateMockTransactions();
      
      // Calculate totals
      if (vaultData) {
        totalValue = vaultData.totalValue;
        dailyGrowth = vaultData.dailyGrowth;
        weeklyGrowth = vaultData.weeklyGrowth;
        monthlyGrowth = vaultData.monthlyGrowth;
      }
    } catch (error) {
      console.error('Failed to load vault data:', error);
    } finally {
      isLoading = false;
    }
  }
  
  // Format currency
  function formatCurrency(value: number, currency: string = 'USD'): string {
    if (currency === 'BTC') {
      return `${value.toFixed(6)} BTC`;
    }
    return `$${value.toFixed(2)}`;
  }
  
  // Format percentage
  function formatPercent(value: number): string {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(2)}%`;
  }
  
  // Format timestamp
  function formatDate(timestamp: number): string {
    return new Date(timestamp).toLocaleDateString();
  }
  
  // Pagination
  $: paginatedTransactions = transactions.slice(
    (transactionPage - 1) * transactionsPerPage,
    transactionPage * transactionsPerPage
  );
  
  $: totalTransactionPages = Math.ceil(transactions.length / transactionsPerPage);
  
  onMount(() => {
    loadVaultData();
    
    // Set up auto-refresh
    refreshInterval = setInterval(loadVaultData, 30000); // Refresh every 30 seconds
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
    <div class="header">
      <h1>Vault</h1>
      <div class="header-stats">
        <div class="stat-item">
          <span class="stat-label">Total Value</span>
          <span class="stat-value price">{formatCurrency(totalValue)}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">24h Growth</span>
          <span class="stat-value" class:positive={dailyGrowth >= 0} class:negative={dailyGrowth < 0}>
            {formatPercent(dailyGrowth)}
          </span>
        </div>
      </div>
    </div>
    
    <div class="content-wrapper">
      <div class="vault-container">
        <!-- View tabs -->
        <div class="view-tabs">
          <button 
            class="view-tab" 
            class:active={selectedView === 'overview'}
            on:click={() => selectedView = 'overview'}
          >
            Overview
          </button>
          <button 
            class="view-tab" 
            class:active={selectedView === 'bots'}
            on:click={() => selectedView = 'bots'}
          >
            Bot Vaults
          </button>
          <button 
            class="view-tab" 
            class:active={selectedView === 'history'}
            on:click={() => selectedView = 'history'}
          >
            History
          </button>
        </div>
        
        {#if isLoading && !vaultData}
          <div class="loading">Loading vault data...</div>
        {:else if selectedView === 'overview'}
          <!-- Overview -->
          <div class="overview-grid">
            <!-- Main vaults -->
            <div class="vault-card">
              <h3>BTC Vault</h3>
              <div class="vault-balance">{vaultData?.btcVault.balance.toFixed(6)} BTC</div>
              <div class="vault-value">{formatCurrency(vaultData?.btcVault.value || 0)}</div>
              <div class="vault-growth" class:positive={vaultData?.btcVault.growthPercent >= 0}>
                {formatPercent(vaultData?.btcVault.growthPercent || 0)}
              </div>
            </div>
            
            <div class="vault-card">
              <h3>USD Growth Vault</h3>
              <div class="vault-balance">{formatCurrency(vaultData?.usdVault.balance || 0)}</div>
              <div class="vault-growth" class:positive={vaultData?.usdVault.growthPercent >= 0}>
                {formatPercent(vaultData?.usdVault.growthPercent || 0)}
              </div>
            </div>
            
            <div class="vault-card">
              <h3>USDC Vault</h3>
              <div class="vault-balance">{formatCurrency(vaultData?.usdcVault.balance || 0)}</div>
              <div class="vault-growth" class:positive={vaultData?.usdcVault.growthPercent >= 0}>
                {formatPercent(vaultData?.usdcVault.growthPercent || 0)}
              </div>
            </div>
            
            <!-- Growth metrics -->
            <div class="metrics-card">
              <h3>Growth Metrics</h3>
              <div class="metric-row">
                <span>Daily:</span>
                <span class:positive={dailyGrowth >= 0} class:negative={dailyGrowth < 0}>
                  {formatPercent(dailyGrowth)}
                </span>
              </div>
              <div class="metric-row">
                <span>Weekly:</span>
                <span class:positive={weeklyGrowth >= 0} class:negative={weeklyGrowth < 0}>
                  {formatPercent(weeklyGrowth)}
                </span>
              </div>
              <div class="metric-row">
                <span>Monthly:</span>
                <span class:positive={monthlyGrowth >= 0} class:negative={monthlyGrowth < 0}>
                  {formatPercent(monthlyGrowth)}
                </span>
              </div>
            </div>
          </div>
        {:else if selectedView === 'bots'}
          <!-- Bot Vaults -->
          <div class="bots-grid">
            {#each botVaults as bot}
              <div class="bot-vault-card" class:selected={selectedBot === bot.botId}>
                <div class="bot-header">
                  <h3>{bot.botName}</h3>
                  <span class="bot-status" class:running={bot.status === 'running'}>
                    {bot.status}
                  </span>
                </div>
                <div class="bot-strategy">{bot.strategy}</div>
                <div class="bot-balances">
                  <div>{bot.btcBalance.toFixed(6)} BTC</div>
                  <div>{formatCurrency(bot.usdBalance)}</div>
                </div>
                <div class="bot-value">{formatCurrency(bot.totalValue)}</div>
                <div class="bot-profit" class:positive={bot.profitPercent >= 0} class:negative={bot.profitPercent < 0}>
                  {formatPercent(bot.profitPercent)}
                </div>
              </div>
            {/each}
          </div>
        {:else if selectedView === 'history'}
          <!-- Transaction History -->
          <div class="history-container">
            <table class="transactions-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {#each paginatedTransactions as tx}
                  <tr>
                    <td>{formatDate(tx.timestamp)}</td>
                    <td class="tx-type {tx.type}">{tx.type}</td>
                    <td>{formatCurrency(tx.amount, tx.currency)}</td>
                    <td class="tx-status">{tx.status}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
            
            {#if totalTransactionPages > 1}
              <div class="pagination">
                <button 
                  on:click={() => transactionPage = Math.max(1, transactionPage - 1)}
                  disabled={transactionPage === 1}
                >
                  Previous
                </button>
                
                <span class="page-info">
                  Page {transactionPage} of {totalTransactionPages}
                </span>
                
                <button 
                  on:click={() => transactionPage = Math.min(totalTransactionPages, transactionPage + 1)}
                  disabled={transactionPage === totalTransactionPages}
                >
                  Next
                </button>
              </div>
            {/if}
          </div>
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

  .header {
    padding: 20px;
    background: #0f0f0f;
    border-bottom: 1px solid rgba(74, 0, 224, 0.3);
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .header h1 {
    margin: 0;
    font-size: 24px;
    color: #a78bfa;
  }

  .header-stats {
    display: flex;
    gap: 30px;
  }

  .stat-item {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  .stat-label {
    font-size: 12px;
    color: #758696;
    text-transform: uppercase;
  }

  .stat-value {
    font-size: 18px;
    font-weight: 600;
  }

  .stat-value.price {
    color: #26a69a;
  }

  .stat-value.positive,
  .positive {
    color: #22c55e;
  }

  .stat-value.negative,
  .negative {
    color: #ef4444;
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

  .view-tabs {
    display: flex;
    gap: 10px;
    margin-bottom: 20px;
  }

  .view-tab {
    padding: 10px 20px;
    background: rgba(74, 0, 224, 0.1);
    border: 1px solid rgba(74, 0, 224, 0.3);
    border-radius: 6px;
    color: #9ca3af;
    cursor: pointer;
    transition: all 0.2s;
  }

  .view-tab.active {
    background: rgba(74, 0, 224, 0.3);
    border-color: rgba(74, 0, 224, 0.6);
    color: #a78bfa;
  }

  .loading {
    text-align: center;
    padding: 40px;
    color: #758696;
  }

  .overview-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 20px;
  }

  .vault-card,
  .metrics-card {
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(74, 0, 224, 0.3);
    border-radius: 8px;
    padding: 20px;
  }

  .vault-card h3,
  .metrics-card h3 {
    margin: 0 0 15px 0;
    color: #a78bfa;
    font-size: 16px;
  }

  .vault-balance {
    font-size: 24px;
    font-weight: 600;
    color: #d1d4dc;
    margin-bottom: 8px;
  }

  .vault-value {
    font-size: 14px;
    color: #9ca3af;
    margin-bottom: 8px;
  }

  .vault-growth {
    font-size: 16px;
    font-weight: 600;
  }

  .metric-row {
    display: flex;
    justify-content: space-between;
    padding: 8px 0;
    border-bottom: 1px solid rgba(74, 0, 224, 0.2);
  }

  .metric-row:last-child {
    border-bottom: none;
  }

  .bots-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 20px;
  }

  .bot-vault-card {
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(74, 0, 224, 0.3);
    border-radius: 8px;
    padding: 20px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .bot-vault-card:hover {
    background: rgba(255, 255, 255, 0.04);
    border-color: rgba(74, 0, 224, 0.5);
  }

  .bot-vault-card.selected {
    border-color: rgba(74, 0, 224, 0.8);
    background: rgba(74, 0, 224, 0.1);
  }

  .bot-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 10px;
  }

  .bot-header h3 {
    margin: 0;
    font-size: 16px;
    color: #a78bfa;
  }

  .bot-status {
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 11px;
    text-transform: uppercase;
    background: rgba(107, 114, 128, 0.2);
    color: #6b7280;
  }

  .bot-status.running {
    background: rgba(34, 197, 94, 0.2);
    color: #22c55e;
  }

  .bot-strategy {
    font-size: 12px;
    color: #758696;
    text-transform: uppercase;
    margin-bottom: 12px;
  }

  .bot-balances {
    display: flex;
    justify-content: space-between;
    margin-bottom: 8px;
    font-size: 14px;
    color: #9ca3af;
  }

  .bot-value {
    font-size: 18px;
    font-weight: 600;
    color: #d1d4dc;
    margin-bottom: 8px;
  }

  .bot-profit {
    font-size: 16px;
    font-weight: 600;
  }

  .history-container {
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(74, 0, 224, 0.3);
    border-radius: 8px;
    padding: 20px;
  }

  .transactions-table {
    width: 100%;
    border-collapse: collapse;
  }

  .transactions-table th {
    text-align: left;
    padding: 12px;
    border-bottom: 1px solid rgba(74, 0, 224, 0.3);
    color: #a78bfa;
    font-size: 12px;
    text-transform: uppercase;
  }

  .transactions-table td {
    padding: 12px;
    border-bottom: 1px solid rgba(74, 0, 224, 0.1);
    color: #9ca3af;
    font-size: 14px;
  }

  .tx-type {
    text-transform: capitalize;
  }

  .tx-type.deposit {
    color: #22c55e;
  }

  .tx-type.withdraw {
    color: #ef4444;
  }

  .tx-type.trade {
    color: #3b82f6;
  }

  .tx-type.compound {
    color: #fbbf24;
  }

  .tx-status {
    font-size: 12px;
    text-transform: uppercase;
  }

  .pagination {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 20px;
    margin-top: 20px;
  }

  .pagination button {
    padding: 8px 16px;
    background: rgba(74, 0, 224, 0.2);
    border: 1px solid rgba(74, 0, 224, 0.4);
    border-radius: 4px;
    color: #a78bfa;
    cursor: pointer;
    transition: all 0.2s;
  }

  .pagination button:hover:not(:disabled) {
    background: rgba(74, 0, 224, 0.3);
    border-color: rgba(74, 0, 224, 0.6);
  }

  .pagination button:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .page-info {
    color: #9ca3af;
    font-size: 14px;
  }
</style>