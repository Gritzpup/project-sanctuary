import { writable, get } from 'svelte/store';
import { PaperTradingOrchestrator } from '../../PaperTrading/services/PaperTradingOrchestrator';
import { BackendConnector } from '../../PaperTrading/services/BackendConnector';
import { paperTradingManager } from '../../../services/state/paperTradingManager';
import { strategyStore } from '../../../stores/strategyStore';
import { tradingBackendService } from '../../../services/state/tradingBackendService';

// Built-in strategies
export const builtInStrategies = [
  { value: 'reverse-descending-grid', label: 'Reverse Descending Grid', description: 'Grid trading with reverse position sizing', isCustom: false },
  { value: 'grid-trading', label: 'Grid Trading', description: 'Classic grid trading strategy', isCustom: false },
  { value: 'rsi-mean-reversion', label: 'RSI Mean Reversion', description: 'Trade RSI oversold/overbought', isCustom: false },
  { value: 'dca', label: 'Dollar Cost Averaging', description: 'Regular periodic purchases', isCustom: false },
  { value: 'vwap-bounce', label: 'VWAP Bounce', description: 'Trade VWAP support/resistance', isCustom: false },
  { value: 'micro-scalping', label: 'Micro Scalping', description: 'High-frequency trading', isCustom: false },
  { value: 'proper-scalping', label: 'Proper Scalping', description: 'Professional scalping', isCustom: false },
  { value: 'ultra-micro-scalping', label: 'Ultra Micro Scalping', description: 'Hyper-aggressive 1-minute scalping', isCustom: false }
];

export interface TradingState {
  selectedStrategyType: string;
  isRunning: boolean;
  isPaused: boolean;
  balance: number;
  btcBalance?: number;
  vaultBalance?: number;
  btcVaultBalance?: number;
  trades: any[];
  positions: any[];
  currentPrice?: number;
  totalReturn?: number;
  totalFees?: number;
  totalRebates?: number;
  totalRebalance?: number;
}

export interface BackendState {
  currentPrice: number;
  priceChange24h: number;
  priceChangePercent24h: number;
  nextBuyDistance: number | null;
  nextSellDistance: number | null;
  nextBuyPrice: number | null;
  nextSellPrice: number | null;
}

export class PaperTradingStateManager {
  private orchestrator: PaperTradingOrchestrator;
  private backendConnector: BackendConnector;
  private managerStateStore = paperTradingManager.getState();
  
  public tradingState = writable<TradingState>({
    selectedStrategyType: 'reverse-descending-grid',
    isRunning: false,
    isPaused: false,
    balance: 10000,
    trades: [],
    positions: []
  });
  
