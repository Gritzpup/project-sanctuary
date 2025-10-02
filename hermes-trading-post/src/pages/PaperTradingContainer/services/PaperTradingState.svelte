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
    public backendState = writable({
      currentPrice: 0,
      priceChange24h: 0,
      priceChangePercent24h: 0
    });
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
        this.backendState.update(current => ({
          ...current,
          ...state
        }));
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
        
        // Output comprehensive trading performance stats to console
        this.logTradingPerformance(backendState);
        
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
        this.backendState.update(current => ({
          ...current,
          currentPrice: backendState.currentPrice
        }));
        
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
      const backendStateValue = get(this.backendState);
      
      if (!tradingStateValue.selectedStrategyType) {
        console.error('No strategy type selected!');
        return;
      }
      
      if (!backendStateValue.currentPrice || backendStateValue.currentPrice <= 0) {
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
          profitTarget: 2.0,
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

    private logTradingPerformance(backendState: any) {
      if (!backendState.trades?.length && !backendState.positions?.length) return;
      
      const trades = backendState.trades || [];
      const positions = backendState.positions || [];
      const currentPrice = backendState.currentPrice || 0;
      const balance = backendState.balance || {};
      
      console.log('\n' + '='.repeat(80));
      console.log('📊 TRADING PERFORMANCE REPORT');
      console.log('='.repeat(80));
      console.log(`🕐 Timestamp: ${new Date().toISOString()}`);
      console.log(`💰 Current BTC Price: $${currentPrice.toFixed(2)}`);
      console.log(`💵 USD Balance: $${(balance.usd || 0).toFixed(2)}`);
      console.log(`₿  BTC Balance: ${(balance.btc || 0).toFixed(8)} BTC`);
      
      // Calculate total value
      const totalValue = (balance.usd || 0) + ((balance.btc || 0) * currentPrice);
      const startingBalance = 10000; // TODO: Get from state
      const totalPL = totalValue - startingBalance;
      const totalPLPercent = ((totalPL / startingBalance) * 100);
      
      console.log(`💎 Total Portfolio Value: $${totalValue.toFixed(2)}`);
      console.log(`📈 Total P/L: ${totalPL >= 0 ? '+' : ''}$${totalPL.toFixed(2)} (${totalPLPercent >= 0 ? '+' : ''}${totalPLPercent.toFixed(2)}%)`);
      
      // Strategy configuration
      console.log('\n🎯 STRATEGY CONFIGURATION:');
      console.log(`   Strategy: ${backendState.strategy?.strategyType || 'Unknown'}`);
      console.log(`   Profit Target: ${backendState.strategy?.strategyConfig?.profitTarget || 'N/A'}%`);
      console.log(`   Max Levels: ${backendState.strategy?.strategyConfig?.maxLevels || 'N/A'}`);
      console.log(`   Base Position: ${backendState.strategy?.strategyConfig?.basePositionPercent || 'N/A'}%`);
      console.log(`   Level Drop: ${backendState.strategy?.strategyConfig?.levelDropPercent || 'N/A'}%`);
      
      // Open positions
      console.log('\n📍 OPEN POSITIONS:');
      if (positions.length === 0) {
        console.log('   No open positions');
      } else {
        positions.forEach((pos, i) => {
          const unrealizedPL = (currentPrice - pos.entryPrice) * pos.quantity;
          const unrealizedPLPercent = ((currentPrice - pos.entryPrice) / pos.entryPrice) * 100;
          console.log(`   ${i + 1}. ${pos.quantity.toFixed(8)} BTC @ $${pos.entryPrice.toFixed(2)}`);
          console.log(`      Current P/L: ${unrealizedPL >= 0 ? '+' : ''}$${unrealizedPL.toFixed(2)} (${unrealizedPLPercent >= 0 ? '+' : ''}${unrealizedPLPercent.toFixed(2)}%)`);
          console.log(`      Entry Time: ${new Date(pos.timestamp).toLocaleString()}`);
        });
      }
      
      // Trading history
      console.log('\n📈 TRADING HISTORY:');
      if (trades.length === 0) {
        console.log('   No trades executed');
      } else {
        console.log(`   Total Trades: ${trades.length}`);
        
        const buyTrades = trades.filter(t => t.side === 'buy');
        const sellTrades = trades.filter(t => t.side === 'sell');
        
        console.log(`   Buy Orders: ${buyTrades.length}`);
        console.log(`   Sell Orders: ${sellTrades.length}`);
        
        const totalFees = trades.reduce((sum, trade) => sum + (trade.fees || 0), 0);
        console.log(`   Total Fees: $${totalFees.toFixed(2)}`);
        
        // Show last 10 trades
        console.log('\n   📋 Recent Trades (last 10):');
        const recentTrades = trades.slice(-10).reverse();
        recentTrades.forEach((trade, i) => {
          const time = new Date(trade.timestamp).toLocaleString();
          const side = trade.side.toUpperCase();
          const emoji = trade.side === 'buy' ? '🟢' : '🔴';
          console.log(`   ${emoji} ${side} ${trade.quantity.toFixed(8)} BTC @ $${trade.price.toFixed(2)} | ${time}`);
          if (trade.fees) console.log(`      Fee: $${trade.fees.toFixed(2)}`);
        });
        
        // Price levels analysis
        const buyPrices = buyTrades.map(t => t.price).sort((a, b) => b - a);
        const sellPrices = sellTrades.map(t => t.price).sort((a, b) => a - b);
        
        if (buyPrices.length > 0) {
          console.log(`\n   💰 Buy Price Range: $${Math.min(...buyPrices).toFixed(2)} - $${Math.max(...buyPrices).toFixed(2)}`);
          console.log(`   🎯 Average Buy Price: $${(buyPrices.reduce((a, b) => a + b, 0) / buyPrices.length).toFixed(2)}`);
        }
        
        if (sellPrices.length > 0) {
          console.log(`   💸 Sell Price Range: $${Math.min(...sellPrices).toFixed(2)} - $${Math.max(...sellPrices).toFixed(2)}`);
          console.log(`   🎯 Average Sell Price: $${(sellPrices.reduce((a, b) => a + b, 0) / sellPrices.length).toFixed(2)}`);
        }
      }
      
      // Performance metrics
      if (trades.length > 0) {
        console.log('\n📊 PERFORMANCE METRICS:');
        const completedPairs = this.calculateCompletedTradePairs(trades);
        if (completedPairs.length > 0) {
          const avgProfit = completedPairs.reduce((sum, pair) => sum + pair.profit, 0) / completedPairs.length;
          const winningTrades = completedPairs.filter(pair => pair.profit > 0);
          const winRate = (winningTrades.length / completedPairs.length) * 100;
          
          console.log(`   Completed Trade Pairs: ${completedPairs.length}`);
          console.log(`   Win Rate: ${winRate.toFixed(1)}%`);
          console.log(`   Average Profit per Pair: $${avgProfit.toFixed(2)}`);
          
          if (winningTrades.length > 0) {
            const avgWin = winningTrades.reduce((sum, pair) => sum + pair.profit, 0) / winningTrades.length;
            console.log(`   Average Winning Trade: $${avgWin.toFixed(2)}`);
          }
          
          const losingTrades = completedPairs.filter(pair => pair.profit < 0);
          if (losingTrades.length > 0) {
            const avgLoss = losingTrades.reduce((sum, pair) => sum + pair.profit, 0) / losingTrades.length;
            console.log(`   Average Losing Trade: $${avgLoss.toFixed(2)}`);
          }
        }
      }
      
      console.log('='.repeat(80) + '\n');
    }

    private calculateCompletedTradePairs(trades: any[]): any[] {
      // Simple approach: match buys with sells chronologically
      const pairs = [];
      const buyStack: any[] = [];
      
      for (const trade of trades) {
        if (trade.side === 'buy') {
          buyStack.push(trade);
        } else if (trade.side === 'sell' && buyStack.length > 0) {
          const buyTrade = buyStack.shift(); // FIFO
          const profit = (trade.price - buyTrade.price) * Math.min(trade.quantity, buyTrade.quantity) - (trade.fees || 0) - (buyTrade.fees || 0);
          pairs.push({
            buyPrice: buyTrade.price,
            sellPrice: trade.price,
            quantity: Math.min(trade.quantity, buyTrade.quantity),
            profit,
            buyTime: buyTrade.timestamp,
            sellTime: trade.timestamp
          });
        }
      }
      
      return pairs;
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