<script lang="ts">
  // Import CSS
  import '../styles/paper-trading.css';
  
  // Layout Components
  import CollapsibleSidebar from '../components/layout/CollapsibleSidebar.svelte';
  
  // Trading Components
  import Chart from './trading/chart/Chart.svelte';
  import BotTabs from './PaperTrading/BotTabs.svelte';
  import MarketGauge from '../components/trading/MarketGauge.svelte';
  import StrategyControls from '../components/papertrading/StrategyControls.svelte';
  import OpenPositions from '../components/papertrading/OpenPositions.svelte';
  import TradingHistory from '../components/papertrading/TradingHistory.svelte';
  import PerformanceMetrics from '../components/papertrading/PerformanceMetrics.svelte';
  
  // Services & Stores
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import { get } from 'svelte/store';
  import { tradingBackendService } from '../services/state/tradingBackendService';
  import { paperTestService } from '../services/state/paperTestService';
  import { paperTradingManager } from '../services/state/paperTradingManager';
  import { ChartDataFeed } from '../services/chart/dataFeed';
  import { coinbaseWebSocket } from '../services/api/coinbaseWebSocket';
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
  
  // Chart data feed instance
  let chartDataFeedInstance: ChartDataFeed | null = null;
  
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
  const managerStateStore = paperTradingManager.getState();
  let managerState: any = {};
  let activeBotInstance: any = null;
  let botTabs: any[] = [];
  
  // Subscribe to manager state
  $: managerState = $managerStateStore;
  
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
  let recentHigh = 0;
  let recentLow = 0;
  
  // Chart data feed for strategy
  let chartDataFeed: ChartDataFeed | null = null;
  let dataFeedInterval: NodeJS.Timer | null = null;
  
  // Paper test state variables (moved to consolidated section below)
  
  // UI state
  let isEditingBalance = false;
  let editingBalance = '10000';
  
  // Paper Test state (consolidated)
  let selectedTestDate: Date | null = null;
  let selectedTestDateString: string = '';
  let isPaperTestRunning = false;
  let paperTestProgress = 0;
  let paperTestSimTime: Date | null = null;
  let paperTestResults: any = null;
  let paperTestTrades: any[] = [];
  let paperTestInterval: NodeJS.Timer | null = null;
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

  function handleBalanceChange(event: CustomEvent) {
    const { balance: newBalance } = event.detail;
    balance = newBalance;
    // Update the balance for the active bot if needed
    const activeBot = paperTradingManager.getActiveBot();
    if (activeBot) {
      // Update bot's initial balance
      activeBot.setBalance(newBalance);
    }
  }

  function selectGranularity(granularity: string) {
    selectedGranularity = granularity;
    chartPreferencesStore.setPreferences('paper-trading', granularity, selectedPeriod);
  }

  function selectPeriod(period: string) {
    selectedPeriod = period;
    chartPreferencesStore.setPreferences('paper-trading', selectedGranularity, period);
  }

  function handleDateSelection(event: Event) {
    const input = event.target as HTMLInputElement;
    selectedTestDateString = input.value;
    if (selectedTestDateString) {
      selectedTestDate = new Date(selectedTestDateString);
    } else {
      selectedTestDate = null;
    }
  }
  
  // Trading control functions
  function startTrading() {
    const activeBot = paperTradingManager.getActiveBot();
    if (activeBot && !isRunning) {
      // Reset recent high/low when starting
      recentHigh = currentPrice;
      recentLow = currentPrice;
      
      // Create strategy instance based on selected type
      let strategy: Strategy | null = null;
      
      switch (selectedStrategyType) {
        case 'reverse-ratio':
          strategy = new ReverseRatioStrategy();
          break;
        case 'grid-trading':
          strategy = new GridTradingStrategy();
          break;
        case 'rsi-mean-reversion':
          strategy = new RSIMeanReversionStrategy();
          break;
        case 'dca':
          strategy = new DCAStrategy();
          break;
        case 'vwap-bounce':
          strategy = new VWAPBounceStrategy();
          break;
        case 'micro-scalping':
          strategy = new MicroScalpingStrategy();
          break;
        case 'proper-scalping':
          strategy = new ProperScalpingStrategy();
          break;
      }
      
      if (strategy) {
        activeBot.service.start(strategy, 'BTC-USD', balance);
        isRunning = true;
        isPaused = false;
      }
    }
  }
  
  function stopTrading() {
    const activeBot = paperTradingManager.getActiveBot();
    if (activeBot) {
      activeBot.service.stop();
      isRunning = false;
      isPaused = false;
    }
  }
  
  function pauseTrading() {
    const activeBot = paperTradingManager.getActiveBot();
    if (activeBot) {
      activeBot.service.setPaused(true);
      isPaused = true;
    }
  }
  
  function resumeTrading() {
    const activeBot = paperTradingManager.getActiveBot();
    if (activeBot) {
      activeBot.service.setPaused(false);
      isPaused = false;
    }
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
    if (!managerState) return;
    
    selectedStrategyType = managerState.selectedStrategy || 'reverse-ratio';
    activeBotInstance = managerState.activeBot;
    
    // Get bots for current strategy
    const strategies = managerState.strategies || {};
    const managerBots = strategies[selectedStrategyType]?.bots || [];
    botTabs = managerBots.map((bot: any) => {
      // Check if this is the active bot
      let status: 'idle' | 'running' | 'paused' = 'idle';
      
      if (bot.id === activeBotInstance?.id) {
        // Use frontend state for active bot
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
  $: if (managerState) updateBotTabs();
  
  // React to active bot changes
  $: subscribeToActiveBot(activeBotInstance);
  
  function syncWithBackendState() {
    if (!activeBotInstance) return;
    
    // TODO: Sync with backend state once getBotState is implemented
    // For now, rely on the frontend state management
  }
  
  // Paper test functions
  function runPaperTest() {
    if (!selectedTestDateString) return;
    
    isPaperTestRunning = true;
    paperTestProgress = 0;
    paperTestTrades = [];
    
    // Simulate paper trading over time
    paperTestInterval = setInterval(() => {
      paperTestProgress = Math.min(paperTestProgress + 1, 100);
      
      // Simulate trades
      if (Math.random() > 0.7) {
        const mockTrade = {
          timestamp: Date.now(),
          type: Math.random() > 0.5 ? 'buy' : 'sell',
          price: currentPrice + (Math.random() - 0.5) * 10,
          size: Math.random() * 0.1
        };
        paperTestTrades = [...paperTestTrades, mockTrade];
      }
      
      if (paperTestProgress >= 100) {
        stopPaperTest();
      }
    }, 100);
  }
  
  function stopPaperTest() {
    if (paperTestInterval) {
      clearInterval(paperTestInterval);
      paperTestInterval = null;
    }
    isPaperTestRunning = false;
  }
  
  function clearPaperTestTrades() {
    paperTestTrades = [];
    paperTestProgress = 0;
  }

  // Periodically sync with backend
  let backendSyncInterval: NodeJS.Timer | null = null;
  
  onMount(async () => {
    // Initialize chart data feed
    try {
      chartDataFeedInstance = ChartDataFeed.getInstance();
      // ChartDataFeed initializes in constructor, no need to call initialize()
      
      // Connect to WebSocket first
      coinbaseWebSocket.connect();
      
      // Subscribe to BTC-USD ticker
      coinbaseWebSocket.subscribeTicker('BTC-USD');
      
      // Subscribe to price updates
      coinbaseWebSocket.onPrice((price: number) => {
        currentPrice = price;
        
        // Track recent high and low when trading is running
        if (isRunning) {
          if (recentHigh === 0 || price > recentHigh) {
            recentHigh = price;
          }
          if (recentLow === 0 || price < recentLow) {
            recentLow = price;
          }
        }
      });
      
      // Subscribe to status updates
      coinbaseWebSocket.onStatus((status: 'connected' | 'disconnected' | 'error' | 'loading') => {
        connectionStatus = status;
      });
      
      // Initial connection status
      connectionStatus = coinbaseWebSocket.isConnected() ? 'connected' : 'loading';
      
      // Initial sync
      syncWithBackendState();
      
      // Set up periodic sync
      backendSyncInterval = setInterval(() => {
        syncWithBackendState();
      }, 2000); // Sync every 2 seconds
      
      // Subscribe to backend state changes
      const backendStore = tradingBackendService.getState();
      backendStateUnsubscribe = backendStore.subscribe(() => {
        syncWithBackendState();
      });
    } catch (error) {
      console.error('Failed to setup components:', error);
      connectionStatus = 'error';
    }
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
    if (paperTestInterval) {
      clearInterval(paperTestInterval);
    }
    // Don't cleanup singleton instances
    // coinbaseWebSocket.disconnect();
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
              <h2>BTC/USD Chart
                {#if isPaperTestRunning}
                  <span class="paper-test-indicator">📄 Paper Test Mode</span>
                {/if}
              </h2>
              <div class="header-controls">
                <div class="granularity-buttons">
                  <button class="granularity-btn" class:active={selectedGranularity === '1m'} on:click={() => selectGranularity('1m')}>1m</button>
                  <button class="granularity-btn" class:active={selectedGranularity === '5m'} on:click={() => selectGranularity('5m')}>5m</button>
                  <button class="granularity-btn" class:active={selectedGranularity === '15m'} on:click={() => selectGranularity('15m')}>15m</button>
                  <button class="granularity-btn" class:active={selectedGranularity === '1h'} on:click={() => selectGranularity('1h')}>1h</button>
                  <button class="granularity-btn" class:active={selectedGranularity === '6h'} on:click={() => selectGranularity('6h')}>6h</button>
                  <button class="granularity-btn" class:active={selectedGranularity === '1D'} on:click={() => selectGranularity('1D')}>1D</button>
                </div>
              </div>
            </div>
            <!-- Bot Tabs -->
            {#if botTabs.length > 0}
              <BotTabs
                bots={botTabs}
                activeTabId={activeBotInstance?.id}
                on:selectTab={handleBotTabSelect}
              />
            {/if}
            <div class="panel-content">
              <Chart
                pair="BTC-USD"
                granularity={selectedGranularity}
                period={selectedPeriod}
                showControls={false}
                showStatus={true}
                showInfo={false}
                showDebug={false}
                enablePlugins={true}
                defaultPlugins={['volume']}
              />
              <div class="period-buttons">
                <button class="period-btn" class:active={selectedPeriod === '1H'} on:click={() => selectPeriod('1H')}>1H</button>
                <button class="period-btn" class:active={selectedPeriod === '4H'} on:click={() => selectPeriod('4H')}>4H</button>
                <button class="period-btn" class:active={selectedPeriod === '5D'} on:click={() => selectPeriod('5D')}>5D</button>
                <button class="period-btn" class:active={selectedPeriod === '1M'} on:click={() => selectPeriod('1M')}>1M</button>
                <button class="period-btn" class:active={selectedPeriod === '3M'} on:click={() => selectPeriod('3M')}>3M</button>
                <button class="period-btn" class:active={selectedPeriod === '6M'} on:click={() => selectPeriod('6M')}>6M</button>
                <button class="period-btn" class:active={selectedPeriod === '1Y'} on:click={() => selectPeriod('1Y')}>1Y</button>
                <button class="period-btn" class:active={selectedPeriod === '5Y'} on:click={() => selectPeriod('5Y')}>5Y</button>

                <div class="button-separator"></div>

                <!-- Paper Test integrated controls -->
                <div class="date-speed-container">
                  <input 
                    type="date" 
                    id="paper-test-date-input"
                    class="period-btn date-picker-btn compact"
                    max={(() => {
                      const yesterday = new Date();
                      yesterday.setDate(yesterday.getDate() - 1);
                      return yesterday.toISOString().split('T')[0];
                    })()}
                    min="2024-01-01"
                    value={selectedTestDateString}
                    on:change={handleDateSelection}
                  />

                  {#if selectedTestDateString}
                    <!-- Play/Stop Button -->
                    {#if !isPaperTestRunning}
                      <button 
                        class="paper-test-btn play" 
                        on:click={runPaperTest}
                        title="Start Paper Test"
                      >
                        ▶
                      </button>
                    {:else}
                      <button 
                        class="paper-test-btn stop" 
                        on:click={stopPaperTest}
                        title="Stop Paper Test"
                      >
                        ⏹
                      </button>
                    {/if}

                    <!-- Clear Button -->
                    <button 
                      class="paper-test-btn clear"
                      on:click={clearPaperTestTrades}
                      title="Clear All Trades"
                    >
                      🗑️
                    </button>
                  {/if}
                </div>

                <!-- Inline progress -->
                {#if isPaperTestRunning && paperTestProgress > 1}
                  <div class="paper-progress">
                    <div class="paper-progress-bar" style="width: {paperTestProgress}%"></div>
                  </div>
                  <span class="paper-progress-text">
                    {#if paperTestSimTime}
                      {paperTestSimTime.toLocaleTimeString()}
                    {/if}
                    {Math.round(paperTestProgress)}%
                  </span>
                {/if}
              </div>
            </div>
          </div>
          
          <!-- Strategy Controls Panel -->
          <StrategyControls
            bind:selectedStrategyType
            {strategies}
            {isRunning}
            {isPaused}
            {balance}
            {btcBalance}
            {positions}
            {currentPrice}
            {botTabs}
            {activeBotInstance}
            on:strategyChange={(e) => handleStrategyChange({ target: { value: e.detail.value } })}
            on:balanceChange={handleBalanceChange}
            on:start={startTrading}
            on:stop={stopTrading}
            on:pause={pauseTrading}
            on:resume={resumeTrading}
            on:selectBot={handleBotTabSelect}
            on:reset={clearBotData}
          />
        </div>
        
        <!-- Three-panel row: Positions, History, Gauge -->
        <div class="panels-row-three">
          <!-- Open Positions Panel -->
          <OpenPositions
            {positions}
            {currentPrice}
            {isRunning}
          />
          
          <!-- Trading History Panel -->
          <TradingHistory {trades} />
          
          <!-- Market Gauge Panel -->
          <div class="panel gauge-panel">
            <MarketGauge 
              {currentPrice}
              {positions}
              {recentHigh}
              {recentLow}
              {isRunning}
            />
          </div>
        </div>
        
        <!-- Results/Metrics Panel -->
        <PerformanceMetrics 
          {trades}
          {balance}
          {winRate}
          {totalReturn}
          {totalFees}
        />
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
  
  :global(.panels-row-three) {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 20px;
    margin-top: 20px;
  }
  
  :global(.gauge-panel) {
    width: 100%;
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

  :global(.chart-controls) {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  
  :global(.granularity-buttons) {
    display: flex;
    gap: 5px;
  }

  :global(.header-controls) {
    display: flex;
    gap: 15px;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
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
    font-weight: 500;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  :global(.run-btn) {
    background: rgba(34, 197, 94, 0.2);
    border-color: rgba(34, 197, 94, 0.4);
    color: #22c55e;
  }

  :global(.pause-btn) {
    background: rgba(245, 158, 11, 0.2);
    border-color: rgba(245, 158, 11, 0.4);
    color: #f59e0b;
  }

  :global(.stop-btn) {
    background: rgba(239, 68, 68, 0.2);
    border-color: rgba(239, 68, 68, 0.4);
    color: #ef4444;
  }

  :global(.run-btn:hover) {
    background: rgba(34, 197, 94, 0.3);
    border-color: rgba(34, 197, 94, 0.6);
  }

  :global(.pause-btn:hover) {
    background: rgba(245, 158, 11, 0.3);
    border-color: rgba(245, 158, 11, 0.6);
  }

  :global(.stop-btn:hover) {
    background: rgba(239, 68, 68, 0.3);
    border-color: rgba(239, 68, 68, 0.6);
  }
  
  :global(.granularity-btn) {
    padding: 3px 6px;
    background: rgba(74, 0, 224, 0.2);
    border: 1px solid rgba(74, 0, 224, 0.3);
    color: #9ca3af;
    border-radius: 4px;
    font-size: 10px;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  :global(.granularity-btn:hover:not(:disabled)) {
    background: rgba(74, 0, 224, 0.3);
    color: #d1d4dc;
  }
  
  :global(.granularity-btn.active) {
    background: rgba(74, 0, 224, 0.4);
    color: #a78bfa;
    border-color: #a78bfa;
  }

  :global(.period-buttons) {
    display: flex;
    justify-content: center;
    gap: 5px;
    padding: 10px;
    background: rgba(0, 0, 0, 0.2);
    border-top: 1px solid rgba(74, 0, 224, 0.3);
  }

  :global(.period-btn) {
    padding: 4px 8px;
    background: rgba(74, 0, 224, 0.1);
    border: 1px solid rgba(74, 0, 224, 0.3);
    color: #9ca3af;
    border-radius: 4px;
    font-size: 11px;
    cursor: pointer;
    transition: all 0.2s;
  }

  :global(.period-btn:hover:not(:disabled)) {
    background: rgba(74, 0, 224, 0.2);
    color: #d1d4dc;
  }

  :global(.period-btn.active) {
    background: rgba(74, 0, 224, 0.3);
    color: #a78bfa;
    border-color: #a78bfa;
  }

  :global(.panel-content) {
    flex: 1;
    padding: 20px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
  }

  :global(.chart-panel) {
    height: 100%;
    min-height: 0;
  }

  :global(.chart-panel .panel-content) {
    padding: 0;
    overflow: hidden;
    display: block;
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

  /* New styles for enhanced strategy controls */
  :global(.status-indicator) {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    color: #758696;
  }

  :global(.status-dot) {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #758696;
  }

  :global(.status-dot.idle) {
    background: #758696;
  }

  :global(.status-dot.running) {
    background: #26a69a;
    animation: pulse 2s infinite;
  }

  :global(.status-dot.paused) {
    background: #ffa726;
  }

  @keyframes pulse {
    0% { opacity: 1; }
    50% { opacity: 0.5; }
    100% { opacity: 1; }
  }

  :global(.btc-balance) {
    font-size: 18px;
    font-weight: 600;
    color: #ffa726;
  }

  :global(.strategy-info) {
    padding: 10px;
    background: rgba(255, 255, 255, 0.03);
    border-radius: 4px;
  }

  :global(.strategy-description) {
    font-size: 13px;
    color: #758696;
    line-height: 1.5;
  }

  :global(.position-item) {
    padding: 10px;
    margin-bottom: 8px;
    background: rgba(255, 255, 255, 0.03);
    border-radius: 6px;
    border: 1px solid rgba(74, 0, 224, 0.2);
  }

  :global(.position-header) {
    display: flex;
    justify-content: space-between;
    margin-bottom: 5px;
  }

  :global(.position-size) {
    font-weight: 600;
    color: #a78bfa;
  }

  :global(.position-price) {
    color: #758696;
  }

  :global(.position-pnl) {
    font-size: 12px;
    font-weight: 600;
  }

  :global(.position-pnl.profit) {
    color: #26a69a;
  }

  :global(.position-pnl.loss) {
    color: #ef5350;
  }

  /* Trading History styles */
  :global(.history-panel) {
    width: 100%;
  }

  :global(.trade-count) {
    font-size: 12px;
    color: #758696;
    background: rgba(255, 255, 255, 0.05);
    padding: 4px 8px;
    border-radius: 4px;
  }

  :global(.trades-list) {
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-height: 400px;
    overflow-y: auto;
  }

  :global(.trade-item) {
    display: flex;
    justify-content: space-between;
    padding: 10px;
    background: rgba(255, 255, 255, 0.03);
    border-radius: 6px;
    border-left: 3px solid transparent;
  }

  :global(.trade-item.buy) {
    border-left-color: #26a69a;
  }

  :global(.trade-item.sell) {
    border-left-color: #ef5350;
  }

  :global(.trade-type) {
    font-weight: 600;
    font-size: 12px;
    text-transform: uppercase;
  }

  :global(.trade-item.buy .trade-type) {
    color: #26a69a;
  }

  :global(.trade-item.sell .trade-type) {
    color: #ef5350;
  }

  :global(.trade-details) {
    display: flex;
    gap: 15px;
    align-items: center;
  }

  :global(.trade-price) {
    font-weight: 600;
    color: #d1d4dc;
  }

  :global(.trade-time) {
    font-size: 12px;
    color: #758696;
  }

  :global(.no-trades) {
    text-align: center;
    color: #758696;
    padding: 40px;
    font-size: 14px;
  }

  /* Performance metrics enhancements */
  :global(.result-value.positive) {
    color: #26a69a;
  }

  :global(.result-value.negative) {
    color: #ef5350;
  }

  /* Trading Controls styles */
  :global(.trading-controls) {
    display: flex;
    gap: 10px;
    margin-top: auto;
    padding-top: 20px;
    border-top: 1px solid rgba(74, 0, 224, 0.2);
  }

  :global(.control-btn) {
    flex: 1;
    padding: 12px 20px;
    background: rgba(74, 0, 224, 0.1);
    border: 1px solid rgba(74, 0, 224, 0.3);
    border-radius: 8px;
    color: #d1d4dc;
    cursor: pointer;
    font-size: 14px;
    font-weight: 600;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }

  :global(.control-btn:hover) {
    background: rgba(74, 0, 224, 0.2);
    border-color: rgba(74, 0, 224, 0.5);
    transform: translateY(-1px);
  }

  :global(.control-btn:active) {
    transform: translateY(0);
  }

  :global(.btn-icon) {
    font-size: 16px;
  }

  :global(.start-btn), :global(.resume-btn) {
    background: rgba(38, 166, 154, 0.1);
    border-color: rgba(38, 166, 154, 0.3);
    color: #26a69a;
  }

  :global(.start-btn:hover), :global(.resume-btn:hover) {
    background: rgba(38, 166, 154, 0.2);
    border-color: rgba(38, 166, 154, 0.5);
  }

  :global(.pause-btn) {
    background: rgba(255, 167, 38, 0.1);
    border-color: rgba(255, 167, 38, 0.3);
    color: #ffa726;
  }

  :global(.pause-btn:hover) {
    background: rgba(255, 167, 38, 0.2);
    border-color: rgba(255, 167, 38, 0.5);
  }

  :global(.stop-btn) {
    background: rgba(239, 83, 80, 0.1);
    border-color: rgba(239, 83, 80, 0.3);
    color: #ef5350;
  }

  :global(.stop-btn:hover) {
    background: rgba(239, 83, 80, 0.2);
    border-color: rgba(239, 83, 80, 0.5);
  }

  :global(.control-btn:disabled) {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Open Positions Panel styles */
  :global(.positions-panel) {
    width: 100%;
  }
  
  :global(.position-count) {
    font-size: 12px;
    color: #758696;
    background: rgba(255, 255, 255, 0.05);
    padding: 4px 8px;
    border-radius: 4px;
  }
  
  :global(.positions-grid) {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-bottom: 15px;
    max-height: 300px;
    overflow-y: auto;
  }
  
  :global(.position-card) {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(74, 0, 224, 0.3);
    border-radius: 8px;
    padding: 15px;
    position: relative;
  }
  
  :global(.position-index) {
    position: absolute;
    top: 10px;
    right: 10px;
    font-size: 11px;
    color: #758696;
    background: rgba(74, 0, 224, 0.2);
    padding: 2px 6px;
    border-radius: 4px;
  }
  
  :global(.position-details) {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  
  :global(.position-info) {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }
  
  :global(.position-size) {
    font-size: 16px;
    font-weight: 600;
    color: #a78bfa;
  }
  
  :global(.position-entry) {
    font-size: 12px;
    color: #758696;
  }
  
  :global(.position-metrics) {
    display: flex;
    gap: 10px;
    align-items: center;
  }
  
  :global(.pnl-amount) {
    font-size: 18px;
    font-weight: 600;
  }
  
  :global(.pnl-amount.profit) {
    color: #26a69a;
  }
  
  :global(.pnl-amount.loss) {
    color: #ef5350;
  }
  
  :global(.pnl-percent) {
    font-size: 14px;
    font-weight: 500;
    padding: 2px 6px;
    border-radius: 4px;
  }
  
  :global(.pnl-percent.profit) {
    color: #26a69a;
    background: rgba(38, 166, 154, 0.1);
  }
  
  :global(.pnl-percent.loss) {
    color: #ef5350;
    background: rgba(239, 83, 80, 0.1);
  }
  
  :global(.position-current) {
    font-size: 11px;
    color: #758696;
  }
  
  :global(.positions-summary) {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    gap: 15px;
    padding-top: 15px;
    border-top: 1px solid rgba(74, 0, 224, 0.2);
  }
  
  :global(.summary-item) {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }
  
  :global(.summary-label) {
    font-size: 11px;
    color: #758696;
    text-transform: uppercase;
  }
  
  :global(.summary-value) {
    font-size: 16px;
    font-weight: 600;
    color: #d1d4dc;
  }
  
  :global(.summary-value.profit) {
    color: #26a69a;
  }
  
  :global(.summary-value.loss) {
    color: #ef5350;
  }
  
  :global(.no-positions) {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px;
    text-align: center;
  }
  
  :global(.no-positions-icon) {
    font-size: 48px;
    margin-bottom: 15px;
    opacity: 0.5;
  }
  
  :global(.no-positions-text) {
    font-size: 16px;
    color: #758696;
    margin-bottom: 8px;
  }
  
  :global(.no-positions-hint) {
    font-size: 13px;
    color: #4a5568;
    font-style: italic;
  }
  
  /* Quick position summary in strategy controls */
  :global(.positions-summary-quick) {
    display: flex;
    gap: 15px;
    align-items: center;
    font-size: 14px;
  }
  
  :global(.positions-count) {
    color: #a78bfa;
    font-weight: 600;
  }
  
  :global(.positions-pnl) {
    font-weight: 600;
    padding: 4px 8px;
    border-radius: 4px;
  }
  
  :global(.positions-pnl.profit) {
    color: #26a69a;
    background: rgba(38, 166, 154, 0.1);
  }
  
  :global(.positions-pnl.loss) {
    color: #ef5350;
    background: rgba(239, 83, 80, 0.1);
  }
  
  :global(.no-positions-text) {
    color: #758696;
    font-style: italic;
  }

  /* Paper Test Controls styles */
  :global(.paper-test-indicator) {
    font-size: 12px;
    background: rgba(255, 167, 38, 0.2);
    color: #ffa726;
    padding: 2px 8px;
    border-radius: 4px;
    margin-left: 10px;
  }

  :global(.date-speed-container) {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  :global(.date-picker-btn) {
    background: rgba(74, 0, 224, 0.1);
    border: 1px solid rgba(74, 0, 224, 0.3);
    color: #9ca3af;
    border-radius: 4px;
    font-size: 11px;
    cursor: pointer;
    transition: all 0.2s;
  }

  :global(.date-picker-btn.compact) {
    padding: 4px 6px;
    min-width: 90px;
  }

  :global(.date-picker-btn:hover:not(:disabled)) {
    background: rgba(74, 0, 224, 0.2);
    color: #d1d4dc;
  }

  :global(.paper-test-btn) {
    padding: 4px 8px;
    background: rgba(74, 0, 224, 0.1);
    border: 1px solid rgba(74, 0, 224, 0.3);
    color: #9ca3af;
    border-radius: 4px;
    font-size: 11px;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    gap: 4px;
  }

  :global(.paper-test-btn:hover:not(:disabled)) {
    background: rgba(74, 0, 224, 0.2);
    color: #d1d4dc;
  }

  :global(.paper-test-btn:disabled) {
    opacity: 0.5;
    cursor: not-allowed;
  }

  :global(.paper-test-btn.play) {
    background: rgba(38, 166, 154, 0.1);
    border-color: rgba(38, 166, 154, 0.3);
    color: #26a69a;
  }

  :global(.paper-test-btn.play:hover:not(:disabled)) {
    background: rgba(38, 166, 154, 0.2);
    border-color: rgba(38, 166, 154, 0.5);
  }

  :global(.paper-test-btn.stop) {
    background: rgba(239, 83, 80, 0.1);
    border-color: rgba(239, 83, 80, 0.3);
    color: #ef5350;
  }

  :global(.paper-test-btn.stop:hover:not(:disabled)) {
    background: rgba(239, 83, 80, 0.2);
    border-color: rgba(239, 83, 80, 0.5);
  }

  :global(.paper-test-btn.clear) {
    background: rgba(255, 167, 38, 0.1);
    border-color: rgba(255, 167, 38, 0.3);
    color: #ffa726;
  }

  :global(.paper-test-btn.clear:hover:not(:disabled)) {
    background: rgba(255, 167, 38, 0.2);
    border-color: rgba(255, 167, 38, 0.5);
  }

  :global(.paper-progress) {
    flex: 1;
    height: 4px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 2px;
    overflow: hidden;
    margin: 0 8px;
  }

  :global(.paper-progress-bar) {
    height: 100%;
    background: linear-gradient(90deg, #26a69a, #a78bfa);
    border-radius: 2px;
    transition: width 0.3s ease;
  }

  :global(.paper-progress-text) {
    font-size: 10px;
    color: #758696;
    white-space: nowrap;
  }
</style>