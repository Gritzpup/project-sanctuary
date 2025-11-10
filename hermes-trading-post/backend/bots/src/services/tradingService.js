//////////////////////////////////////////////////////////////////////////////
// tradingService.js - Main trading service API
//////////////////////////////////////////////////////////////////////////////
// Purpose:
//   Public API for trading operations. Acts as a wrapper around the internal
//   TradingOrchestrator to provide a clean, consistent interface for managing
//   bot instances, executing trades, and coordinating strategy operations.
//
// Architecture:
//   - TradingService: Public API (this file)
//   - TradingOrchestrator: Internal orchestration logic
//   - TradeExecutor: Trade execution and FIFO accounting
//   - PositionManager: Position tracking
//   - StrategyRegistry: Strategy management
//   - TradingStateRepository: Persistence layer
//
// Usage:
//   import { TradingService } from './tradingService.js';
//   const service = new TradingService(botId);
//   service.startTrading(strategy);
//
// Note: This is the main entry point for all trading operations. All public
// trading methods should be exposed here, delegating to TradingOrchestrator
// for implementation details.
//////////////////////////////////////////////////////////////////////////////

import { TradingOrchestrator } from './trading/TradingOrchestrator.js';

// Track all active bot instances to prevent recreation
const activeBotInstances = new Map();

export class TradingService {
  constructor(botId = null) {
    // Check if this bot already exists and is running
    if (botId && activeBotInstances.has(botId)) {
    }

    this.botId = botId;

    // Register this instance
    if (botId) {
      activeBotInstances.set(botId, this);
    }

    // Initialize the orchestrator
    this.orchestrator = new TradingOrchestrator(botId);

    // Proxy all orchestrator methods and properties
    this.proxyOrchestratorMethods();
  }

  proxyOrchestratorMethods() {
    // Proxy all public methods from orchestrator
    const methodsToProxy = [
      'addClient',
      'removeClient',
      'broadcast',
      'startTrading',
      'stopTrading',
      'pauseTrading',
      'resumeTrading',
      'getStatus',
      'resetState',
      'loadState',
      'saveState',
      'cleanup'
    ];

    methodsToProxy.forEach(method => {
      this[method] = (...args) => this.orchestrator[method](...args);
    });

    // Proxy properties
    Object.defineProperty(this, 'isRunning', {
      get: () => this.orchestrator.isRunning,
      set: (value) => this.orchestrator.isRunning = value
    });

    Object.defineProperty(this, 'isPaused', {
      get: () => this.orchestrator.isPaused,
      set: (value) => this.orchestrator.isPaused = value
    });

    Object.defineProperty(this, 'currentPrice', {
      get: () => this.orchestrator.currentPrice,
      set: (value) => this.orchestrator.currentPrice = value
    });

    Object.defineProperty(this, 'balance', {
      get: () => this.orchestrator.balance,
      set: (value) => this.orchestrator.balance = value
    });

    Object.defineProperty(this, 'trades', {
      get: () => this.orchestrator.trades
    });

    Object.defineProperty(this, 'positions', {
      get: () => this.orchestrator.positionManager.getPositions()
    });
  }

  // Keep the API compatible with existing code
  async fetchCurrentPrice() {
    // This method is no longer needed as price comes from websocket
    // but keeping for compatibility
    return this.orchestrator.currentPrice;
  }

  async updateRealtimePrice(price, product_id) {
    await this.orchestrator.processPrice(price, product_id);
  }

  // Legacy compatibility methods
  async updateStrategy(strategy) {
    // This would update strategy config if needed
  }

  static getActiveInstance(botId) {
    return activeBotInstances.get(botId);
  }

  static getAllInstances() {
    return Array.from(activeBotInstances.values());
  }

  static removeInstance(botId) {
    activeBotInstances.delete(botId);
  }

  destroy() {
    this.orchestrator.cleanup();
    if (this.botId) {
      activeBotInstances.delete(this.botId);
    }
  }
}