  public backendState = writable<BackendState>({
    currentPrice: 0,
    priceChange24h: 0,
    priceChangePercent24h: 0,
    nextBuyDistance: null,
    nextSellDistance: null,
    nextBuyPrice: null,
    nextSellPrice: null
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

    // Subscribe to ACTUAL trading backend service for real-time updates
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
      this.tradingState.update(current => {
        // Try to get selectedStrategyType from various sources
        let selectedStrategyType = current.selectedStrategyType || 'reverse-descending-grid';
        
        // First priority: direct from backend state
        if (backendState.selectedStrategyType) {
          selectedStrategyType = backendState.selectedStrategyType;
        }
        // Second priority: from strategy type
        else if (backendState.strategy?.strategyType) {
          selectedStrategyType = backendState.strategy?.strategyType;
        }
        // Third priority: from manager state active bot
        else if (backendState.managerState?.bots && backendState.activeBotId) {
          const activeBot = backendState.managerState.bots[backendState.activeBotId];
          if (activeBot?.status?.selectedStrategyType) {
            selectedStrategyType = activeBot.status.selectedStrategyType;
          }
        }
        
        return {
          ...current,
          isRunning: backendState.isRunning,
          isPaused: backendState.isPaused,
          selectedStrategyType,
          balance: backendState.balance.usd,
          btcBalance: backendState.balance.btc,
          trades: backendState.trades || [],
          positions: backendState.positions || [],
          currentPrice: backendState.currentPrice,
          totalReturn: backendState.profitLoss,
          totalFees: (backendState.trades || []).reduce((sum, trade) => sum + (trade.fees || 0), 0)
        };
      });
      
      // Create chart markers from trades and update chart
      this.updateChartMarkers(backendState.trades || []);
      
      // Also update backend state for UI
      this.backendState.update(current => ({
        ...current,
        currentPrice: backendState.currentPrice,
        nextBuyDistance: backendState.nextBuyDistance,
        nextSellDistance: backendState.nextSellDistance,
        nextBuyPrice: backendState.nextBuyPrice,
        nextSellPrice: backendState.nextSellPrice
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
      if (store.selectedType && store.selectedType !== get(this.tradingState).selectedStrategyType) {
        this.tradingState.update(current => ({
          ...current,
          selectedStrategyType: store.selectedType
        }));
      }
    });
    
    // Load custom strategies
    this.loadCustomStrategies();
  }

  private async loadCustomStrategies() {
    try {
      strategyStore.subscribe(store => {
        this.customStrategies = store.customStrategies || [];
      });
    } catch (error) {
      console.error('Failed to load custom strategies:', error);
    }
  }

  private logTradingPerformance(backendState: any) {
    const { balance, trades, positions, currentPrice, profitLoss, isRunning } = backendState;
    
    if (!isRunning || !balance) return;
    
    console.log('\n' + '='.repeat(80));
    console.log('🚀 HERMES TRADING POST - LIVE PERFORMANCE DASHBOARD');
    console.log('='.repeat(80));
    
    // Account balances
    console.log('\n💰 ACCOUNT BALANCE:');
    console.log(`   💵 USD Balance: $${balance.usd?.toFixed(2) || '0.00'}`);
    console.log(`   ₿  BTC Balance: ${balance.btc?.toFixed(8) || '0.00000000'} BTC`);
    
    if (balance.vault) {
      console.log(`   🏦 USD Vault: $${balance.vault.usd?.toFixed(2) || '0.00'}`);
      console.log(`   🏦 BTC Vault: ${balance.vault.btc?.toFixed(8) || '0.00000000'} BTC`);
    }
    
    const totalValue = (balance.usd || 0) + ((balance.btc || 0) * currentPrice);
    console.log(`   💎 Total Portfolio Value: $${totalValue.toFixed(2)}`);
    
    // P&L Information
    console.log('\n📊 PROFIT & LOSS:');
    const startingBalance = 10000; // Should be configurable
    const totalReturn = profitLoss || 0;
    const returnPercent = (totalReturn / startingBalance) * 100;
    const emoji = totalReturn >= 0 ? '🟢' : '🔴';
    
    console.log(`   ${emoji} Total Return: ${totalReturn >= 0 ? '+' : ''}$${totalReturn.toFixed(2)}`);
    console.log(`   📈 Return %: ${returnPercent >= 0 ? '+' : ''}${returnPercent.toFixed(2)}%`);
    console.log(`   🎯 Current Price: $${currentPrice?.toFixed(2) || '0.00'}`);
    
    // Position information
    console.log('\n📍 OPEN POSITIONS:');
    if (!positions || positions.length === 0) {
      console.log('   No open positions');
    } else {
      positions.forEach((pos: any, i: number) => {
        if (!pos || typeof pos.quantity !== 'number' || typeof pos.entryPrice !== 'number') {
          console.log(`   ${i + 1}. Invalid position data:`, pos);
          return;
        }
        
        const unrealizedPL = (currentPrice - pos.entryPrice) * pos.quantity;
        const unrealizedPLPercent = ((currentPrice - pos.entryPrice) / pos.entryPrice) * 100;
        console.log(`   ${i + 1}. ${pos.quantity.toFixed(8)} BTC @ $${pos.entryPrice.toFixed(2)}`);
        console.log(`      Current P/L: ${unrealizedPL >= 0 ? '+' : ''}$${unrealizedPL.toFixed(2)} (${unrealizedPLPercent >= 0 ? '+' : ''}${unrealizedPLPercent.toFixed(2)}%)`);
        console.log(`      Entry Time: ${new Date(pos.timestamp || Date.now()).toLocaleString()}`);
      });
    }
    
    // Trading history
    console.log('\n📈 TRADING HISTORY:');
    if (!trades || trades.length === 0) {
      console.log('   No trades executed');
    } else {
      console.log(`   Total Trades: ${trades.length}`);
      
      const buyTrades = trades.filter((t: any) => t.side === 'buy');
      const sellTrades = trades.filter((t: any) => t.side === 'sell');
      
      console.log(`   Buy Orders: ${buyTrades.length}`);
      console.log(`   Sell Orders: ${sellTrades.length}`);
      
      const totalFees = trades.reduce((sum: number, trade: any) => sum + (trade.fees || 0), 0);
      console.log(`   Total Fees: $${totalFees.toFixed(2)}`);
      
      // Show last 10 trades
      console.log('\n   📋 Recent Trades (last 10):');
      const recentTrades = trades.slice(-10).reverse();
      recentTrades.forEach((trade: any, i: number) => {
        const time = new Date(trade.timestamp).toLocaleString();
        const side = trade.side.toUpperCase();
        const emoji = trade.side === 'buy' ? '🟢' : '🔴';
        const quantity = trade.quantity || trade.amount || 0;
        const price = trade.price || 0;
        const fees = trade.fees || 0;
        console.log(`   ${emoji} ${side} ${(quantity || 0).toFixed(8)} BTC @ $${(price || 0).toFixed(2)} | ${time}`);
        if (fees) console.log(`      Fee: $${(fees || 0).toFixed(2)}`);
      });
      
      // Price levels analysis
      const buyPrices = buyTrades.map((t: any) => t.price).sort((a: number, b: number) => b - a);
      const sellPrices = sellTrades.map((t: any) => t.price).sort((a: number, b: number) => a - b);
      
      if (buyPrices.length > 0) {
        console.log(`\n   💰 Buy Price Range: $${Math.min(...buyPrices).toFixed(2)} - $${Math.max(...buyPrices).toFixed(2)}`);
        console.log(`   🎯 Average Buy Price: $${(buyPrices.reduce((a: number, b: number) => a + b, 0) / buyPrices.length).toFixed(2)}`);
      }
      
      if (sellPrices.length > 0) {
        console.log(`\n   💸 Sell Price Range: $${Math.min(...sellPrices).toFixed(2)} - $${Math.max(...sellPrices).toFixed(2)}`);
        console.log(`   🎯 Average Sell Price: $${(sellPrices.reduce((a: number, b: number) => a + b, 0) / sellPrices.length).toFixed(2)}`);
      }
    }
    
    console.log('\n' + '='.repeat(80));
  }

  private updateChartMarkers(trades: any[]) {
    if (!this.chartComponent || !trades.length) return;
    
    try {
      // Create markers from trades
      const markers = trades.map(trade => {
        const quantity = trade.quantity || trade.amount || 0;
        const price = trade.price || 0;
        const side = trade.side || 'unknown';
        
        return {
          time: Math.floor(new Date(trade.timestamp).getTime() / 1000),
          position: side === 'buy' ? 'belowBar' : 'aboveBar',
          color: side === 'buy' ? '#26a69a' : '#ef5350',
          shape: side === 'buy' ? 'arrowUp' : 'arrowDown',
          text: side.toUpperCase()
        };
      });
      
      // Update chart with markers
      if (this.chartComponent.clearMarkers && this.chartComponent.addMarkers) {
        this.chartComponent.clearMarkers();
        this.chartComponent.addMarkers(markers);
      }
      
      console.log(`📍 Updated chart with ${markers.length} trade markers`);
    } catch (error) {
      console.error('❌ Failed to update chart markers:', error);
    }
  }

  private updateBotTabs() {
    // Create bot tabs based on manager state
    this.botTabs = this.managerState.instances?.map((instance: any, index: number) => ({
      id: instance.id || `bot-${index}`,
      name: instance.name || `Bot ${index + 1}`,
      strategy: instance.strategy?.strategyType || 'unknown',
      isActive: instance.isRunning || false,
      performance: instance.performance || { totalReturn: 0, tradesCount: 0 }
    })) || [];
    
    // Set active bot instance
    this.activeBotInstance = this.botTabs.find(tab => tab.isActive) || this.botTabs[0] || null;
  }

  // Public API methods
  public setChartComponent(component: any) {
    this.chartComponent = component;
    console.log('📊 Chart component set for state manager');
  }

  public async handleStrategyChange(strategyType: string) {
    console.log('🔄 Strategy change requested:', strategyType);
    
    this.tradingState.update(current => ({
      ...current,
      selectedStrategyType: strategyType
    }));
    
    try {
      // Update strategy parameters for current session
      await tradingBackendService.updateStrategy(strategyType);
      
      // Persist strategy selection in backend database for this bot
      await tradingBackendService.updateSelectedStrategy(strategyType);
      
      console.log('✅ Strategy updated and selection persisted successfully');
    } catch (error) {
      console.error('❌ Failed to update strategy:', error);
    }
  }

  public async handleBalanceChange(balance: number) {
    console.log('💰 Balance change requested:', balance);
    
    this.tradingState.update(current => ({
      ...current,
      balance
    }));
    
    try {
      await tradingBackendService.updateBalance(balance);
      console.log('✅ Balance updated successfully');
    } catch (error) {
      console.error('❌ Failed to update balance:', error);
    }
  }

  public async handleStartTrading() {
    console.log('▶️ Starting trading...');
    
    try {
      const currentState = get(this.tradingState);
      const selectedStrategy = builtInStrategies.find(s => s.value === currentState.selectedStrategyType);
      
      if (!selectedStrategy) {
        throw new Error(`No strategy found for type: ${currentState.selectedStrategyType}`);
      }
      
      const strategyConfig = {
        strategyType: selectedStrategy.value,
        strategyConfig: {
          initialDropPercent: 0.02,   // Ultra aggressive: 0.02% drop for first level
          levelDropPercent: 0.02,     // Ultra aggressive: 0.02% additional drop per level
          profitTargetPercent: 0.5,   // Optimized: 0.5% profit target (covers fees + vault + rebalance)
          maxLevels: 15              // Increased to 15 levels for more frequent buys
        }
      };
      
      await tradingBackendService.startTrading(strategyConfig);
      console.log('✅ Trading started successfully');
    } catch (error) {
      console.error('❌ Failed to start trading:', error);
    }
  }

  public async handlePauseTrading() {
    console.log('⏸️ Pausing trading...');
    
    try {
      await tradingBackendService.pauseTrading();
      console.log('✅ Trading paused successfully');
    } catch (error) {
      console.error('❌ Failed to pause trading:', error);
    }
  }

  public async handleResumeTrading() {
    console.log('▶️ Resuming trading...');
    
    try {
      await tradingBackendService.resumeTrading();
      console.log('✅ Trading resumed successfully');
    } catch (error) {
      console.error('❌ Failed to resume trading:', error);
    }
  }

  public async handleStopTrading() {
    console.log('⏹️ Stopping trading...');
    
    try {
      await tradingBackendService.stopTrading();
      console.log('✅ Trading stopped successfully');
    } catch (error) {
      console.error('❌ Failed to stop trading:', error);
    }
  }

  public async handleReset(chartComponent?: any) {
    console.log('🔄 Resetting trading state...');
    
    try {
      await tradingBackendService.resetTrading();
      
      // Reset local state
      this.tradingState.update(current => ({
        ...current,
        isRunning: false,
        isPaused: false,
        trades: [],
        positions: [],
        balance: 10000,
        totalReturn: 0,
        totalFees: 0
      }));
      
      // Clear chart markers
      if (chartComponent && chartComponent.clearMarkers) {
        chartComponent.clearMarkers();
      }
      
      console.log('✅ Trading state reset successfully');
    } catch (error) {
      console.error('❌ Failed to reset trading state:', error);
    }
  }

  public handleBotTabSelect(botId: string) {
    console.log('🤖 Bot tab selected:', botId);
    
    const selectedBot = this.botTabs.find(tab => tab.id === botId);
    if (selectedBot) {
      this.activeBotInstance = selectedBot;
      console.log('✅ Active bot instance updated:', selectedBot.name);
    }
  }

  public destroy() {
    console.log('🗑️ Destroying PaperTradingStateManager');
    
    // Clean up subscriptions
    if (this.orchestrator) {
      this.orchestrator.destroy?.();
    }
    if (this.backendConnector) {
      this.backendConnector.destroy?.();
    }
  }
}