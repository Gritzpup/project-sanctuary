<script lang="ts" context="module">
  import { PaperTradingOrchestrator } from '../../PaperTrading/services/PaperTradingOrchestrator';
  import { BackendConnector } from '../../PaperTrading/services/BackendConnector';
  import { paperTradingManager } from '../../../services/state/paperTradingManager';
  import { strategyStore } from '../../../stores/strategyStore';

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
    
    public tradingState: any = {};
    public backendState: any = {};
    public managerState: any = {};
    public activeBotInstance: any = null;
    public botTabs: any[] = [];
    
    public customStrategies: any[] = [];
    
    constructor() {
      this.orchestrator = new PaperTradingOrchestrator();
      this.backendConnector = new BackendConnector();
      this.initializeSubscriptions();
    }

    get strategies() {
      return [...builtInStrategies, ...this.customStrategies];
    }

    private initializeSubscriptions() {
      // Subscribe to trading state
      this.orchestrator.getState().subscribe(state => {
        this.tradingState = state;
        this.updateBotTabs();
        
        // Forward currentPrice to BackendConnector if available
        if (state.currentPrice && state.currentPrice > 0) {
          this.backendConnector.updatePrice(state.currentPrice);
        }
      });
      
      // Subscribe to backend state
      this.backendConnector.getState().subscribe(state => {
        this.backendState = state;
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
      if (!this.managerState || !this.tradingState.selectedStrategyType) return;
      
      this.activeBotInstance = this.managerState.activeBot;
      
      const strategies = this.managerState.strategies || {};
      const managerBots = strategies[this.tradingState.selectedStrategyType]?.bots || [];
      this.botTabs = managerBots.map((bot: any, index: number) => {
        let status: 'idle' | 'running' | 'paused' = 'idle';
        
        if (bot.id === this.activeBotInstance?.id) {
          status = this.tradingState.isRunning ? (this.tradingState.isPaused ? 'paused' : 'running') : 'idle';
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
      this.orchestrator.updateState({ selectedStrategyType: value });
      strategyStore.setStrategy(value, {});
      paperTradingManager.selectStrategy(value);
    }

    handleBalanceChange(balance: number) {
      this.orchestrator.updateState({ balance });
      const activeBot = paperTradingManager.getActiveBot();
      if (activeBot) {
        activeBot.setBalance(balance);
      }
    }

    handleStartTrading() {
      
      if (!this.tradingState.selectedStrategyType) {
        console.error('No strategy type selected!');
        return;
      }
      
      if (!this.backendState.currentPrice || this.backendState.currentPrice <= 0) {
        console.error('No current price available!');
        return;
      }
      
      this.orchestrator.startTrading(this.tradingState.selectedStrategyType, this.backendState.currentPrice);
    }

    handlePauseTrading() {
      this.orchestrator.pauseTrading();
    }

    handleResumeTrading() {
      this.orchestrator.resumeTrading();
    }

    handleReset(chartComponent?: any) {
      this.orchestrator.resetState();
      
      // Clear chart markers
      if (chartComponent && typeof chartComponent.clearMarkers === 'function') {
        chartComponent.clearMarkers();
      } else if (chartComponent && typeof chartComponent.addMarkers === 'function') {
        chartComponent.addMarkers([]);
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