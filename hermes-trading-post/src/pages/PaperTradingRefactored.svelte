<script lang="ts">
  // Import CSS
  import '../styles/paper-trading.css';
  
  // Layout Components
  import CollapsibleSidebar from './CollapsibleSidebar.svelte';
  
  // Trading Components
  import Chart from './ChartRefactored.svelte';
  import BotTabs from './PaperTrading/BotTabs.svelte';
  
  // Services & Stores
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import { get } from 'svelte/store';
  import { tradingBackendService } from '../services/tradingBackendService';
  import { paperTestService } from '../services/paperTestService';
  import { paperTradingManager } from '../services/paperTradingManager';
  import type { ChartDataFeed } from '../services/chartDataFeed';
  import { ReverseRatioStrategy } from '../strategies/implementations/ReverseRatioStrategy';
  import { GridTradingStrategy } from '../strategies/implementations/GridTradingStrategy';
  import { RSIMeanReversionStrategy } from '../strategies/implementations/RSIMeanReversionStrategy';
  import { DCAStrategy } from '../strategies/implementations/DCAStrategy';
  import { VWAPBounceStrategy } from '../strategies/implementations/VWAPBounceStrategy';
  import { MicroScalpingStrategy } from '../strategies/implementations/MicroScalpingStrategy';
  import { ProperScalpingStrategy } from '../strategies/implementations/ProperScalpingStrategy';
  import type { Strategy } from '../strategies/base/Strategy';
  import type { Position } from '../strategies/base/StrategyTypes';
  import { strategyStore } from '../stores/strategyStore';
  import { chartPreferencesStore } from '../stores/chartPreferencesStore';
  
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
  const savedPrefs = chartPreferencesStore.getPreferences('paper-trading');
  let selectedGranularity = savedPrefs.granularity;
  let selectedPeriod = savedPrefs.period;
  let autoGranularityActive = false;
  
  // Save preferences when they change
  $: chartPreferencesStore.setPreferences('paper-trading', selectedGranularity, selectedPeriod);
  
  // Paper trading state
  let isRunning = false;
  let isPaused = false;
  let selectedStrategyType = 'reverse-ratio';
  let currentStrategy: Strategy | null = null;
  
  // Bot manager state
  const managerState = paperTradingManager.getState();
  let activeBotInstance: any = null;
  let botTabs: any[] = [];
  
  // Tab state for strategy panel
  let activeTab: 'config' | 'code' = 'config';
  let strategySourceCode = '';
  
  // Current balances and metrics
  let balance = 10000;
  let btcBalance = 0;
  let vaultBalance = 0;
  let btcVaultBalance = 0;
  let trades: any[] = [];
  let positions: any[] = [];
  let totalReturn = 0;
  let winRate = 0;
  let totalFees = 0;
  let totalRebates = 0;
  let startingBalanceGrowth = 0;
  
  // Chart data feed for strategy
  let chartDataFeed: ChartDataFeed | null = null;
  let dataFeedInterval: NodeJS.Timer | null = null;
  
  // UI state
  let isEditingBalance = false;
  let editingBalance = '10000';
  
  // Paper Test state
  let selectedTestDate: Date | null = null;
  let selectedTestDateString: string = '';
  let isPaperTestRunning = false;
  let isPaperTestMode = false;
  let paperTestProgress = 0;
  let paperTestSimTime: Date | null = null;
  let paperTestResults: any = null;
  let showPaperTestResults = false;
  
  // Paper Test playback controls
  let paperTestPlaybackSpeed = 1;
  let paperTestIsPaused = false;
  let paperTestPositions: any[] = [];
  let paperTestBalance = 0;
  let paperTestBtcBalance = 0;
  let paperTestCurrentPrice = 0;
  let showSpeedDropdown = false;
  
  // Chart references
  let chartInstance: any = null;
  let candleSeriesInstance: any = null;
  
  // Built-in strategies
  const builtInStrategies = [
    { value: 'reverse-ratio', label: 'Reverse Ratio', description: 'Grid trading with reverse position sizing', isCustom: false },
    { value: 'grid-trading', label: 'Grid Trading', description: 'Classic grid trading strategy', isCustom: false },
    { value: 'rsi-mean-reversion', label: 'RSI Mean Reversion', description: 'Trade RSI oversold/overbought', isCustom: false },
    { value: 'dca', label: 'Dollar Cost Averaging', description: 'Regular periodic purchases', isCustom: false },
    { value: 'vwap-bounce', label: 'VWAP Bounce', description: 'Trade VWAP support/resistance', isCustom: false },
    { value: 'micro-scalping', label: 'Micro Scalping', description: 'High-frequency trading', isCustom: false },
    { value: 'proper-scalping', label: 'Proper Scalping', description: 'Professional scalping', isCustom: false }
  ];
  
  let customStrategies: any[] = [];
  let strategyParameters: Record<string, any> = {};
  
  $: strategies = [...builtInStrategies, ...customStrategies];
  
  // Helper functions
  function handleStrategyChange(event: Event) {
    const select = event.target as HTMLSelectElement;
    paperTradingManager.selectStrategy(select.value);
  }
  
  function clearBotData() {
    isRunning = false;
    isPaused = false;
    balance = 10000;
    btcBalance = 0;
    vaultBalance = 0;
    btcVaultBalance = 0;
    positions = [];
    trades = [];
    totalReturn = 0;
    winRate = 0;
    totalFees = 0;
    totalRebates = 0;
    startingBalanceGrowth = 0;
    currentStrategy = null;
    strategyParameters = {};
  }
  
  function handleBotTabSelect(event: CustomEvent) {
    const { botId } = event.detail;
    
    // Unsubscribe from current bot first
    if (activeBotStateUnsubscribe) {
      activeBotStateUnsubscribe();
      activeBotStateUnsubscribe = null;
    }
    
    // Clear bot data
    clearBotData();
    
    // Select new bot
    paperTradingManager.selectBot(botId);
    
    // Force immediate sync with backend
    setTimeout(() => {
      // Request fresh manager state
      const freshState = paperTradingManager.getState();
      if (freshState.activeBot) {
        // Sync with backend data if available
        syncWithBackendState();
      }
    }, 100);
  }
  
  // Subscribe to manager state changes
  let activeBotStateUnsubscribe: (() => void) | null = null;
  let backendStateUnsubscribe: (() => void) | null = null;
  
  // Update bot tabs based on manager state (avoid cyclical dependency)
  function updateBotTabs() {
    selectedStrategyType = managerState.selectedStrategy;
    activeBotInstance = managerState.activeBot;
    
    // Get bots for current strategy
    const managerBots = managerState.strategies[selectedStrategyType]?.bots || [];
    botTabs = managerBots.map((bot: any) => {
      // Check backend state for this bot
      const backendBotState = tradingBackendService.getBotState(bot.id);
      let status: 'idle' | 'running' | 'paused' = 'idle';
      
      if (backendBotState) {
        // Use backend status if available
        status = backendBotState.status;
      } else if (bot.id === activeBotInstance?.id) {
        // Fall back to frontend state
        status = isRunning ? (isPaused ? 'paused' : 'running') : 'idle';
      }
      
      return {
        id: bot.id,
        label: bot.name,
        balance: bot.balance || 10000,
        status
      };
    });
  }
  
  // Subscribe to active bot state changes
  function subscribeToActiveBot(bot: any) {
    if (activeBotStateUnsubscribe) {
      activeBotStateUnsubscribe();
      activeBotStateUnsubscribe = null;
    }
    
    if (bot) {
      activeBotStateUnsubscribe = bot.subscribe((state: any) => {
        if (state) {
          balance = state.balance || balance;
          btcBalance = state.btcBalance || btcBalance;
          vaultBalance = state.vaultBalance || vaultBalance;
          btcVaultBalance = state.btcVaultBalance || btcVaultBalance;
          positions = state.positions || positions;
          trades = state.trades || trades;
          isRunning = state.isRunning || false;
          isPaused = state.isPaused || false;
          currentStrategy = state.strategy || null;
          strategyParameters = state.parameters || {};
        }
      });
    }
  }
  
  // React to manager state changes
  $: updateBotTabs();
  
  // React to active bot changes
  $: subscribeToActiveBot(activeBotInstance);
  
  function syncWithBackendState() {
    if (!activeBotInstance) return;
    
    const backendBotState = tradingBackendService.getBotState(activeBotInstance.id);
    if (backendBotState) {
      // Update local state with backend data
      balance = backendBotState.balance || balance;
      btcBalance = backendBotState.btcBalance || btcBalance;
      vaultBalance = backendBotState.vaultBalance || vaultBalance;
      btcVaultBalance = backendBotState.btcVaultBalance || btcVaultBalance;
      positions = backendBotState.positions || positions;
      trades = backendBotState.trades || trades;
      isRunning = backendBotState.status === 'running';
      isPaused = backendBotState.status === 'paused';
      
      // Update bot instance with backend state
      if (activeBotInstance) {
        activeBotInstance.update((state: any) => ({
          ...state,
          ...backendBotState,
          isRunning: backendBotState.status === 'running',
          isPaused: backendBotState.status === 'paused'
        }));
      }
    }
  }
  
  // Periodically sync with backend
  let backendSyncInterval: NodeJS.Timer | null = null;
  
  onMount(() => {
    // Initial sync
    syncWithBackendState();
    
    // Set up periodic sync
    backendSyncInterval = setInterval(() => {
      syncWithBackendState();
    }, 2000); // Sync every 2 seconds
    
    // Subscribe to backend state changes
    backendStateUnsubscribe = tradingBackendService.subscribe(() => {
      syncWithBackendState();
    });
  });
  
  onDestroy(() => {
    if (activeBotStateUnsubscribe) {
      activeBotStateUnsubscribe();
    }
    if (backendStateUnsubscribe) {
      backendStateUnsubscribe();
    }
    if (backendSyncInterval) {
      clearInterval(backendSyncInterval);
    }
    if (dataFeedInterval) {
      clearInterval(dataFeedInterval);
    }
  });
