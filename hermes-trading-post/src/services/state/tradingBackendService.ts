/**
 * @file tradingBackendService.ts
 * @description WebSocket client service that connects to the backend trading server
 */

import { writable, get } from 'svelte/store';
import type { Writable } from 'svelte/store';
import { getBackendWsUrl, getBackendHttpUrl } from '../../utils/backendConfig';

export interface BackendTradingState {
  isConnected: boolean;
  isRunning: boolean;
  isPaused: boolean;
  strategy: any;
  balance: {
    usd: number;
    btc: number;
  };
  positions: any[];
  trades: any[];
  currentPrice: number;
  totalValue: number;
  profitLoss: number;
  profitLossPercent: number;
  startTime: number | null;
  lastUpdateTime: number | null;
  chartData: {
    recentHigh: number;
    recentLow: number;
    initialTradingPrice: number;
    initialRecentHigh: number;
    initialTradingAngle: number;
    lastTradeTime: number;
  };
  tradesCount: number;
  openPositions: number;
  // Trading statistics
  totalFees: number;
  totalRebates: number;
  totalReturn: number;
  totalRebalance: number;
  winRate: number;
  winningTrades: number;
  losingTrades: number;
  // Vault balances
  vaultBalance: number;
  btcVaultBalance: number;
  // Next trigger distances
  nextBuyDistance: number | null;
  nextSellDistance: number | null;
  // Bot manager state
  activeBotId: string | null;
  botName: string | null;
  managerState: any;
}

class TradingBackendService {
  private ws: WebSocket | null = null;
  private state: Writable<BackendTradingState>;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 1000;
  private backendUrl: string;
  private updateThrottleMs = 100; // Throttle to 10fps to reduce load
  private lastUpdateTime = 0;
  private pendingUpdate: Partial<BackendTradingState> | null = null;
  private updateScheduled = false;

  constructor() {
    this.backendUrl = getBackendWsUrl();
    
    
    this.state = writable<BackendTradingState>({
      isConnected: false,
      isRunning: false,
      isPaused: false,
      strategy: null,
      balance: {
        usd: 10000,
        btc: 0
      },
      positions: [],
      trades: [],
      currentPrice: 0,
      totalValue: 10000,
      profitLoss: 0,
      profitLossPercent: 0,
      startTime: null,
      lastUpdateTime: null,
      chartData: {
        recentHigh: 0,
        recentLow: 0,
        initialTradingPrice: 0,
        initialRecentHigh: 0,
        initialTradingAngle: 0,
        lastTradeTime: 0
      },
      tradesCount: 0,
      openPositions: 0,
      // Trading statistics
      totalFees: 0,
      totalRebates: 0,
      totalReturn: 0,
      totalRebalance: 0,
      winRate: 0,
      winningTrades: 0,
      losingTrades: 0,
      // Vault balances
      vaultBalance: 0,
      btcVaultBalance: 0,
      // Next trigger distances
      nextBuyDistance: null,
      nextSellDistance: null,
      activeBotId: null,
      botName: null,
      managerState: null
    });

    this.connect();
  }

  private connect() {
    try {
      this.ws = new WebSocket(this.backendUrl);

      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        this.state.update(s => ({ ...s, isConnected: true }));
        
        // Request manager state and current status immediately after connecting
        this.send({ type: 'getManagerState' });
        this.send({ type: 'getStatus' });
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.handleMessageDirect(message);
        } catch (error) {
        }
      };

      this.ws.onclose = () => {
        this.state.update(s => ({ ...s, isConnected: false }));
        this.attemptReconnect();
      };

