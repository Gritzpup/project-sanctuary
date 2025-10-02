<script lang="ts" context="module">
  import { writable, get } from 'svelte/store';
  import { PaperTradingOrchestrator } from '../../PaperTrading/services/PaperTradingOrchestrator';
  import { BackendConnector } from '../../PaperTrading/services/BackendConnector';
  import { paperTradingManager } from '../../../services/state/paperTradingManager';
  import { strategyStore } from '../../../stores/strategyStore';
  import { tradingBackendService } from '../../../services/state/tradingBackendService';

  // Built-in strategies
  export const builtInStrategies = [
    { value: 'reverse-ratio', label: 'Reverse Ratio', description: 'Grid trading with reverse position sizing', isCustom: false },
    { value: 'grid-trading', label: 'Grid Trading', description: 'Classic grid trading strategy', isCustom: false },
    { value: 'rsi-mean-reversion', label: 'RSI Mean Reversion', description: 'Trade RSI oversold/overbought', isCustom: false },
    { value: 'dca', label: 'Dollar Cost Averaging', description: 'Regular periodic purchases', isCustom: false },
    { value: 'vwap-bounce', label: 'VWAP Bounce', description: 'Trade VWAP support/resistance', isCustom: false },
    { value: 'micro-scalping', label: 'Micro Scalping', description: 'High-frequency trading', isCustom: false },
    { value: 'proper-scalping', label: 'Proper Scalping', description: 'Professional scalping', isCustom: false },
    { value: 'ultra-micro-scalping', label: 'Ultra Micro Scalping', description: 'Hyper-aggressive 1-minute scalping', isCustom: false }
  ];

  export class PaperTradingStateManager {
    private orchestrator: PaperTradingOrchestrator;
    private backendConnector: BackendConnector;
    private managerStateStore = paperTradingManager.getState();
    
    public tradingState = writable({
      selectedStrategyType: 'reverse-ratio',
      isRunning: false,
      isPaused: false,
      balance: 10000,
      trades: [],
      positions: []
    });
    public backendState: any = {};
    public managerState: any = {};
    public activeBotInstance: any = null;
    public botTabs: any[] = [];
    
    public customStrategies: any[] = [];
    
    private chartComponent: any = null;
    
    constructor() {
      console.log('🏗️ PaperTradingStateManager constructor called');
      this.orchestrator = new PaperTradingOrchestrator();
      this.backendConnector = new BackendConnector();
      
      // Test if tradingBackendService is working
      console.log('🔍 Testing tradingBackendService connection:', {
        isConnected: tradingBackendService.isConnected(),
        service: !!tradingBackendService
      });
      
      this.initializeSubscriptions();
      
      // Immediately fetch current trading status from backend
      this.fetchBackendStatus();
    }

    private async fetchBackendStatus() {
      try {
        console.log('🔄 Fetching current backend status...');
        const status = await tradingBackendService.fetchStatus();
        if (status) {
          console.log('✅ Backend status fetched:', status);
        }
      } catch (error) {
        console.error('❌ Failed to fetch backend status:', error);
      }
    }

    get strategies() {
      return [...builtInStrategies, ...this.customStrategies];
    }

    private initializeSubscriptions() {
      // Subscribe to backend state for price data
      this.backendConnector.getState().subscribe(state => {
        this.backendState = state;
      });

      // Subscribe to ACTUAL trading backend service for real-time updates - THIS IS THE PRIMARY DATA SOURCE
      console.log('📡 Setting up tradingBackendService subscription...');
      tradingBackendService.getState().subscribe(backendState => {
        console.log('📡 Backend state update received:', {
          isConnected: backendState.isConnected,
          isRunning: backendState.isRunning,
          trades: backendState.trades?.length || 0,
          positions: backendState.positions?.length || 0,
          balance: backendState.balance
        });
        
        // Update frontend state with backend trading data
        this.tradingState.update(current => ({
          ...current,
          isRunning: backendState.isRunning,
          isPaused: backendState.isPaused,
          selectedStrategyType: backendState.strategy?.strategyType || current.selectedStrategyType || 'reverse-ratio',
          balance: backendState.balance.usd,
          btcBalance: backendState.balance.btc,
          trades: backendState.trades || [],
          positions: backendState.positions || [],
          currentPrice: backendState.currentPrice,
          totalReturn: backendState.profitLoss,
          totalFees: (backendState.trades || []).reduce((sum, trade) => sum + (trade.fees || 0), 0)
        }));
        
        // Create chart markers from trades and update chart
        this.updateChartMarkers(backendState.trades || []);
        
        // Also update backend state for UI
        this.backendState = {
          ...this.backendState,
          currentPrice: backendState.currentPrice
        };
        
        // Forward currentPrice to BackendConnector if available
        if (backendState.currentPrice && backendState.currentPrice > 0) {
          this.backendConnector.updatePrice(backendState.currentPrice);
        }
        
        // Force reactivity update
        this.updateBotTabs();
      });
      
      // Subscribe to manager state
      this.managerStateStore.subscribe(state => {
        this.managerState = state;
        this.updateBotTabs();
      });
      
      // Setup price feeding
      this.backendConnector.onPriceUpdate((price) => {
        this.orchestrator.feedPriceToStrategy(price);
      });
      
      // Keep strategy type synced with store
      strategyStore.subscribe(store => {
        if (store.selectedType && store.selectedType !== this.tradingState.selectedStrategyType) {
          this.orchestrator.updateState({ selectedStrategyType: store.selectedType });
        }
      });
    }

    private updateBotTabs() {
      const tradingStateValue = get(this.tradingState);
      if (!this.managerState || !tradingStateValue.selectedStrategyType) return;
      
      this.activeBotInstance = this.managerState.activeBot;
      
      const strategies = this.managerState.strategies || {};
      const managerBots = strategies[tradingStateValue.selectedStrategyType]?.bots || [];
      this.botTabs = managerBots.map((bot: any, index: number) => {
        let status: 'idle' | 'running' | 'paused' = 'idle';
        
        if (bot.id === this.activeBotInstance?.id) {
          status = tradingStateValue.isRunning ? (tradingStateValue.isPaused ? 'paused' : 'running') : 'idle';
        }
        
        return {
          id: bot.id,
          name: `Bot ${index + 1}`,
          balance: bot.balance || 10000,
          status
        };
      });
    }

    // Event handlers
    handleStrategyChange(value: string) {
      this.tradingState.update(current => ({ ...current, selectedStrategyType: value }));
      strategyStore.setStrategy(value, {});
      paperTradingManager.selectStrategy(value);
    }

    handleBalanceChange(balance: number) {
      this.tradingState.update(current => ({ ...current, balance }));
      const activeBot = paperTradingManager.getActiveBot();
      if (activeBot) {
        activeBot.setBalance(balance);
      }
    }

    handleStartTrading() {
      const tradingStateValue = get(this.tradingState);
      
      if (!tradingStateValue.selectedStrategyType) {
        console.error('No strategy type selected!');
        return;
      }
      
      if (!this.backendState.currentPrice || this.backendState.currentPrice <= 0) {
        console.error('No current price available!');
        return;
      }
      
      // Use the backend service to start trading instead of just the orchestrator
      console.log('🚀 Starting trading via backend service...');
      const strategy = {
        strategyType: tradingStateValue.selectedStrategyType,
        strategyConfig: {
          initialDropPercent: 0.1,
          levelDropPercent: 0.1,
          profitTarget: 0.85,
          maxLevels: 12,
          basePositionPercent: 6
        }
      };
      tradingBackendService.startTrading(strategy);
      
      console.log('✅ Start trading command sent, NOT calling reset');
    }

    handlePauseTrading() {
      tradingBackendService.pauseTrading();
    }

    handleResumeTrading() {
      tradingBackendService.resumeTrading();
    }

    handleReset(chartComponent?: any) {
      console.log('🔄 Manual reset requested');
      tradingBackendService.resetTrading();
      
      // Clear chart markers safely
      try {
        if (chartComponent && typeof chartComponent.clearMarkers === 'function') {
          chartComponent.clearMarkers();
        } else if (chartComponent && typeof chartComponent.addMarkers === 'function') {
          chartComponent.addMarkers([]);
        }
      } catch (error) {
        console.warn('Chart marker clearing failed:', error);
      }
    }

    handleBotTabSelect(botId: string) {
      // Select new bot without resetting (to preserve existing data)
      paperTradingManager.selectBot(botId);
      
      // Tell orchestrator to switch to this bot without resetting
      if (this.orchestrator.webSocket && this.orchestrator.isConnected) {
        this.orchestrator.webSocket.send(JSON.stringify({ type: 'selectBot', botId }));
        this.orchestrator.webSocket.send(JSON.stringify({ type: 'getStatus' }));
      }
      
      // Force immediate sync
      setTimeout(() => {
        const freshState = paperTradingManager.getState();
        if (freshState.activeBot) {
          // Sync with backend if available
        }
      }, 100);
    }

    setChartComponent(chartComponent: any) {
      this.chartComponent = chartComponent;
      console.log('📊 Chart component set:', {
        component: !!chartComponent,
        addMarkers: typeof chartComponent?.addMarkers,
        methods: chartComponent ? Object.getOwnPropertyNames(chartComponent).filter(name => typeof chartComponent[name] === 'function') : []
      });
    }

    private updateChartMarkers(trades: any[]) {
      if (!this.chartComponent || !trades.length) return;
      
      try {
        // Convert trades to chart markers
        const markers = trades.map(trade => {
          // Align marker time to the candle time (1-minute candles)
          const tradeTime = Math.floor(trade.timestamp / 1000); // Convert to seconds
          const candleTime = Math.floor(tradeTime / 60) * 60; // Round down to nearest minute
          
          return {
            time: candleTime,
            position: trade.side === 'buy' ? 'belowBar' : 'aboveBar',
            color: trade.side === 'buy' ? '#26a69a' : '#ef4444',
            shape: trade.side === 'buy' ? 'arrowUp' : 'arrowDown',
            text: trade.side.toUpperCase()
          };
        });
        
        console.log('📈 Adding', markers.length, 'trade markers to chart:', markers);
        
        // Try multiple ways to access the addMarkers method
        if (typeof this.chartComponent.addMarkers === 'function') {
          console.log('✅ Calling chartComponent.addMarkers');
          this.chartComponent.addMarkers(markers);
        } else if (this.chartComponent.chartCore && typeof this.chartComponent.chartCore.addMarkers === 'function') {
          console.log('✅ Calling chartComponent.chartCore.addMarkers');
          this.chartComponent.chartCore.addMarkers(markers);
        } else {
          console.warn('Chart addMarkers method not available. Available methods:', 
            this.chartComponent ? Object.getOwnPropertyNames(this.chartComponent).filter(name => typeof this.chartComponent[name] === 'function') : 'no component');
          console.warn('Retrying in 1 second...');
          setTimeout(() => this.updateChartMarkers(trades), 1000);
        }
      } catch (error) {
        console.warn('Failed to update chart markers:', error);
      }
    }

    destroy() {
      if (this.orchestrator) this.orchestrator.destroy();
      if (this.backendConnector) this.backendConnector.destroy();
    }
  }
</script>

<script lang="ts">
  // This component only exports utility classes and functions
  // No UI rendering
</script>