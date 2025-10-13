import { writable } from 'svelte/store';
import type { Strategy } from '../../../strategies/base/Strategy';
import type { Position } from '../../../strategies/base/StrategyTypes';
import { paperTradingManager } from '../../../services/state/paperTradingManager';
import { ReverseRatioStrategy } from '../../../strategies/implementations/ReverseRatioStrategy';
import { GridTradingStrategy } from '../../../strategies/implementations/GridTradingStrategy';
import { RSIMeanReversionStrategy } from '../../../strategies/implementations/RSIMeanReversionStrategy';
import { DCAStrategy } from '../../../strategies/implementations/DCAStrategy';
import { VWAPBounceStrategy } from '../../../strategies/implementations/VWAPBounceStrategy';
import { MicroScalpingStrategy } from '../../../strategies/implementations/MicroScalpingStrategy';
import { ProperScalpingStrategy } from '../../../strategies/implementations/ProperScalpingStrategy';
import { get } from 'svelte/store';
import { getBackendWsUrl } from '../../../utils/backendConfig';

export interface TradingState {
  isRunning: boolean;
  isPaused: boolean;
  selectedStrategyType: string;
  currentStrategy: Strategy | null;
  balance: number;
  btcBalance: number;
  vaultBalance: number;
  btcVaultBalance: number;
  trades: any[];
  positions: Position[];
  totalReturn: number;
  winRate: number;
  totalFees: number;
  totalRebates: number;
  totalRebalance: number;
  recentHigh: number;
  recentLow: number;
  currentPrice: number;
}

export class PaperTradingOrchestrator {
  private state = writable<TradingState>({
    isRunning: false,
    isPaused: false,
    selectedStrategyType: 'reverse-descending-grid',
    currentStrategy: null,
    balance: 10000,
    btcBalance: 0,
    vaultBalance: 0,
    btcVaultBalance: 0,
    trades: [],
    positions: [],
    totalReturn: 0,
    winRate: 0,
    totalFees: 0,
    totalRebates: 0,
    totalRebalance: 0,
    recentHigh: 0,
    recentLow: 0,
    currentPrice: 0
  });

  private backendWs: WebSocket | null = null;
  private backendConnected = false;

  constructor() {
    this.connectToBackend();
  }

  getState() {
    return this.state;
  }

  get webSocket() {
    return this.backendWs;
  }

  get isConnected() {
    return this.backendConnected;
  }

  updateState(updates: Partial<TradingState>) {
    this.state.update(current => ({ ...current, ...updates }));
  }

  private connectToBackend() {
    try {
      this.backendWs = new WebSocket(getBackendWsUrl());
      
      this.backendWs.onopen = () => {
        console.log('🟢 Connected to backend WebSocket - REALTIME MODE');
        this.backendConnected = true;
        this.backendWs?.send(JSON.stringify({ type: 'selectBot', botId: 'reverse-descending-grid-bot-1' }));
        // Request initial status once, then rely on realtime updates
        this.backendWs?.send(JSON.stringify({ type: 'getStatus' }));
      };
      
      this.backendWs.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleBackendMessage(data);
        } catch (error) {
          console.error('Backend WebSocket message error:', error);
        }
      };
      
