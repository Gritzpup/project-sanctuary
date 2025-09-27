<script lang="ts">
  // Import CSS
  import '../styles/paper-trading.css';
  
  // Layout Components
  import CollapsibleSidebar from '../components/layout/CollapsibleSidebar.svelte';
  
  // Trading Components
  import Chart from './trading/chart/Chart.svelte';
  import ChartInfo from './trading/chart/components/overlays/ChartInfo.svelte';
  import BotTabs from './PaperTrading/BotTabs.svelte';
  import MarketGauge from '../components/trading/MarketGauge.svelte';
  import StrategyControls from '../components/papertrading/StrategyControls.svelte';
  import OpenPositions from '../components/papertrading/OpenPositions.svelte';
  import TradingHistory from '../components/papertrading/TradingHistory.svelte';
  
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
  import { UltraMicroScalpingStrategy } from '../strategies/implementations/UltraMicroScalpingStrategy';
  import type { Strategy } from '../strategies/base/Strategy';
  import type { Position } from '../strategies/base/StrategyTypes';
  import { strategyStore } from '../stores/strategyStore';
  import { chartPreferencesStore } from '../stores/chartPreferencesStore';
  
  export let currentPrice: number = 0;
  export let connectionStatus: 'connected' | 'disconnected' | 'error' | 'loading' = 'loading';
  export let sidebarCollapsed = false;
  
  // Chart data feed instance
  let chartDataFeedInstance: ChartDataFeed | null = null;
  
  // Chart component reference for zoom control
  let chartComponent: any;
  
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
  
  // Force fix for 1m granularity to always use 1H period
  if (selectedGranularity === '1m' && selectedPeriod !== '1H') {
    selectedPeriod = '1H';
    chartPreferencesStore.setPreferences('paper-trading', selectedGranularity, '1H');
  }
  
  // Trading pair selection
  let selectedPair = 'BTC-USD';
  
  // Chart speed control
  let chartSpeed = '1x';
  
  // Save preferences when they change
  $: chartPreferencesStore.setPreferences('paper-trading', selectedGranularity, selectedPeriod);
  
  // Paper trading state
  let isRunning = false;
  let isPaused = false;
  let selectedStrategyType = 'reverse-ratio';
  let currentStrategy: Strategy | null = null;
  
  // Backend WebSocket connection
  let backendWs: WebSocket | null = null;
  let backendConnected = false;
  let statusPollingInterval: any = null;
  
  // Connect to backend WebSocket to get real bot data
  function connectToBackend() {
    try {
      backendWs = new WebSocket('ws://localhost:4827');
      
      backendWs.onopen = () => {
        console.log('🟢 Connected to backend WebSocket');
        backendConnected = true;
        // Request bot status immediately
        backendWs?.send(JSON.stringify({ type: 'selectBot', botId: 'reverse-ratio-bot-1' }));
        backendWs?.send(JSON.stringify({ type: 'getStatus' }));
        
        // Poll status every 2 seconds to keep UI updated
        statusPollingInterval = setInterval(() => {
          if (backendWs && backendConnected) {
            backendWs.send(JSON.stringify({ type: 'getStatus' }));
          }
        }, 2000);
      };
      
      backendWs.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'status' && data.data) {
            console.log('📊 Backend status update:', data.data);
            console.log('🔧 Before update - isRunning:', isRunning, 'isPaused:', isPaused);
            // Update frontend with backend data
            isRunning = data.data.isRunning || false;
            isPaused = data.data.isPaused || false;
            console.log('🔧 After update - isRunning:', isRunning, 'isPaused:', isPaused);
            trades = data.data.trades || [];
            positions = data.data.positions || [];
            balance = data.data.balance?.usd || 10000;
            btcBalance = data.data.balance?.btc || 0;
            console.log(`✅ Updated: Running=${isRunning}, Trades=${trades.length}, Positions=${positions.length}`);
          }
          
          // Handle stop response
          if (data.type === 'tradingStopped') {
            console.log('📊 Backend bot stopped');
            isRunning = false;
            isPaused = false;
            console.log('✅ Bot stopped: UI state updated');
          }
          
          // Handle reset response
          if (data.type === 'resetComplete') {
            console.log('📊 Backend reset confirmed');
            isRunning = false;
            isPaused = false;
            trades = [];
            positions = [];
            balance = 10000;
            btcBalance = 0;
            console.log('✅ Reset confirmed: UI state updated');
          }
        } catch (error) {
          console.error('Backend WebSocket message error:', error);
        }
      };
      
      backendWs.onclose = () => {
        console.log('🔴 Backend WebSocket disconnected');
        backendConnected = false;
        
        // Clear status polling
        if (statusPollingInterval) {
          clearInterval(statusPollingInterval);
          statusPollingInterval = null;
        }
        
        // Reconnect after 2 seconds
        setTimeout(connectToBackend, 2000);
      };
      
    } catch (error) {
      console.error('Backend WebSocket connection error:', error);
      setTimeout(connectToBackend, 2000);
    }
  }
  
  // Connect on component mount
  onMount(() => {
    connectToBackend();
    
    return () => {
      backendWs?.close();
    };
  });
  
  // Add trade markers to chart when trades update
  $: if (trades.length > 0 && chartComponent) {
    // Wait a bit for chart to be fully loaded
    setTimeout(() => addTradeMarkersToChart(), 500);
  }
  
  function addTradeMarkersToChart() {
    if (!chartComponent || !trades || trades.length === 0) return;
    
    try {
      console.log(`Attempting to add ${trades.length} trade markers to chart...`);
      
      // Debug: Print actual trade data first
      console.log('🔍 RAW TRADE DATA:', JSON.stringify(trades[0], null, 2));
      
      // Get current time for comparison
      const now = Date.now();
      const nowSeconds = Math.floor(now / 1000);
      console.log('🕐 Current time:', new Date().toISOString());
      console.log('🕐 Current timestamp (ms):', now);
      console.log('🕐 Current timestamp (s):', nowSeconds);
      
      // Convert trades to markers with proper timestamps
      const markers = trades.map((trade, index) => {
        // Convert timestamp to proper format (seconds since epoch)
        let time = trade.timestamp;
        const originalTime = time;
        
        if (time > 10000000000) {
          time = Math.floor(time / 1000); // Convert milliseconds to seconds
        }
        
        // Log timestamp conversion details
        console.log(`📊 Trade ${index + 1} timestamp conversion:`);
        console.log(`  - Original: ${originalTime} (${new Date(originalTime).toISOString()})`);
        console.log(`  - Converted: ${time} (${new Date(time * 1000).toISOString()})`);
        console.log(`  - Time difference from now: ${(nowSeconds - time) / 3600} hours`);
        
        // Use the actual trade timestamp - chart should show this time period
        let markerTime = time;
        
        const marker = {
          time: markerTime,
          position: trade.side === 'buy' ? 'belowBar' : 'aboveBar',
          color: trade.side === 'buy' ? '#26a69a' : '#ef5350', // Match candle colors
          shape: trade.side === 'buy' ? 'arrowUp' : 'arrowDown',
          text: '',
          size: 1
        };
        
        console.log(`  - Final marker:`, marker);
        return marker;
      });
      
      console.log('📊 FINAL MARKERS:', markers);
      console.log('Chart time range - current candles visible from recent data');
      
      // Use the new addMarkers method
      if (chartComponent && typeof chartComponent.addMarkers === 'function') {
        try {
          chartComponent.addMarkers(markers);
          console.log(`✅ Added ${markers.length} trade markers to chart`);
          
          // Auto-scroll disabled to prevent chart zoom instability
          // The chart will maintain its current zoom level and show markers when they fall within the visible range
        } catch (markerError) {
          console.error('Error calling addMarkers:', markerError);
        }
      } else {
        console.error('Chart component does not have addMarkers method or chart not ready');
        console.log('Available methods:', Object.keys(chartComponent || {}));
      }
    } catch (error) {
      console.error('Error adding trade markers:', error);
      console.error('Chart component:', chartComponent);
      console.error('Trades:', trades);
    }
  }
  
  // Keep strategy type synced with store
  $: if ($strategyStore.selectedType && $strategyStore.selectedType !== selectedStrategyType) {
    selectedStrategyType = $strategyStore.selectedType;
    console.log('Paper trading synced strategy from backtesting:', selectedStrategyType);
  }
  
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
    { value: 'proper-scalping', label: 'Proper Scalping', description: 'Professional scalping', isCustom: false },
    { value: 'ultra-micro-scalping', label: 'Ultra Micro Scalping', description: 'Hyper-aggressive 1-minute scalping', isCustom: false }
  ];
  
  let customStrategies: any[] = [];
  let strategyParameters: Record<string, any> = {};
  
  $: strategies = [...builtInStrategies, ...customStrategies];
  
  // Helper functions
  function handleStrategyChange(event: Event) {
    const select = event.target as HTMLSelectElement;
    selectedStrategyType = select.value;
    // Update the store so other pages stay in sync
    strategyStore.setStrategy(select.value, {});
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
  
  function handlePairChange(newPair: string) {
    selectedPair = newPair;
    console.log('📊 Chart pair changed to:', newPair);
    // The chart will automatically reload with the new pair
  }
  
  function handleSpeedChange(event: Event) {
    const select = event.target as HTMLSelectElement;
    chartSpeed = select.value;
    console.log('🚀 Chart speed changed to:', chartSpeed);
  }
  
  function handleZoomCorrection() {
    console.log('🔍 Zoom correction triggered');
    if (chartComponent) {
      chartComponent.fitContent();
      console.log('✅ Chart zoom corrected to fit all data');
    } else {
      console.warn('⚠️ Chart component not available for zoom correction');
    }
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
    console.log('🚀 START TRADING BUTTON CLICKED!');
    
    // Send start command to backend via WebSocket
    if (backendWs && backendConnected) {
      console.log('Sending START command to backend...');
      backendWs.send(JSON.stringify({
        type: 'start',
        config: {
          strategyType: selectedStrategyType,
          strategyConfig: {
            initialDropPercent: 0.1,
            levelDropPercent: 0.1,
            profitTarget: 0.85,
            maxLevels: 12,
            basePositionPercent: 6
          }
        }
      }));
      return;
    }
    
    // Fallback to old local logic if backend not connected
    console.log('Backend not connected, trying local logic...');
    try {
      paperTradingManager.selectStrategy(selectedStrategyType);
      const activeBot = paperTradingManager.getActiveBot();
    
    if (activeBot && !isRunning) {
      // Reset recent high/low when starting
      recentHigh = currentPrice;
      recentLow = currentPrice;
      
      // Create strategy instance based on selected type
      let strategy: Strategy | null = null;
      
      switch (selectedStrategyType) {
        case 'reverse-ratio':
          strategy = new ReverseRatioStrategy({
            initialDropPercent: 0.1,
            levelDropPercent: 0.1,
            profitTarget: 0.85,
            maxLevels: 12,
            basePositionPercent: 6
          });
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
        case 'ultra-micro-scalping':
          strategy = new UltraMicroScalpingStrategy();
          break;
      }
      
      if (strategy) {
        console.log('Starting bot with strategy:', strategy.getName());
        activeBot.service.start(strategy, 'BTC-USD', balance);
        
        // Subscribe to bot state to update UI
        const botState = activeBot.service.getState();
        const currentBotState = get(botState);
        isRunning = currentBotState.isRunning;
        isPaused = currentBotState.isPaused || false;
        
        console.log('Trading started successfully', { isRunning, isPaused });
      } else {
        console.error('Failed to create strategy instance');
      }
    } else {
      console.warn('Cannot start trading:', { activeBot: !!activeBot, isRunning });
    }
    } catch (error) {
      console.error('Error in startTrading:', error);
      alert('Error: ' + error.message);
    }
  }
  
  
  function pauseTrading() {
    console.log('pauseTrading called');
    
    // Send pause command to backend via WebSocket
    if (backendWs && backendConnected) {
      console.log('Sending PAUSE command to backend...');
      backendWs.send(JSON.stringify({ type: 'pause' }));
      return;
    }
    
    // Fallback to local logic
    const activeBot = paperTradingManager.getActiveBot();
    if (activeBot) {
      activeBot.service.setPaused(true);
      const botState = activeBot.service.getState();
      const currentBotState = get(botState);
      isPaused = currentBotState.isPaused || false;
    } else {
      isRunning = false;
      isPaused = false;
    }
  }
  
  function resumeTrading() {
    console.log('resumeTrading called');
    
    // Send resume command to backend via WebSocket
    if (backendWs && backendConnected) {
      console.log('Sending RESUME command to backend...');
      backendWs.send(JSON.stringify({ type: 'resume' }));
      return;
    }
    
    // Fallback to local logic
    const activeBot = paperTradingManager.getActiveBot();
    if (activeBot) {
      activeBot.service.setPaused(false);
      const botState = activeBot.service.getState();
      const currentBotState = get(botState);
      isPaused = currentBotState.isPaused || false;
    }
  }
  
  
  function feedPriceToStrategy(activeBot: any, price: number) {
    try {
      const botState = activeBot.service.getState();
      const currentBotState = get(botState);
      
      if (currentBotState.strategy && currentBotState.isRunning) {
        // Create a candle data object for the strategy
        const candleData = {
          time: Math.floor(Date.now() / 1000),
          open: price,
          high: price,
          low: price,
          close: price,
          volume: 0
        };
        
        // Process the price through the strategy
        const signal = currentBotState.strategy.onCandle(candleData, currentBotState.strategy.getState());
        
        if (signal && (signal.action === 'buy' || signal.action === 'sell')) {
          console.log('Strategy generated signal:', signal);
          
          // Execute the trade through the paper trading service
          executeTradeFromSignal(activeBot, signal, price);
        }
      }
    } catch (error) {
      console.error('Error feeding price to strategy:', error);
    }
  }
  
  function executeTradeFromSignal(activeBot: any, signal: any, price: number) {
    try {
      const botService = activeBot.service;
      const currentState = get(botService.getState());
      
      if (signal.action === 'buy') {
        // Calculate buy amount based on available balance
        const buyAmount = Math.min(signal.amount || 100, currentState.balance.usd);
        if (buyAmount > 0) {
          const btcAmount = buyAmount / price;
          console.log(`Executing BUY: $${buyAmount.toFixed(2)} at $${price.toFixed(2)} = ${btcAmount.toFixed(6)} BTC`);
          
          // Update bot state with trade
          botService.getState().update(state => ({
            ...state,
            balance: {
              ...state.balance,
              usd: state.balance.usd - buyAmount,
              btcPositions: state.balance.btcPositions + btcAmount
            },
            trades: [...state.trades, {
              id: Date.now(),
              timestamp: Date.now(),
              type: 'buy',
              price: price,
              amount: btcAmount,
              value: buyAmount,
              fees: buyAmount * 0.001 // 0.1% fee
            }]
          }));
        }
      } else if (signal.action === 'sell') {
        // Calculate sell amount based on available BTC
        const sellAmount = Math.min(signal.amount || currentState.balance.btcPositions, currentState.balance.btcPositions);
        if (sellAmount > 0) {
          const usdAmount = sellAmount * price;
          console.log(`Executing SELL: ${sellAmount.toFixed(6)} BTC at $${price.toFixed(2)} = $${usdAmount.toFixed(2)}`);
          
          // Update bot state with trade
          botService.getState().update(state => ({
            ...state,
            balance: {
              ...state.balance,
              usd: state.balance.usd + usdAmount,
              btcPositions: state.balance.btcPositions - sellAmount
            },
            trades: [...state.trades, {
              id: Date.now(),
              timestamp: Date.now(),
              type: 'sell',
              price: price,
              amount: sellAmount,
              value: usdAmount,
              fees: usdAmount * 0.001 // 0.1% fee
            }]
          }));
        }
      }
      
      // Update UI with latest bot state
      const updatedState = get(botService.getState());
      balance = updatedState.balance.usd;
      btcBalance = updatedState.balance.btcPositions;
      trades = updatedState.trades;
      
    } catch (error) {
      console.error('Error executing trade from signal:', error);
    }
  }

  function clearBotData() {
    console.log('clearBotData/reset called');
    
    // ALWAYS reset UI state immediately when reset is clicked
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
    console.log('✅ UI state reset to initial values');
    
    // Clear chart markers
    if (chartComponent && typeof chartComponent.clearMarkers === 'function') {
      console.log('🧹 Clearing chart markers...');
      chartComponent.clearMarkers();
      console.log('✅ Chart markers cleared');
    } else if (chartComponent && typeof chartComponent.addMarkers === 'function') {
      console.log('🧹 Clearing chart markers via addMarkers([])...');
      chartComponent.addMarkers([]);
      console.log('✅ Chart markers cleared');
    }
    
    // Send stop and reset commands to backend via WebSocket
    if (backendWs && backendConnected) {
      console.log('Sending STOP command to backend...');
      backendWs.send(JSON.stringify({ 
        type: 'stop', 
        botId: 'reverse-ratio-bot-1' 
      }));
      
      // Then reset the bot state
      setTimeout(() => {
        console.log('Sending RESET command to backend...');
        backendWs.send(JSON.stringify({ 
          type: 'reset', 
          botId: 'reverse-ratio-bot-1' 
        }));
      }, 200);
      return;
    }
    
    // Fallback to local logic
    const activeBot = paperTradingManager.getActiveBot();
    if (activeBot) {
      console.log('Stopping active bot:', activeBot.id);
      activeBot.service.resetStrategy();
    }
    
    console.log('Bot data cleared, UI reset to initial state');
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
          
          // Feed price to active bot strategy
          const activeBot = paperTradingManager.getActiveBot();
          if (activeBot && activeBot.service) {
            feedPriceToStrategy(activeBot, price);
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
    <div class="content-wrapper">
      <div class="paper-trading-grid">
        <div class="panels-row">
          <!-- Chart Panel -->
          <div class="panel chart-panel">
            <div class="panel-header">
              <h2>
                <select class="pair-selector" bind:value={selectedPair} on:change={handlePairChange}>
                  <option value="BTC-USD">BTC/USD Chart</option>
                  <option value="ETH-USD">ETH/USD Chart</option>
                  <option value="PAXG-USD">PAXG/USD Chart</option>
                </select>
                {#if isPaperTestRunning}
                  <span class="paper-test-indicator">📄 Paper Test Mode</span>
                {/if}
              </h2>
              <div class="header-controls">
                <button class="zoom-btn" on:click={handleZoomCorrection} title="Zoom to fit data">
                  🔍
                </button>
                <div class="separator">|</div>
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
                bind:this={chartComponent}
                pair={selectedPair}
                granularity={selectedGranularity}
                period={selectedPeriod}
                showControls={false}
                showStatus={true}
                showInfo={false}
                showDebug={false}
                enablePlugins={true}
                defaultPlugins={['volume']}
                onPairChange={handlePairChange}
              />
              <div class="period-buttons">
                <!-- Left column: timeframe buttons + candle status -->
                <div class="left-column">
                  <div class="timeframe-buttons-group">
                    <button class="period-btn" class:active={selectedPeriod === '1H'} on:click={() => selectPeriod('1H')}>1H</button>
                    <button class="period-btn" class:active={selectedPeriod === '4H'} on:click={() => selectPeriod('4H')}>4H</button>
                    <button class="period-btn" class:active={selectedPeriod === '5D'} on:click={() => selectPeriod('5D')}>5D</button>
                    <button class="period-btn" class:active={selectedPeriod === '1M'} on:click={() => selectPeriod('1M')}>1M</button>
                    <button class="period-btn" class:active={selectedPeriod === '3M'} on:click={() => selectPeriod('3M')}>3M</button>
                    <button class="period-btn" class:active={selectedPeriod === '6M'} on:click={() => selectPeriod('6M')}>6M</button>
                    <button class="period-btn" class:active={selectedPeriod === '1Y'} on:click={() => selectPeriod('1Y')}>1Y</button>
                    <button class="period-btn" class:active={selectedPeriod === '5Y'} on:click={() => selectPeriod('5Y')}>5Y</button>
                  </div>
                  
                  <!-- Candle Info - below timeframe buttons -->
                  <div class="candle-info-inline">
                    <ChartInfo 
                      position="footer"
                      showCandleCount={true}
                      showTimeRange={false}
                      showClock={true}
                      showPerformance={false}
                      showLatestPrice={true}
                      showLatestCandleTime={false}
                      showCandleCountdown={true}
                      tradingStatus={{ isRunning, isPaused }}
                    />
                  </div>
                </div>
                
                <!-- Right column: separator + controls -->
                <div class="right-column">
                  <div class="controls-group">
                    <!-- Calendar and speed controls stacked -->
                    <div class="date-speed-column">
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
                      <select class="period-btn speed-dropdown compact" bind:value={chartSpeed} on:change={handleSpeedChange}>
                        <option value="1x">1x Speed</option>
                        <option value="1.5x">1.5x Speed</option>
                        <option value="2x">2x Speed</option>
                        <option value="3x">3x Speed</option>
                        <option value="10x">10x Speed</option>
                      </select>
                    </div>
                    
                    <!-- Play/pause buttons stacked -->
                    <div class="play-stop-column">
                      <button class="period-btn chart-play-btn compact" title="Start Chart Playback">
                        ▶
                      </button>
                      <button class="period-btn chart-stop-btn compact" title="Stop Chart Playback">
                        ⏹
                      </button>
                    </div>
                  </div>
                </div>
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
            totalTrades={trades.length}
            {totalReturn}
            startingBalance={10000}
            {totalFees}
            {totalRebates}
            on:strategyChange={(e) => handleStrategyChange({ target: { value: e.detail.value } })}
            on:balanceChange={handleBalanceChange}
            on:start={startTrading}
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
    display: flex;
    align-items: center;
    gap: 10px;
  }
  
  :global(.pair-selector) {
    background: linear-gradient(135deg, rgba(167, 139, 250, 0.1) 0%, rgba(196, 181, 253, 0.1) 100%);
    border: 1px solid rgba(167, 139, 250, 0.3);
    border-radius: 8px;
    color: #a78bfa;
    font-size: 16px;
    font-weight: bold;
    cursor: pointer;
    outline: none;
    padding: 6px 32px 6px 12px;
    text-align: center;
    transition: all 0.3s ease;
    appearance: none;
    background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23a78bfa' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6,9 12,15 18,9'%3e%3c/polyline%3e%3c/svg%3e");
    background-repeat: no-repeat;
    background-position: right 10px center;
    background-size: 14px;
  }
  
  :global(.pair-selector:hover) {
    color: #c4b5fd;
    border-color: rgba(196, 181, 253, 0.5);
    background: linear-gradient(135deg, rgba(167, 139, 250, 0.15) 0%, rgba(196, 181, 253, 0.15) 100%);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(167, 139, 250, 0.2);
  }
  
  :global(.pair-selector:focus) {
    border-color: #a78bfa;
    box-shadow: 0 0 0 3px rgba(167, 139, 250, 0.3);
  }
  
  :global(.pair-selector option) {
    background: #2a2a2a;
    color: white;
    padding: 8px 12px;
    border: none;
  }
  
  :global(.pair-selector option:hover) {
    background: #3a3a3a;
  }
  
  :global(.pair-selector option:checked) {
    background: linear-gradient(135deg, #a78bfa 0%, #c4b5fd 100%);
    color: white;
  }

  :global(.chart-controls) {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  
  :global(.granularity-buttons) {
    display: flex;
    align-items: center;
    gap: 5px;
  }
  
  :global(.button-separator) {
    color: #666;
    font-size: 14px;
    font-weight: 300;
    margin: 0 4px;
    opacity: 0.6;
  }
  
  :global(.separator) {
    color: #666;
    font-size: 16px;
    font-weight: 300;
    margin: 0 8px;
    opacity: 0.6;
  }
  
  :global(.zoom-btn) {
    background: rgba(167, 139, 250, 0.1);
    border: 1px solid rgba(167, 139, 250, 0.3);
    border-radius: 4px;
    color: #a78bfa;
    font-size: 12px;
    padding: 4px 6px;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 24px;
    height: 24px;
  }
  
  :global(.zoom-btn:hover) {
    background: rgba(167, 139, 250, 0.15);
    border-color: rgba(167, 139, 250, 0.5);
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(167, 139, 250, 0.2);
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
    flex-direction: row;
    justify-content: space-between;
    align-items: flex-start;
    gap: 20px;
    padding: 10px 15px;
    background: rgba(0, 0, 0, 0.2);
    border-top: 1px solid rgba(74, 0, 224, 0.3);
  }
  
  .left-column {
    display: flex;
    flex-direction: column;
    gap: 8px;
    align-items: flex-end;
    flex-shrink: 0;
    flex: 1;
    border-right: 1px solid rgba(74, 0, 224, 0.3);
    padding-right: 8px;
  }
  
  .right-column {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-direction: row;
    padding-left: 8px;
    flex-shrink: 0;
  }
  
  .controls-group {
    display: flex;
    align-items: center;
    gap: 5px;
  }
  
  .date-speed-column {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  
  .play-stop-column {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  
  .timeframe-buttons-group {
    display: flex;
    justify-content: flex-start;
    gap: 5px;
    margin-right: 10px;
  }
  
  .candle-info-inline {
    display: flex;
    justify-content: flex-start;
    font-size: 11px;
    padding-top: 5px;
    margin-right: 4px;
  }
  
  .candle-info-inline :global(.chart-info) {
    width: auto !important;
    justify-content: flex-start !important;
    gap: 8px !important;
    margin-right: 20px !important;
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
    background: rgba(74, 0, 224, 0.3) !important;
    color: #a78bfa !important;
    border-color: #a78bfa !important;
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
    border-radius: 0 !important;
  }

  :global(.chart-panel .panel-content) {
    padding: 0;
    overflow: hidden;
    display: block;
  }

  /* Remove rounded edges from the actual chart */
  :global(.chart-panel canvas),
  :global(.chart-panel .tv-lightweight-charts),
  :global(.chart-panel .chart-container),
  :global(.chart-panel .chart-canvas) {
    border-radius: 0 !important;
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
    padding: 8px 0px 8px 8px !important;
    min-width: 90px;
    height: 30px !important;
    display: flex !important;
    align-items: center !important;
    justify-content: flex-start !important;
    box-sizing: border-box !important;
    margin: 0 !important;
    text-indent: 0 !important;
    transform: translateX(0px) !important;
  }

  :global(.date-picker-btn.compact::-webkit-datetime-edit) {
    padding-left: 0 !important;
    margin-left: 0 !important;
  }

  :global(.date-picker-btn.compact::-webkit-calendar-picker-indicator) {
    margin-left: 0 !important;
    padding-left: 0 !important;
    margin-right: 0 !important;
    padding-right: 0 !important;
  }

  :global(.speed-dropdown.compact) {
    padding: 8px 0px 8px 6px !important;
    height: 30px !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    background-position: right 2px center !important;
    padding-right: 15px !important;
  }

  :global(.chart-play-btn.compact) {
    padding: 8px 6px;
    height: 30px !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
  }

  :global(.chart-stop-btn.compact) {
    padding: 8px 6px;
    height: 30px !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
  }

  /* Dropdown option styling */
  :global(.speed-dropdown.compact option) {
    background: #1a1625 !important;
    color: #d1d4dc !important;
    padding: 8px !important;
    border: none !important;
  }

  :global(.speed-dropdown.compact option:hover) {
    background: rgba(74, 0, 224, 0.2) !important;
    color: #a78bfa !important;
  }

  :global(.speed-dropdown.compact option:checked) {
    background: rgba(74, 0, 224, 0.3) !important;
    color: #a78bfa !important;
  }

  /* Strategy dropdown styling */
  :global(select option) {
    background: #1a1625 !important;
    color: #d1d4dc !important;
    padding: 8px !important;
    border: none !important;
  }

  :global(select option:hover) {
    background: rgba(74, 0, 224, 0.2) !important;
    color: #a78bfa !important;
  }

  :global(select option:checked) {
    background: rgba(74, 0, 224, 0.3) !important;
    color: #a78bfa !important;
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