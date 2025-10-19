/**
 * Refactored Paper Trading State Manager
 * Broken down into smaller, focused components for better maintainability
 */

import { writable, get } from 'svelte/store';
import { PaperTradingOrchestrator } from '../../PaperTrading/services/PaperTradingOrchestrator';
import { BackendConnector } from '../../PaperTrading/services/BackendConnector';
import { paperTradingManager } from '../../../services/state/paperTradingManager';
import { strategyStore } from '../../../stores/strategyStore';
import { tradingBackendService } from '../../../services/state/tradingBackendService';

// Import extracted components
import type { TradingState, BackendState, BotTab } from '../types/TradingTypes';
import { builtInStrategies, DEFAULT_BALANCE } from '../constants/StrategyConstants';
import { PerformanceLogger } from '../utils/PerformanceLogger';
import { ChartIntegration } from '../utils/ChartIntegration';
import { TradingOperations } from './TradingOperations';

export class PaperTradingStateManager {
  private orchestrator: PaperTradingOrchestrator;
  private backendConnector: BackendConnector;
  private managerStateStore = paperTradingManager.getState();
  private chartComponent: any = null;
  
  public tradingState = writable<TradingState>({
    selectedStrategyType: 'reverse-descending-grid',
    isRunning: false,
    isPaused: false,
    balance: DEFAULT_BALANCE,
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
  public botTabs: BotTab[] = [];
  public customStrategies: any[] = [];
  
  constructor() {
    console.log('🏗️ PaperTradingStateManager constructor called');
    this.orchestrator = new PaperTradingOrchestrator();
    this.backendConnector = new BackendConnector();
    
    this.logBackendServiceStatus();
    this.initializeSubscriptions();
    this.fetchBackendStatus();
  }

  private logBackendServiceStatus() {
    console.log('🔍 Testing tradingBackendService connection:', {
      isConnected: tradingBackendService.isConnected(),
      service: !!tradingBackendService
    });
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
    this.setupBackendStateSubscription();
    this.setupTradingBackendSubscription();
    this.setupManagerStateSubscription();
    this.setupPriceFeeding();
    this.setupStrategyStoreSubscription();
    this.loadCustomStrategies();
  }

  private setupBackendStateSubscription() {
    this.backendConnector.getState().subscribe(state => {
      this.backendState.update(current => ({
        ...current,
        ...state
      }));
    });
  }

  private setupTradingBackendSubscription() {
    console.log('📡 Setting up tradingBackendService subscription...');
    tradingBackendService.getState().subscribe(backendState => {
      this.logBackendStateUpdate(backendState);
      this.updateTradingState(backendState);
      this.updateChartMarkers(backendState.trades || []);
      this.updateBackendState(backendState);
      this.updateBotTabs();
    });
  }

  private logBackendStateUpdate(backendState: any) {
    // Backend state updates tracked without console spam

    PerformanceLogger.logTradingPerformance(backendState);
  }

  private updateTradingState(backendState: any) {
    this.tradingState.update(current => {
      const selectedStrategyType = this.determineSelectedStrategyType(current, backendState);
      
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
  }

  private determineSelectedStrategyType(current: TradingState, backendState: any): string {
    // Try to get selectedStrategyType from various sources with priority
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
    
    return selectedStrategyType;
  }

  private updateChartMarkers(trades: any[]) {
    ChartIntegration.updateChartMarkers(this.chartComponent, trades);
  }

  private updateBackendState(backendState: any) {
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
  }

  private setupManagerStateSubscription() {
    this.managerStateStore.subscribe(state => {
      this.managerState = state;
      this.updateBotTabs();
    });
  }

  private setupPriceFeeding() {
    this.backendConnector.onPriceUpdate((price) => {
      this.orchestrator.feedPriceToStrategy(price);
    });
  }

  private setupStrategyStoreSubscription() {
    strategyStore.subscribe(store => {
      if (store.selectedType && store.selectedType !== get(this.tradingState).selectedStrategyType) {
        this.tradingState.update(current => ({
          ...current,
          selectedStrategyType: store.selectedType
        }));
      }
    });
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

  private updateBotTabs() {
    this.botTabs = this.managerState.instances?.map((instance: any, index: number) => ({
      id: instance.id || `bot-${index}`,
      name: instance.name || `Bot ${index + 1}`,
      strategy: instance.strategy?.strategyType || 'unknown',
      isActive: instance.isRunning || false,
      performance: instance.performance || { totalReturn: 0, tradesCount: 0 }
    })) || [];
    
    this.activeBotInstance = this.botTabs.find(tab => tab.isActive) || this.botTabs[0] || null;
  }

  // Public API methods
  public setChartComponent(component: any) {
    this.chartComponent = component;
    console.log('📊 Chart component set for state manager');
  }

  public async handleStrategyChange(strategyType: string) {
    return TradingOperations.handleStrategyChange(strategyType, this.tradingState.update.bind(this.tradingState));
  }

  public async handleBalanceChange(balance: number) {
    return TradingOperations.handleBalanceChange(balance, this.tradingState.update.bind(this.tradingState));
  }

  public async handleStartTrading() {
    const currentState = get(this.tradingState);
    return TradingOperations.handleStartTrading(currentState);
  }

  public async handlePauseTrading() {
    return TradingOperations.handlePauseTrading();
  }

  public async handleResumeTrading() {
    return TradingOperations.handleResumeTrading();
  }

  public async handleStopTrading() {
    return TradingOperations.handleStopTrading();
  }

  public async handleReset(chartComponent?: any) {
    return TradingOperations.handleReset(
      this.tradingState.update.bind(this.tradingState),
      chartComponent || this.chartComponent
    );
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
    
    if (this.orchestrator) {
      this.orchestrator.destroy?.();
    }
    if (this.backendConnector) {
      this.backendConnector.destroy?.();
    }
  }
}

// Re-export the constants for backward compatibility
export { builtInStrategies } from '../constants/StrategyConstants';
export type { TradingState, BackendState } from '../types/TradingTypes';