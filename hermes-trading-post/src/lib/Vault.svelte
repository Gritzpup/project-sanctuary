<script lang="ts">
  import CollapsibleSidebar from './CollapsibleSidebar.svelte';
  import { onMount, createEventDispatcher } from 'svelte';
  import { vaultService, type VaultData, type BotVault } from '../services/vaultService';
  
  export let currentPrice: number = 0;
  export let connectionStatus: 'connected' | 'disconnected' | 'error' | 'loading' = 'loading';
  
  const dispatch = createEventDispatcher();
  
  let sidebarCollapsed = false;
  
  function toggleSidebar() {
    sidebarCollapsed = !sidebarCollapsed;
  }
  
  function handleNavigation(event: CustomEvent) {
    dispatch('navigate', event.detail);
  }
  
  // Vault state
  let vaultData: VaultData = vaultService.getVaultData();
  let selectedAsset = 'BTC';
  let selectedBotId: string | null = null;
  
  // Subscribe to vault updates
  onMount(() => {
    const unsubscribe = vaultService.subscribe((data) => {
      vaultData = data;
    });
    
    return unsubscribe;
  });
  
  // Calculate total vault value
  $: totalVaultValue = Object.values(vaultData.assets).reduce((total, asset) => {
    return total + asset.vaults.reduce((assetTotal, vault) => assetTotal + vault.value, 0);
  }, 0);
  
  // Get selected asset data
  $: selectedAssetData = vaultData.assets[selectedAsset] || { 
    vaults: [], 
    totalValue: 0, 
    totalGrowth: 0 
  };
  
  // Get selected bot data
  $: selectedBot = selectedBotId 
    ? selectedAssetData.vaults.find(v => v.botId === selectedBotId) 
    : null;
  
  function formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  }
  
  function formatPercent(value: number): string {
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  }
  
  function getStrategyIcon(strategy: string): string {
    const icons: Record<string, string> = {
      'reverse-ratio': '🔄',
      'grid-trading': '⚡',
      'rsi-mean-reversion': '📊',
      'dca': '💰',
      'vwap-bounce': '📈'
    };
    return icons[strategy] || '🤖';
  }
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
      <h1>Vault Management</h1>
      <div class="header-stats">
        <div class="stat">
          <span class="label">Total Vault Value:</span>
          <span class="value highlight">{formatCurrency(totalVaultValue)}</span>
        </div>
        <div class="stat">
          <span class="label">Active Bots:</span>
          <span class="value">{vaultData.totalBots}</span>
        </div>
        <div class="stat">
          <span class="label">Total Growth:</span>
          <span class="value" class:positive={vaultData.totalGrowthPercent > 0} class:negative={vaultData.totalGrowthPercent < 0}>
            {formatPercent(vaultData.totalGrowthPercent)}
          </span>
        </div>
      </div>
    </div>
    
    <div class="vault-container">
      <!-- Asset Selection -->
      <div class="asset-tabs">
        {#each Object.keys(vaultData.assets) as asset}
          <button 
            class="asset-tab" 
            class:active={selectedAsset === asset}
            on:click={() => { selectedAsset = asset; selectedBotId = null; }}
          >
            {asset}
            <span class="asset-value">{formatCurrency(vaultData.assets[asset].totalValue)}</span>
          </button>
        {/each}
        <button class="asset-tab add-asset" disabled>
          + Add Asset (Coming Soon)
        </button>
      </div>
      
      <div class="vault-grid">
        <!-- Bot List -->
        <div class="bot-list-panel">
          <div class="panel-header">
            <h2>{selectedAsset} Bots ({selectedAssetData.vaults.length}/6)</h2>
            <button class="add-bot-btn" disabled={selectedAssetData.vaults.length >= 6}>
              + Add Bot
            </button>
          </div>
          <div class="bot-list">
            {#each selectedAssetData.vaults as vault}
              <div 
                class="bot-item" 
                class:selected={selectedBotId === vault.botId}
                on:click={() => selectedBotId = vault.botId}
              >
                <div class="bot-header">
                  <span class="bot-icon">{getStrategyIcon(vault.strategy)}</span>
                  <span class="bot-name">{vault.name}</span>
                  <span class="bot-status" class:active={vault.status === 'active'}>
                    {vault.status}
                  </span>
                </div>
                <div class="bot-stats">
                  <div class="bot-stat">
                    <span class="label">Value:</span>
                    <span class="value">{formatCurrency(vault.value)}</span>
                  </div>
                  <div class="bot-stat">
                    <span class="label">Growth:</span>
                    <span class="value" class:positive={vault.growthPercent > 0} class:negative={vault.growthPercent < 0}>
                      {formatPercent(vault.growthPercent)}
                    </span>
                  </div>
                </div>
              </div>
            {/each}
            
            {#if selectedAssetData.vaults.length === 0}
              <div class="empty-state">
                <p>No bots running for {selectedAsset}</p>
                <p class="hint">Start a bot from Paper Trading or Live Trading</p>
              </div>
            {/if}
          </div>
        </div>
        
        <!-- Bot Details -->
        <div class="bot-details-panel">
          {#if selectedBot}
            <div class="panel-header">
              <h2>{selectedBot.name}</h2>
              <div class="bot-actions">
                <button class="action-btn" disabled={selectedBot.status !== 'active'}>
                  Pause
                </button>
                <button class="action-btn danger">
                  Stop & Withdraw
                </button>
              </div>
            </div>
            <div class="bot-details">
              <div class="detail-section">
                <h3>Performance</h3>
                <div class="detail-grid">
                  <div class="detail-item">
                    <span class="label">Current Value:</span>
                    <span class="value">{formatCurrency(selectedBot.value)}</span>
                  </div>
                  <div class="detail-item">
                    <span class="label">Initial Deposit:</span>
                    <span class="value">{formatCurrency(selectedBot.initialDeposit)}</span>
                  </div>
                  <div class="detail-item">
                    <span class="label">Total Growth:</span>
                    <span class="value" class:positive={selectedBot.growthPercent > 0} class:negative={selectedBot.growthPercent < 0}>
                      {formatPercent(selectedBot.growthPercent)}
                    </span>
                  </div>
                  <div class="detail-item">
                    <span class="label">Profit/Loss:</span>
                    <span class="value" class:positive={selectedBot.value - selectedBot.initialDeposit > 0} class:negative={selectedBot.value - selectedBot.initialDeposit < 0}>
                      {formatCurrency(selectedBot.value - selectedBot.initialDeposit)}
                    </span>
                  </div>
                </div>
              </div>
              
              <div class="detail-section">
                <h3>Strategy Details</h3>
                <div class="detail-grid">
                  <div class="detail-item">
                    <span class="label">Strategy:</span>
                    <span class="value">{selectedBot.strategy}</span>
                  </div>
                  <div class="detail-item">
                    <span class="label">Total Trades:</span>
                    <span class="value">{selectedBot.totalTrades}</span>
                  </div>
                  <div class="detail-item">
                    <span class="label">Win Rate:</span>
                    <span class="value">{selectedBot.winRate.toFixed(1)}%</span>
                  </div>
                  <div class="detail-item">
                    <span class="label">Running Since:</span>
                    <span class="value">{new Date(selectedBot.startedAt).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
              
              <div class="detail-section">
                <h3>Deposit History</h3>
                <div class="deposit-list">
                  {#each selectedBot.deposits as deposit}
                    <div class="deposit-item">
                      <span class="deposit-date">{new Date(deposit.timestamp).toLocaleString()}</span>
                      <span class="deposit-amount">{formatCurrency(deposit.amount)}</span>
                      <span class="deposit-source">{deposit.source}</span>
                    </div>
                  {/each}
                </div>
              </div>
            </div>
          {:else}
            <div class="empty-state">
              <h3>Select a bot to view details</h3>
              <p>Click on any bot from the list to see its performance and settings</p>
            </div>
          {/if}
        </div>
        
        <!-- Summary Stats -->
        <div class="summary-panel">
          <div class="panel-header">
            <h2>{selectedAsset} Summary</h2>
          </div>
          <div class="summary-content">
            <div class="summary-item">
              <span class="label">Total {selectedAsset} Vault:</span>
              <span class="value large">{formatCurrency(selectedAssetData.totalValue)}</span>
            </div>
            <div class="summary-item">
              <span class="label">Average Growth:</span>
              <span class="value" class:positive={selectedAssetData.totalGrowth > 0} class:negative={selectedAssetData.totalGrowth < 0}>
                {formatPercent(selectedAssetData.totalGrowth)}
              </span>
            </div>
            <div class="summary-item">
              <span class="label">Active Bots:</span>
              <span class="value">{selectedAssetData.vaults.filter(v => v.status === 'active').length}</span>
            </div>
            <div class="summary-item">
              <span class="label">Best Performer:</span>
              <span class="value">
                {selectedAssetData.vaults.length > 0 
                  ? selectedAssetData.vaults.reduce((best, vault) => 
                      vault.growthPercent > best.growthPercent ? vault : best
                    ).name
                  : 'N/A'
                }
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </main>
</div>

<style>
  .dashboard-layout {
    display: flex;
    height: 100vh;
    background: #0a0a0a;
  }
  
  .dashboard-content {
    flex: 1;
    margin-left: 250px;
    transition: margin-left 0.3s ease;
    overflow-y: auto;
    padding: 20px;
  }
  
  .dashboard-content.expanded {
    margin-left: 80px;
  }
  
  .header {
    margin-bottom: 30px;
  }
  
  .header h1 {
    font-size: 28px;
    margin: 0 0 20px 0;
    color: #d1d4dc;
  }
  
  .header-stats {
    display: flex;
    gap: 40px;
    flex-wrap: wrap;
  }
  
  .stat {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }
  
  .stat .label {
    font-size: 12px;
    color: #888;
    text-transform: uppercase;
  }
  
  .stat .value {
    font-size: 24px;
    color: #d1d4dc;
    font-weight: 500;
  }
  
  .stat .value.highlight {
    color: #a78bfa;
  }
  
  .stat .value.positive {
    color: #26a69a;
  }
  
  .stat .value.negative {
    color: #ef5350;
  }
  
  .vault-container {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }
  
  .asset-tabs {
    display: flex;
    gap: 10px;
    border-bottom: 1px solid rgba(74, 0, 224, 0.3);
    padding-bottom: 20px;
  }
  
  .asset-tab {
    padding: 10px 20px;
    background: rgba(74, 0, 224, 0.1);
    border: 1px solid rgba(74, 0, 224, 0.3);
    color: #888;
    cursor: pointer;
    border-radius: 6px;
    font-size: 14px;
    transition: all 0.2s;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 5px;
  }
  
  .asset-tab:hover {
    background: rgba(74, 0, 224, 0.2);
    color: #a78bfa;
  }
  
  .asset-tab.active {
    background: rgba(74, 0, 224, 0.3);
    border-color: #a78bfa;
    color: #a78bfa;
  }
  
  .asset-tab.add-asset {
    border-style: dashed;
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .asset-value {
    font-size: 12px;
    font-weight: 600;
  }
  
  .vault-grid {
    display: grid;
    grid-template-columns: 1fr 2fr;
    grid-template-rows: auto 200px;
    gap: 20px;
  }
  
  .bot-list-panel,
  .bot-details-panel,
  .summary-panel {
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(74, 0, 224, 0.3);
    border-radius: 8px;
    overflow: hidden;
  }
  
  .bot-details-panel {
    grid-row: span 2;
  }
  
  .panel-header {
    padding: 15px 20px;
    background: rgba(74, 0, 224, 0.1);
    border-bottom: 1px solid rgba(74, 0, 224, 0.3);
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  .panel-header h2 {
    margin: 0;
    font-size: 16px;
    color: #a78bfa;
  }
  
  .add-bot-btn {
    padding: 6px 12px;
    background: rgba(74, 0, 224, 0.2);
    border: 1px solid rgba(74, 0, 224, 0.4);
    color: #a78bfa;
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
    transition: all 0.2s;
  }
  
  .add-bot-btn:hover:not(:disabled) {
    background: rgba(74, 0, 224, 0.3);
  }
  
  .add-bot-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .bot-list {
    padding: 15px;
    overflow-y: auto;
    max-height: 400px;
  }
  
  .bot-item {
    padding: 15px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(74, 0, 224, 0.2);
    border-radius: 6px;
    margin-bottom: 10px;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .bot-item:hover {
    background: rgba(74, 0, 224, 0.1);
    border-color: rgba(74, 0, 224, 0.4);
  }
  
  .bot-item.selected {
    background: rgba(74, 0, 224, 0.2);
    border-color: #a78bfa;
  }
  
  .bot-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 10px;
  }
  
  .bot-icon {
    font-size: 20px;
  }
  
  .bot-name {
    flex: 1;
    font-weight: 500;
    color: #d1d4dc;
  }
  
  .bot-status {
    padding: 4px 8px;
    background: rgba(255, 167, 38, 0.2);
    border: 1px solid rgba(255, 167, 38, 0.4);
    border-radius: 4px;
    color: #ffa726;
    font-size: 11px;
    text-transform: uppercase;
  }
  
  .bot-status.active {
    background: rgba(38, 166, 154, 0.2);
    border-color: rgba(38, 166, 154, 0.4);
    color: #26a69a;
  }
  
  .bot-stats {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }
  
  .bot-stat {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  
  .bot-stat .label {
    font-size: 11px;
    color: #888;
  }
  
  .bot-stat .value {
    font-size: 14px;
    color: #d1d4dc;
    font-weight: 500;
  }
  
  .bot-stat .value.positive {
    color: #26a69a;
  }
  
  .bot-stat .value.negative {
    color: #ef5350;
  }
  
  .empty-state {
    text-align: center;
    padding: 40px 20px;
    color: #888;
  }
  
  .empty-state h3 {
    margin: 0 0 10px 0;
    color: #a78bfa;
  }
  
  .empty-state .hint {
    font-size: 12px;
    color: #666;
  }
  
  .bot-actions {
    display: flex;
    gap: 10px;
  }
  
  .action-btn {
    padding: 6px 12px;
    background: rgba(74, 0, 224, 0.2);
    border: 1px solid rgba(74, 0, 224, 0.4);
    color: #a78bfa;
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
    transition: all 0.2s;
  }
  
  .action-btn:hover:not(:disabled) {
    background: rgba(74, 0, 224, 0.3);
  }
  
  .action-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .action-btn.danger {
    background: rgba(239, 83, 80, 0.2);
    border-color: rgba(239, 83, 80, 0.4);
    color: #ef5350;
  }
  
  .action-btn.danger:hover {
    background: rgba(239, 83, 80, 0.3);
  }
  
  .bot-details {
    padding: 20px;
    overflow-y: auto;
  }
  
  .detail-section {
    margin-bottom: 30px;
  }
  
  .detail-section h3 {
    margin: 0 0 15px 0;
    font-size: 14px;
    color: #a78bfa;
    text-transform: uppercase;
  }
  
  .detail-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 15px;
  }
  
  .detail-item {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }
  
  .detail-item .label {
    font-size: 12px;
    color: #888;
  }
  
  .detail-item .value {
    font-size: 16px;
    color: #d1d4dc;
    font-weight: 500;
  }
  
  .detail-item .value.positive {
    color: #26a69a;
  }
  
  .detail-item .value.negative {
    color: #ef5350;
  }
  
  .deposit-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  
  .deposit-item {
    display: grid;
    grid-template-columns: 2fr 1fr 1fr;
    gap: 10px;
    padding: 10px;
    background: rgba(255, 255, 255, 0.02);
    border-radius: 4px;
    font-size: 12px;
  }
  
  .deposit-date {
    color: #888;
  }
  
  .deposit-amount {
    color: #26a69a;
    font-weight: 500;
  }
  
  .deposit-source {
    color: #a78bfa;
    text-align: right;
  }
  
  .summary-panel {
    grid-column: 1;
  }
  
  .summary-content {
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 15px;
  }
  
  .summary-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  .summary-item .label {
    font-size: 12px;
    color: #888;
  }
  
  .summary-item .value {
    font-size: 14px;
    color: #d1d4dc;
    font-weight: 500;
  }
  
  .summary-item .value.large {
    font-size: 20px;
    color: #a78bfa;
  }
  
  .summary-item .value.positive {
    color: #26a69a;
  }
  
  .summary-item .value.negative {
    color: #ef5350;
  }
</style>