</script>

<div class="dashboard-layout">
  <CollapsibleSidebar 
    {sidebarCollapsed}
    activeSection="paper-trading"
    on:toggle={toggleSidebar}
    on:navigate={handleNavigation}
  />
  
  <main class="dashboard-content" class:expanded={sidebarCollapsed}>
    <div class="header">
      <h1>Paper Trading</h1>
      <div class="header-stats">
        <div class="stat-item">
          <span class="stat-label">BTC Price</span>
          <span class="stat-value price">${currentPrice ? currentPrice.toFixed(2) : '0.00'}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Connection</span>
          <span class="stat-value status" class:connected={connectionStatus === 'connected'} class:disconnected={connectionStatus === 'disconnected'} class:error={connectionStatus === 'error'} class:loading={connectionStatus === 'loading'}>
            {connectionStatus}
          </span>
        </div>
      </div>
    </div>
    
    <div class="content-wrapper">
      <div class="paper-trading-grid">
        <div class="panels-row">
          <!-- Chart Panel -->
          <div class="panel chart-panel">
            <div class="panel-header">
              <h2>BTC/USD Chart</h2>
            </div>
            <div class="panel-content">
              <Chart
                bind:selectedGranularity
                bind:selectedPeriod
                bind:chartInstance
                bind:candleSeriesInstance
                {currentPrice}
                isTradingPage={false}
                isPaperTrading={true}
                showBotTabs={true}
                bind:botTabs
                bind:activeBotId={activeBotInstance}
                on:botTabSelect={handleBotTabSelect}
              />
            </div>
          </div>
          
          <!-- Strategy Controls Panel -->
          <div class="panel strategy-panel">
            <div class="panel-header">
              <h2>Strategy Controls</h2>
              <div class="header-buttons">
                {#if !isRunning}
                  <button class="run-btn" on:click={() => paperTradingManager.startTrading()}>
                    Start Trading
                  </button>
                {:else if isPaused}
                  <button class="run-btn" on:click={() => paperTradingManager.resumeTrading()}>
                    Resume
                  </button>
                  <button class="stop-btn" on:click={() => paperTradingManager.stopTrading()}>
                    Stop
                  </button>
                {:else}
                  <button class="pause-btn" on:click={() => paperTradingManager.pauseTrading()}>
                    Pause
                  </button>
                  <button class="stop-btn" on:click={() => paperTradingManager.stopTrading()}>
                    Stop
                  </button>
                {/if}
              </div>
            </div>
            <div class="panel-content">
              <!-- Strategy selection -->
              <div class="control-group">
                <label for="strategy-select">Strategy</label>
                <select 
                  id="strategy-select"
                  bind:value={selectedStrategyType}
                  on:change={handleStrategyChange}
                  disabled={isRunning}
                >
                  {#each strategies as strategy}
                    <option value={strategy.value}>{strategy.label}</option>
                  {/each}
                </select>
              </div>
              
              <!-- Balance display -->
              <div class="control-group">
                <label>Balance</label>
                <div class="balance-display">
                  ${balance.toFixed(2)}
                </div>
              </div>
              
              <!-- Positions -->
              {#if positions.length > 0}
                <div class="positions-list">
                  <h3>Open Positions ({positions.length})</h3>
                  {#each positions as position}
                    <div class="position-item">
                      <span>{position.size.toFixed(6)} BTC @ ${position.entryPrice.toFixed(2)}</span>
                    </div>
                  {/each}
                </div>
              {/if}
            </div>
          </div>
        </div>
        
        <!-- Results/Metrics Panel -->
        {#if trades.length > 0}
          <div class="panel results-panel">
            <div class="panel-header">
              <h2>Trading Results</h2>
            </div>
            <div class="panel-content">
              <div class="results-grid">
                <div class="result-item">
                  <span class="result-label">Total Trades</span>
                  <span class="result-value">{trades.length}</span>
                </div>
                <div class="result-item">
                  <span class="result-label">Win Rate</span>
                  <span class="result-value">{winRate.toFixed(1)}%</span>
                </div>
                <div class="result-item">
                  <span class="result-label">Total Return</span>
                  <span class="result-value">${totalReturn.toFixed(2)}</span>
                </div>
                <div class="result-item">
                  <span class="result-label">Total Fees</span>
                  <span class="result-value">${totalFees.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        {/if}
      </div>
    </div>
  </main>
</div>

<style>
  :global(.dashboard-layout) {
    display: flex;
    min-height: 100vh;
    background: #0a0a0a;
    color: #d1d4dc;
  }

  :global(.dashboard-content) {
    flex: 1;
    display: flex;
    flex-direction: column;
    margin-left: 250px;
    width: calc(100% - 250px);
    transition: all 0.3s ease;
  }

  :global(.dashboard-content.expanded) {
    margin-left: 80px;
    width: calc(100% - 80px);
  }

  :global(.header) {
    padding: 20px;
    background: #0f0f0f;
    border-bottom: 1px solid rgba(74, 0, 224, 0.3);
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  :global(.header h1) {
    margin: 0;
    font-size: 24px;
    color: #a78bfa;
  }

  :global(.header-stats) {
    display: flex;
    gap: 30px;
  }

  :global(.stat-item) {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  :global(.stat-label) {
    font-size: 12px;
    color: #758696;
    text-transform: uppercase;
  }

  :global(.stat-value) {
    font-size: 18px;
    font-weight: 600;
  }

  :global(.stat-value.price) {
    color: #26a69a;
  }

  :global(.content-wrapper) {
    flex: 1;
    overflow-y: auto;
    padding: 20px;
  }

  :global(.paper-trading-grid) {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  :global(.panels-row) {
    display: grid;
    grid-template-columns: 2fr 1fr;
    gap: 20px;
    height: 600px;
  }

  :global(.panel) {
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(74, 0, 224, 0.3);
    border-radius: 8px;
    display: flex;
    flex-direction: column;
  }

  :global(.panel-header) {
    padding: 15px 20px;
    background: rgba(74, 0, 224, 0.1);
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  :global(.panel-header h2) {
    margin: 0;
    font-size: 16px;
    color: #a78bfa;
  }

  :global(.panel-content) {
    flex: 1;
    padding: 20px;
    overflow-y: auto;
  }

  :global(.chart-panel) {
    height: 100%;
    min-height: 0;
  }

  :global(.chart-panel .panel-content) {
    padding: 0;
  }

  :global(.header-buttons) {
    display: flex;
    gap: 10px;
  }

  :global(.run-btn), :global(.pause-btn), :global(.stop-btn) {
    padding: 8px 16px;
    background: rgba(74, 0, 224, 0.2);
    border: 1px solid rgba(74, 0, 224, 0.4);
    border-radius: 6px;
    color: #a78bfa;
    cursor: pointer;
    font-size: 13px;
    transition: all 0.2s;
  }

  :global(.run-btn:hover), :global(.pause-btn:hover), :global(.stop-btn:hover) {
    background: rgba(74, 0, 224, 0.3);
    border-color: rgba(74, 0, 224, 0.6);
  }

  :global(.control-group) {
    margin-bottom: 20px;
  }

  :global(.control-group label) {
    display: block;
    margin-bottom: 8px;
    font-size: 13px;
    color: #758696;
    text-transform: uppercase;
  }

  :global(.control-group select) {
    width: 100%;
    padding: 10px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(74, 0, 224, 0.3);
    border-radius: 6px;
    color: #d1d4dc;
    font-size: 14px;
  }

  :global(.balance-display) {
    font-size: 24px;
    font-weight: 600;
    color: #26a69a;
  }

  :global(.positions-list) {
    margin-top: 20px;
  }

  :global(.positions-list h3) {
    margin: 0 0 10px 0;
    font-size: 14px;
    color: #a78bfa;
  }

  :global(.position-item) {
    padding: 8px;
    margin-bottom: 5px;
    background: rgba(255, 255, 255, 0.03);
    border-radius: 4px;
    font-size: 13px;
  }

  :global(.results-panel) {
    width: 100%;
  }

  :global(.results-grid) {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 20px;
  }

  :global(.result-item) {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  :global(.result-label) {
    font-size: 12px;
    color: #758696;
    text-transform: uppercase;
  }

  :global(.result-value) {
    font-size: 20px;
    font-weight: 600;
    color: #a78bfa;
  }
</style>