      this.ws.onerror = (error) => {
      };
    } catch (error) {
      this.attemptReconnect();
    }
  }

  private attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.reconnectDelay * this.reconnectAttempts;
      
      setTimeout(() => {
        this.connect();
      }, delay);
    } else {
    }
  }

  // Direct update - no setTimeout batching
  private handleMessageDirect(message: any) {
    switch (message.type) {
      case 'connected':
        if (message.managerState) {
          this.state.update(s => ({ ...s, managerState: message.managerState }));
        }
        if (message.status) {
          this.updateStateFromBackend(message.status);
        }
        break;

      case 'status':
        this.updateStateFromBackend(message.data);
        break;

      case 'priceUpdate':
        this.state.update(s => ({
          ...s,
          currentPrice: message.price,
          chartData: message.chartData || s.chartData
        }));
        if (message.status) {
          this.updateStateFromBackend(message.status);
        }
        break;

      case 'trade':
        this.state.update(s => {
          // Cap trades array at 1000 most recent to prevent memory leak
          const newTrades = [...s.trades, message.trade];
          if (newTrades.length > 1000) {
            newTrades.shift(); // Remove oldest
          }
          return {
            ...s,
            trades: newTrades
          };
        });
        if (message.status) {
          this.updateStateFromBackend(message.status);
        }
        break;

      case 'tradingStarted':
      case 'tradingStopped':
      case 'tradingPaused':
      case 'tradingResumed':
      case 'strategyUpdated':
        if (message.status) {
          this.updateStateFromBackend(message.status);
        }
        break;

      case 'error':
        break;

      // Bot manager messages
      case 'botManagerState':
      case 'managerState':
        //   hasBots: !!message.data?.bots,
        //   botCount: Object.keys(message.data?.bots || {}).length,
        //   activeBotId: message.data?.activeBotId
        // });

        // Direct update - no batching needed for manager state
        this.state.update(s => ({
          ...s,
          managerState: message.data,
          activeBotId: message.data?.activeBotId || s.activeBotId
        }));
        break;

      case 'botCreated':
      case 'botSelected':
      case 'botDeleted':
        // Request updated manager state
        this.send({ type: 'getManagerState' });
        if (message.data?.status) {
          this.updateStateFromBackend(message.data.status);
        }
        break;

      case 'resetComplete':
        if (message.status) {
          this.updateStateFromBackend(message.status);
        }
        // Request updated manager state to refresh all bot states
        this.send({ type: 'getManagerState' });
        break;
        
      case 'selectedStrategyUpdated':
        // Request updated manager state to refresh bot configs
        this.send({ type: 'getManagerState' });
        break;
        
      default:
    }
  }

  private updateStateFromBackend(status: any) {
    // Direct update - Svelte handles batching internally
    this.state.update(s => {
      // Cap arrays to prevent memory leaks
      let positions = status.positions || s.positions;
      if (positions.length > 100) {
        positions = positions.slice(-100); // Keep last 100
      }

      let trades = status.trades || s.trades;
      if (trades.length > 1000) {
        trades = trades.slice(-1000); // Keep last 1000
      }

      return {
        ...s,
        isRunning: status.isRunning || false,
        isPaused: status.isPaused || false,
        strategy: status.strategy || null,
        balance: status.balance || s.balance,
        positions,
        trades,
        currentPrice: status.currentPrice || s.currentPrice,
        totalValue: status.totalValue || s.totalValue,
        profitLoss: status.profitLoss || 0,
        profitLossPercent: status.profitLossPercent || 0,
        startTime: status.startTime || s.startTime,
        lastUpdateTime: status.lastUpdateTime || s.lastUpdateTime,
        chartData: status.chartData || s.chartData,
        tradesCount: status.tradesCount || status.trades?.length || 0,
        openPositions: status.openPositions || status.positions?.length || 0,
        totalFees: status.totalFees || 0,
        totalRebates: status.totalRebates || 0,
        totalReturn: status.totalReturn || 0,
        totalRebalance: status.totalRebalance || 0,
        winRate: status.winRate || 0,
        winningTrades: status.winningTrades || 0,
        losingTrades: status.losingTrades || 0,
        vaultBalance: status.vaultBalance || 0,
        btcVaultBalance: status.btcVaultBalance || 0,
        nextBuyDistance: status.nextBuyDistance,
        nextSellDistance: status.nextSellDistance,
        nextBuyPrice: status.nextBuyPrice,
        nextSellPrice: status.nextSellPrice,
        activeBotId: status.activeBotId || s.activeBotId,
        botName: status.botName || s.botName
      };
    });
  }

  private send(data: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    } else {
    }
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  getState(): Writable<BackendTradingState> {
    return this.state;
  }

  startTrading(strategy: any, reset: boolean = false) {
    // Flatten the structure - backend expects strategyType and strategyConfig directly in config
    this.send({
      type: 'start',
      config: {
        strategyType: strategy.strategyType,
        strategyConfig: strategy.strategyConfig,
        reset
      }
    });
  }

  stopTrading() {
    console.log('[BackendService] Sending stop command');
    this.send({ type: 'stop' });
  }

  pauseTrading() {
    this.send({ type: 'pause' });
  }

  resumeTrading() {
    this.send({ type: 'resume' });
  }

  resetTrading(botId?: string) {
    this.send({ 
      type: 'reset',
      botId: botId 
    });
  }

  updateStrategy(strategy: any) {
    
    this.send({
      type: 'updateStrategy',
      strategy
    });
  }

  getStatus() {
    this.send({ type: 'getStatus' });
  }

  async fetchStatus(): Promise<any> {
    try {
      const response = await fetch(`${getBackendHttpUrl()}/api/trading/status`);
      const status = await response.json();
      this.updateStateFromBackend(status);
      return status;
    } catch (error) {
      return null;
    }
  }

  // Bot manager methods
  createBot(strategyType: string, botName: string, config: any = {}) {
    this.send({
      type: 'createBot',
      strategyType,
      botName,
      config
    });
  }

  selectBot(botId: string) {
    console.log('[BackendService] Selecting bot:', botId);
    this.send({
      type: 'selectBot',
      botId
    });
  }

  deleteBot(botId: string) {
    this.send({
      type: 'deleteBot',
      botId
    });
  }

  getManagerState() {
    this.send({ type: 'getManagerState' });
  }

  updateSelectedStrategy(strategyType: string, botId?: string) {
    this.send({
      type: 'updateSelectedStrategy',
      strategyType,
      botId
    });
  }

  updateBalance(balance: number) {
    this.send({
      type: 'updateBalance',
      balance
    });
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

export const tradingBackendService = new TradingBackendService();