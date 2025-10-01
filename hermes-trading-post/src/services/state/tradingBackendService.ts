/**
 * @file tradingBackendService.ts
 * @description WebSocket client service that connects to the backend trading server
 */

import { writable, get } from 'svelte/store';
import type { Writable } from 'svelte/store';

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

  constructor() {
    const backendPort = import.meta.env.VITE_BACKEND_PORT || '4827';
    this.backendUrl = `ws://localhost:${backendPort}`;
    
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
          this.handleMessage(message);
        } catch (error) {
          console.error('Error parsing message:', error);
        }
      };

      this.ws.onclose = () => {
        console.log('Disconnected from trading backend');
        this.state.update(s => ({ ...s, isConnected: false }));
        this.attemptReconnect();
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
    } catch (error) {
      console.error('Failed to connect to backend:', error);
      this.attemptReconnect();
    }
  }

  private attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.reconnectDelay * this.reconnectAttempts;
      console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`);
      
      setTimeout(() => {
        this.connect();
      }, delay);
    } else {
      console.error('Max reconnection attempts reached. Please refresh the page.');
    }
  }

  private handleMessage(message: any) {
    // console.log('Received message:', message.type);
    
    switch (message.type) {
      case 'connected':
        // console.log('Backend connection established:', message.message);
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
        break;
        
      case 'trade':
        this.state.update(s => ({
          ...s,
          trades: [...s.trades, message.trade]
        }));
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
        console.error('Backend error:', message.message);
        break;
        
      // Bot manager messages
      case 'botManagerState':
      case 'managerState':
        // console.log('Received manager state update:', {
        //   hasBots: !!message.data?.bots,
        //   botCount: Object.keys(message.data?.bots || {}).length,
        //   activeBotId: message.data?.activeBotId
        // });
        
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
        console.log('Reset complete for bot:', message.botId);
        if (message.status) {
          this.updateStateFromBackend(message.status);
        }
        // Request updated manager state to refresh all bot states
        this.send({ type: 'getManagerState' });
        break;
        
      default:
        console.log('Unknown message type:', message.type);
    }
  }

  private updateStateFromBackend(status: any) {
    this.state.update(s => ({
      ...s,
      isRunning: status.isRunning || false,
      isPaused: status.isPaused || false,
      strategy: status.strategy || null,
      balance: status.balance || s.balance,
      positions: status.positions || s.positions,
      trades: status.trades || s.trades,
      currentPrice: status.currentPrice || s.currentPrice,
      totalValue: status.totalValue || s.totalValue,
      profitLoss: status.profitLoss || 0,
      profitLossPercent: status.profitLossPercent || 0,
      startTime: status.startTime || s.startTime,
      lastUpdateTime: status.lastUpdateTime || s.lastUpdateTime,
      chartData: status.chartData || s.chartData,
      tradesCount: status.tradesCount || status.trades?.length || 0,
      openPositions: status.openPositions || status.positions?.length || 0,
      activeBotId: status.activeBotId || s.activeBotId,
      botName: status.botName || s.botName
    }));
  }

  private send(data: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    } else {
      console.error('WebSocket is not connected');
    }
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  getState(): Writable<BackendTradingState> {
    return this.state;
  }

  startTrading(strategy: any, reset: boolean = false) {
    console.log('Starting trading with strategy:', strategy);
    
    // Log the actual configuration being sent
    if (strategy.strategyConfig) {
      console.log('📊 Strategy Configuration Details:', {
        strategyType: strategy.strategyType,
        initialDropPercent: strategy.strategyConfig.initialDropPercent,
        levelDropPercent: strategy.strategyConfig.levelDropPercent,
        profitTarget: strategy.strategyConfig.profitTarget || strategy.strategyConfig.profitTargetPercent,
        maxLevels: strategy.strategyConfig.maxLevels,
        fullConfig: strategy.strategyConfig
      });
    }
    
    this.send({
      type: 'start',
      config: { strategy, reset }
    });
  }

  stopTrading() {
    console.log('Stopping trading');
    this.send({ type: 'stop' });
  }

  pauseTrading() {
    console.log('Pausing trading');
    this.send({ type: 'pause' });
  }

  resumeTrading() {
    console.log('Resuming trading');
    this.send({ type: 'resume' });
  }

  resetTrading(botId?: string) {
    console.log('Resetting trading for bot:', botId || 'active bot');
    this.send({ 
      type: 'reset',
      botId: botId 
    });
  }

  updateStrategy(strategy: any) {
    console.log('Updating strategy:', strategy);
    
    // Log the actual configuration being sent
    if (strategy.strategyConfig) {
      console.log('📊 Updated Strategy Configuration Details:', {
        strategyType: strategy.strategyType,
        initialDropPercent: strategy.strategyConfig.initialDropPercent,
        levelDropPercent: strategy.strategyConfig.levelDropPercent,
        profitTarget: strategy.strategyConfig.profitTarget || strategy.strategyConfig.profitTargetPercent,
        maxLevels: strategy.strategyConfig.maxLevels,
        fullConfig: strategy.strategyConfig
      });
    }
    
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
      const backendPort = import.meta.env.VITE_BACKEND_PORT || '4827';
      const response = await fetch(`http://localhost:${backendPort}/api/trading/status`);
      const status = await response.json();
      this.updateStateFromBackend(status);
      return status;
    } catch (error) {
      console.error('Failed to fetch status:', error);
      return null;
    }
  }

  // Bot manager methods
  createBot(strategyType: string, botName: string, config: any = {}) {
    console.log('Creating bot:', { strategyType, botName, config });
    this.send({
      type: 'createBot',
      strategyType,
      botName,
      config
    });
  }

  selectBot(botId: string) {
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

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

export const tradingBackendService = new TradingBackendService();