      this.backendWs.onclose = () => {
        console.log('🔴 Backend WebSocket disconnected');
        this.backendConnected = false;

        // Reconnect after 2 seconds
        setTimeout(() => this.connectToBackend(), 2000);
      };
      
    } catch (error) {
      console.error('Backend WebSocket connection error:', error);
      setTimeout(() => this.connectToBackend(), 2000);
    }
  }

  private handleBackendMessage(data: any) {
    if (data.type === 'status' && data.data) {
      this.updateState({
        isRunning: data.data.isRunning || false,
        isPaused: data.data.isPaused || false,
        trades: data.data.trades || [],
        positions: data.data.positions || [],
        balance: data.data.balance?.usd || 10000,
        btcBalance: data.data.balance?.btc || 0,
        vaultBalance: data.data.balance?.vault || 0,
        btcVaultBalance: data.data.balance?.btcVault || 0,
        totalReturn: data.data.totalReturn || 0,
        winRate: data.data.winRate || 0,
        totalFees: data.data.totalFees || 0,
        totalRebates: data.data.totalRebates || 0,
        totalRebalance: data.data.totalRebalance || 0,
        recentHigh: data.data.recentHigh || 0,
        recentLow: data.data.recentLow || 0,
        currentPrice: data.data.currentPrice || 0
      });
    }
    
    if (data.type === 'tradingStopped') {
      console.log('📊 Backend bot stopped');
      this.updateState({
        isRunning: false,
        isPaused: false
      });
    }
    
    if (data.type === 'resetComplete') {
      console.log('📊 Backend reset confirmed');
      // Don't call resetState() again - just sync with the backend status
      if (data.status) {
        this.updateState({
          isRunning: data.status.isRunning || false,
          isPaused: data.status.isPaused || false,
          trades: data.status.trades || [],
          positions: data.status.positions || [],
          balance: data.status.balance?.usd || 10000,
          btcBalance: data.status.balance?.btc || 0,
          vaultBalance: data.status.balance?.vault || 0,
          btcVaultBalance: data.status.balance?.btcVault || 0,
          totalReturn: data.status.totalReturn || 0,
          winRate: data.status.winRate || 0,
          totalFees: data.status.totalFees || 0,
          totalRebates: data.status.totalRebates || 0,
          totalRebalance: data.status.totalRebalance || 0,
          recentHigh: data.status.recentHigh || 0,
          recentLow: data.status.recentLow || 0
        });
      }
    }
  }

  createStrategy(strategyType: string): Strategy | null {
    switch (strategyType) {
      case 'reverse-descending-grid':
        return new ReverseRatioStrategy({
          initialDropPercent: 0.1,
          levelDropPercent: 0.1,
          profitTarget: 0.85,
          maxLevels: 12,
          basePositionPercent: 6
        });
      case 'grid-trading':
        return new GridTradingStrategy();
      case 'rsi-mean-reversion':
        return new RSIMeanReversionStrategy();
      case 'dca':
        return new DCAStrategy();
      case 'vwap-bounce':
        return new VWAPBounceStrategy();
      case 'micro-scalping':
        return new MicroScalpingStrategy();
      case 'proper-scalping':
        return new ProperScalpingStrategy();
      case 'ultra-micro-scalping':
        return new UltraMicroScalpingStrategy();
      default:
        return null;
    }
  }

  startTrading(strategyType: string, currentPrice: number) {
    console.log('🚀 START TRADING - Orchestrator', { 
      strategyType, 
      currentPrice,
      backendConnected: this.backendConnected,
      currentState: get(this.state)
    });
    
    if (this.backendWs && this.backendConnected) {
      console.log('Sending START command to backend...');
      this.backendWs.send(JSON.stringify({
        type: 'start',
        config: {
          strategyType,
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
    
    // Fallback to local logic
    try {
      paperTradingManager.selectStrategy(strategyType);
      const activeBot = paperTradingManager.getActiveBot();
      
      if (activeBot && !get(this.state).isRunning) {
        this.updateState({
          recentHigh: currentPrice,
          recentLow: currentPrice
        });
        
        const strategy = this.createStrategy(strategyType);
        
        if (strategy) {
          console.log('Starting bot with strategy:', strategy.getName());
          activeBot.service.start(strategy, 'BTC-USD', get(this.state).balance);
          
          const botState = activeBot.service.getState();
          const currentBotState = get(botState);
          this.updateState({
            isRunning: currentBotState.isRunning,
            isPaused: currentBotState.isPaused || false,
            currentStrategy: strategy,
            selectedStrategyType: strategyType
          });
        }
      }
    } catch (error) {
      console.error('Error in startTrading:', error);
      throw error;
    }
  }

  pauseTrading() {
    if (this.backendWs && this.backendConnected) {
      this.backendWs.send(JSON.stringify({ type: 'pause' }));
      return;
    }
    
    const activeBot = paperTradingManager.getActiveBot();
    if (activeBot) {
      activeBot.service.setPaused(true);
      const botState = activeBot.service.getState();
      const currentBotState = get(botState);
      this.updateState({
        isPaused: currentBotState.isPaused || false
      });
    }
  }

  resumeTrading() {
    if (this.backendWs && this.backendConnected) {
      this.backendWs.send(JSON.stringify({ type: 'resume' }));
      return;
    }
    
    const activeBot = paperTradingManager.getActiveBot();
    if (activeBot) {
      activeBot.service.setPaused(false);
      const botState = activeBot.service.getState();
      const currentBotState = get(botState);
      this.updateState({
        isPaused: currentBotState.isPaused || false
      });
    }
  }

  resetState() {
    this.updateState({
      isRunning: false,
      isPaused: false,
      selectedStrategyType: 'reverse-descending-grid', // Reset to default strategy
      balance: 10000,
      btcBalance: 0,
      vaultBalance: 0,
      btcVaultBalance: 0,
      positions: [],
      trades: [],
      totalReturn: 0,
      winRate: 0,
      currentStrategy: null
    });
    
    if (this.backendWs && this.backendConnected) {
      this.backendWs.send(JSON.stringify({ 
        type: 'stop', 
        botId: 'reverse-descending-grid-bot-1' 
      }));
      
      setTimeout(() => {
        this.backendWs?.send(JSON.stringify({ 
          type: 'reset', 
          botId: 'reverse-descending-grid-bot-1' 
        }));
      }, 200);
      return;
    }
    
    const activeBot = paperTradingManager.getActiveBot();
    if (activeBot) {
      activeBot.service.resetStrategy();
    }
  }

  feedPriceToStrategy(price: number) {
    const currentState = get(this.state);
    
    if (currentState.isRunning) {
      if (currentState.recentHigh === 0 || price > currentState.recentHigh) {
        this.updateState({ recentHigh: price });
      }
      if (currentState.recentLow === 0 || price < currentState.recentLow) {
        this.updateState({ recentLow: price });
      }
      
      const activeBot = paperTradingManager.getActiveBot();
      if (activeBot && activeBot.service) {
        this.processPriceThroughStrategy(activeBot, price);
      }
    }
  }

  private processPriceThroughStrategy(activeBot: any, price: number) {
    try {
      const botState = activeBot.service.getState();
      const currentBotState = get(botState);
      
      if (currentBotState.strategy && currentBotState.isRunning) {
        const candleData = {
          time: Math.floor(Date.now() / 1000),
          open: price,
          high: price,
          low: price,
          close: price,
          volume: 0
        };
        
        const signal = currentBotState.strategy.onCandle(candleData, currentBotState.strategy.getState());
        
        if (signal && (signal.action === 'buy' || signal.action === 'sell')) {
          console.log('Strategy generated signal:', signal);
          this.executeTradeFromSignal(activeBot, signal, price);
        }
      }
    } catch (error) {
      console.error('Error processing price through strategy:', error);
    }
  }

  private executeTradeFromSignal(activeBot: any, signal: any, price: number) {
    try {
      const botService = activeBot.service;
      const currentState = get(botService.getState());
      
      if (signal.action === 'buy') {
        const buyAmount = Math.min(signal.amount || 100, currentState.balance.usd);
        if (buyAmount > 0) {
          const btcAmount = buyAmount / price;
          console.log(`Executing BUY: $${buyAmount.toFixed(2)} at $${price.toFixed(2)} = ${btcAmount.toFixed(6)} BTC`);
          
          botService.getState().update((state: any) => ({
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
              fees: buyAmount * 0.001
            }]
          }));
        }
      } else if (signal.action === 'sell') {
        const sellAmount = Math.min(signal.amount || currentState.balance.btcPositions, currentState.balance.btcPositions);
        if (sellAmount > 0) {
          const usdAmount = sellAmount * price;
          console.log(`Executing SELL: ${sellAmount.toFixed(6)} BTC at $${price.toFixed(2)} = $${usdAmount.toFixed(2)}`);
          
          botService.getState().update((state: any) => ({
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
              fees: usdAmount * 0.001
            }]
          }));
        }
      }
      
      const updatedState = get(botService.getState());
      this.updateState({
        balance: updatedState.balance.usd,
        btcBalance: updatedState.balance.btcPositions,
        vaultBalance: updatedState.balance.vault,
        btcVaultBalance: updatedState.balance.btcVault,
        trades: updatedState.trades
      });
      
    } catch (error) {
      console.error('Error executing trade from signal:', error);
    }
  }


  destroy() {
    this.backendWs?.close();
  }
}