<script lang="ts">
  import '../styles/paper-trading.css';
  
  import CollapsibleSidebar from '../components/layout/CollapsibleSidebar.svelte';
  import TradingChart from './PaperTrading/components/TradingChart.svelte';
  import StrategyControls from '../components/papertrading/StrategyControls.svelte';
  import OpenPositions from '../components/papertrading/OpenPositions.svelte';
  import TradingHistory from '../components/papertrading/TradingHistory.svelte';
  import MarketGauge from '../components/trading/MarketGauge.svelte';
  
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import { PaperTradingOrchestrator } from './PaperTrading/services/PaperTradingOrchestrator';
  import { BackendConnector } from './PaperTrading/services/BackendConnector';
  import { paperTradingManager } from '../services/state/paperTradingManager';
  import { strategyStore } from '../stores/strategyStore';
  
  export let sidebarCollapsed = false;
  
  const dispatch = createEventDispatcher();
  
  // Initialize services
  let orchestrator: PaperTradingOrchestrator;
  let backendConnector: BackendConnector;
  
  // State
  let tradingState: any = {};
  let backendState: any = {};
  let managerState: any = {};
  let selectedPair = 'BTC-USD';
  let chartSpeed = '1x';
  let selectedTestDateString = '';
  let chartComponent: any = null;
  
  // Bot manager state
  const managerStateStore = paperTradingManager.getState();
  let activeBotInstance: any = null;
  let botTabs: any[] = [];
  
  // Built-in strategies
  const builtInStrategies = [
    { value: 'reverse-ratio', label: 'Reverse Ratio', description: 'Grid trading with reverse position sizing', isCustom: false },
    { value: 'grid-trading', label: 'Grid Trading', description: 'Classic grid trading strategy', isCustom: false },
    { value: 'rsi-mean-reversion', label: 'RSI Mean Reversion', description: 'Trade RSI oversold/overbought', isCustom: false },
    { value: 'dca', label: 'Dollar Cost Averaging', description: 'Regular periodic purchases', isCustom: false },
    { value: 'vwap-bounce', label: 'VWAP Bounce', description: 'Trade VWAP support/resistance', isCustom: false },
    { value: 'micro-scalping', label: 'Micro Scalping', description: 'High-frequency trading', isCustom: false },
    { value: 'proper-scalping', label: 'Proper Scalping', description: 'Professional scalping', isCustom: false },
    { value: 'ultra-micro-scalping', label: 'Ultra Micro Scalping', description: 'Hyper-aggressive 1-minute scalping', isCustom: false }
  ];
  
  let customStrategies: any[] = [];
  $: strategies = [...builtInStrategies, ...customStrategies];
  
  function toggleSidebar() {
    dispatch('toggle');
  }

  function handleNavigation(event: CustomEvent) {
    dispatch('navigate', event.detail);
  }
  
  // Keep strategy type synced with store
  $: if ($strategyStore.selectedType && $strategyStore.selectedType !== tradingState.selectedStrategyType) {
    if (orchestrator) {
      orchestrator.updateState({ selectedStrategyType: $strategyStore.selectedType });
    }
  }
  
  // Subscribe to manager state
  $: managerState = $managerStateStore;
  
  // Debug logging
  $: if (tradingState) {
    console.log('📊 Current trading state:', {
      isRunning: tradingState.isRunning,
      positions: tradingState.positions,
      trades: tradingState.trades,
      positionsLength: tradingState.positions?.length,
      tradesLength: tradingState.trades?.length
    });
  }
  
  // Update bot tabs based on manager state
  function updateBotTabs() {
    if (!managerState) return;
    
    activeBotInstance = managerState.activeBot;
    
    const strategies = managerState.strategies || {};
    const managerBots = strategies[tradingState.selectedStrategyType]?.bots || [];
    botTabs = managerBots.map((bot: any) => {
      let status: 'idle' | 'running' | 'paused' = 'idle';
      
      if (bot.id === activeBotInstance?.id) {
        status = tradingState.isRunning ? (tradingState.isPaused ? 'paused' : 'running') : 'idle';
      }
      
      return {
        id: bot.id,
        label: bot.name,
        balance: bot.balance || 10000,
        status
      };
    });
  }
  
  $: if (managerState && tradingState.selectedStrategyType) updateBotTabs();
  
  // Event handlers
  function handleStrategyChange(event: CustomEvent) {
    const { value } = event.detail;
    orchestrator.updateState({ selectedStrategyType: value });
    strategyStore.setStrategy(value, {});
    paperTradingManager.selectStrategy(value);
  }

  function handleBalanceChange(event: CustomEvent) {
    const { balance } = event.detail;
    orchestrator.updateState({ balance });
    const activeBot = paperTradingManager.getActiveBot();
    if (activeBot) {
      activeBot.setBalance(balance);
    }
  }
  
  function handleStartTrading() {
    console.log('🎯 Container handleStartTrading called', {
      selectedStrategyType: tradingState.selectedStrategyType,
      currentPrice: backendState.currentPrice,
      tradingState,
      backendState
    });
    
    if (!tradingState.selectedStrategyType) {
      console.error('No strategy type selected!');
      return;
    }
    
    if (!backendState.currentPrice || backendState.currentPrice <= 0) {
      console.error('No current price available!');
      return;
    }
    
    orchestrator.startTrading(tradingState.selectedStrategyType, backendState.currentPrice);
  }
  
  function handlePauseTrading() {
    orchestrator.pauseTrading();
  }
  
  function handleResumeTrading() {
    orchestrator.resumeTrading();
  }
  
  function handleReset() {
    orchestrator.resetState();
    
    // Clear chart markers
    if (chartComponent && typeof chartComponent.clearMarkers === 'function') {
      chartComponent.clearMarkers();
    } else if (chartComponent && typeof chartComponent.addMarkers === 'function') {
      chartComponent.addMarkers([]);
    }
  }
  
  function handleBotTabSelect(event: CustomEvent) {
    const { botId } = event.detail;
    
    // Select new bot without resetting (to preserve existing data)
    paperTradingManager.selectBot(botId);
    
    // Tell orchestrator to switch to this bot without resetting
    if (orchestrator.webSocket && orchestrator.isConnected) {
      orchestrator.webSocket.send(JSON.stringify({ type: 'selectBot', botId }));
      orchestrator.webSocket.send(JSON.stringify({ type: 'getStatus' }));
    }
    
    // Force immediate sync
    setTimeout(() => {
      const freshState = paperTradingManager.getState();
      if (freshState.activeBot) {
        // Sync with backend if available
      }
    }, 100);
  }
  
  function handleChartEvents(event: CustomEvent) {
    // Handle various chart events (granularity, period changes, etc.)
    console.log('Chart event:', event.type, event.detail);
  }
  
  onMount(() => {
    // Initialize services
    orchestrator = new PaperTradingOrchestrator();
    backendConnector = new BackendConnector();
    
    // Subscribe to state changes
    const unsubscribeTrading = orchestrator.getState().subscribe(state => {
      console.log('🔄 Trading state updated:', state);
      tradingState = state;
    });
    
    const unsubscribeBackend = backendConnector.getState().subscribe(state => {
      backendState = state;
    });
    
    // Setup price feeding to strategy
    backendConnector.onPriceUpdate((price) => {
      orchestrator.feedPriceToStrategy(price);
    });
    
    return () => {
      unsubscribeTrading();
      unsubscribeBackend();
      orchestrator.destroy();
      backendConnector.destroy();
    };
  });
  
  onDestroy(() => {
    if (orchestrator) orchestrator.destroy();
    if (backendConnector) backendConnector.destroy();
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
    <div class="content-wrapper">
      <div class="paper-trading-grid">
        <div class="panels-row">
          <!-- Chart Panel -->
          <TradingChart
            bind:chartComponent
            {selectedPair}
            {chartSpeed}
            {selectedTestDateString}
            {botTabs}
            {activeBotInstance}
            isRunning={tradingState.isRunning}
            isPaused={tradingState.isPaused}
            trades={tradingState.trades}
            isPaperTestRunning={false}
            on:pairChange={handleChartEvents}
            on:granularityChange={handleChartEvents}
            on:periodChange={handleChartEvents}
            on:speedChange={handleChartEvents}
            on:dateChange={handleChartEvents}
            on:botTabSelect={handleBotTabSelect}
          />
          
          <!-- Strategy Controls Panel -->
          <StrategyControls
            selectedStrategyType={tradingState.selectedStrategyType}
            {strategies}
            isRunning={tradingState.isRunning}
            isPaused={tradingState.isPaused}
            balance={tradingState.balance}
            btcBalance={tradingState.btcBalance}
            positions={tradingState.positions}
            currentPrice={backendState.currentPrice}
            {botTabs}
            {activeBotInstance}
            totalTrades={tradingState.trades?.length || 0}
            totalReturn={tradingState.totalReturn}
            startingBalance={10000}
            totalFees={tradingState.totalFees}
            totalRebates={tradingState.totalRebates}
            on:strategyChange={handleStrategyChange}
            on:balanceChange={handleBalanceChange}
            on:start={handleStartTrading}
            on:pause={handlePauseTrading}
            on:resume={handleResumeTrading}
            on:selectBot={handleBotTabSelect}
            on:reset={handleReset}
          />
        </div>
        
        <!-- Three-panel row: Positions, History, Gauge -->
        <div class="panels-row-three">
          <!-- Open Positions Panel -->
          <OpenPositions
            positions={tradingState.positions || []}
            currentPrice={backendState.currentPrice || 0}
            isRunning={tradingState.isRunning || false}
          />
          
          <!-- Trading History Panel -->
          <TradingHistory trades={tradingState.trades || []} />
          
          <!-- Market Gauge Panel -->
          <div class="panel gauge-panel">
            <MarketGauge 
              currentPrice={backendState.currentPrice}
              positions={tradingState.positions}
              recentHigh={tradingState.recentHigh}
              recentLow={tradingState.recentLow}
              isRunning={tradingState.isRunning}
            />
          </div>
        </div>
      </div>
    </div>
  </main>
</div>

<style>
  /* Import all existing styles from PaperTrading.svelte */
  @import '../styles/paper-trading.css';
  
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

  :global(.content-wrapper) {
    flex: 1;
    overflow-y: auto;
    padding: 20px;
  }

  :global(.paper-trading-grid) {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  :global(.panels-row) {
    display: grid;
    grid-template-columns: 2fr 1fr;
    gap: 20px;
    height: auto;
  }
  
  :global(.chart-panel) {
    height: auto;
  }
  
  :global(.strategy-panel) {
    height: 100%;
    display: flex;
    flex-direction: column;
  }
  
  :global(.panels-row-three) {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 20px;
    margin-top: 8px;
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
</style>