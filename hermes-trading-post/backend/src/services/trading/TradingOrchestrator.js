import { EventEmitter } from 'events';
import { strategyRegistry } from '../../strategies/StrategyRegistry.js';
import { TradeExecutor } from './TradeExecutor.js';
import { PositionManager } from './PositionManager.js';
import { TradingStateRepository } from '../persistence/TradingStateRepository.js';

export class TradingOrchestrator extends EventEmitter {
  constructor(botId = null) {
    super();
    
    this.botId = botId;
    this.clients = new Set();
    this.isRunning = false;
    this.isPaused = false;
    this.strategy = null;
    this.strategyConfig = null;
    
    // Initialize sub-services
    this.tradeExecutor = new TradeExecutor();
    this.positionManager = new PositionManager();
    this.stateRepository = new TradingStateRepository(botId);
    
    // Trading state
    this.balance = {
      usd: 10000,
      btc: 0
    };
    this.currentPrice = 0;
    this.trades = [];
    this.candles = [];
    this.chartData = {
      recentHigh: 0,
      recentLow: 0,
      initialTradingPrice: 0,
      initialRecentHigh: 0,
      initialTradingAngle: 0,
      lastTradeTime: 0
    };
    
    // Load state
    this.loadState().catch(error => {
      console.error('Failed to load initial state:', error);
    });
  }

  addClient(ws) {
    this.clients.add(ws);
  }

  removeClient(ws) {
    this.clients.delete(ws);
  }

  broadcast(message) {
    const messageString = JSON.stringify(message);
    this.clients.forEach(client => {
      if (client.readyState === 1) {
        client.send(messageString);
      }
    });
  }

  async startTrading(config) {
    console.log('TradingOrchestrator.startTrading called:', {
      isRunning: this.isRunning,
      config: config
    });

    if (this.isRunning) {
      console.log('Trading is already running');
      return;
    }

    try {
      // Create strategy instance
      this.strategyConfig = config.strategyConfig || {};
      this.strategy = strategyRegistry.createStrategy(config.strategyType, this.strategyConfig);
      
      // Restore positions to strategy if they exist
      if (this.positionManager.getPositions().length > 0) {
        this.strategy.restorePositions(this.positionManager.getPositions());
      }

      this.isRunning = true;
      this.isPaused = false;
      
      // Store initial conditions for strategy context
      if (this.currentPrice > 0) {
        this.chartData.initialTradingPrice = this.currentPrice;
        this.chartData.initialRecentHigh = this.currentPrice;
        this.strategy.recentHigh = this.currentPrice;
      }
      
      console.log(`✅ Trading started with ${config.strategyType} strategy`);
      
      // Save state and broadcast
      await this.saveState();
      this.broadcastStatus();
      
    } catch (error) {
      console.error('Error starting trading:', error);
      this.isRunning = false;
      throw error;
    }
  }

  stopTrading() {
    console.log('TradingOrchestrator.stopTrading called');
    
    this.isRunning = false;
    this.isPaused = false;
    this.strategy = null;
    
    console.log('✅ Trading stopped');
    this.broadcastStatus();
  }

  pauseTrading() {
    if (this.isRunning) {
      this.isPaused = true;
      console.log('✅ Trading paused');
      this.broadcastStatus();
    }
  }

  resumeTrading() {
    if (this.isRunning && this.isPaused) {
      this.isPaused = false;
      console.log('✅ Trading resumed');
      this.broadcastStatus();
    }
  }

  async processPrice(price, product_id) {
    if (!this.isRunning || this.isPaused || !this.strategy) return;

    this.currentPrice = price;
    this.updateCandles(price);

    try {
      // Analyze market conditions
      const signal = this.strategy.analyze(this.candles, price);
      
      if (signal.type === 'buy') {
        await this.executeBuySignal(signal, price);
      } else if (signal.type === 'sell') {
        await this.executeSellSignal(signal, price);
      }
      
    } catch (error) {
      console.error('Error processing price:', error);
    }
  }

  async executeBuySignal(signal, price) {
    const positionSize = this.strategy.calculatePositionSize(this.balance.usd, signal, price);
    const totalCost = positionSize * price;
    
    if (totalCost <= this.balance.usd && totalCost >= 1) {
      const position = await this.tradeExecutor.executeBuy(positionSize, price, signal.reason);
      
      // Update balance and positions
      this.balance.usd -= totalCost;
      this.balance.btc += positionSize;
      
      this.positionManager.addPosition(position);
      this.strategy.addPosition(position);
      this.trades.push(this.createTradeRecord('buy', positionSize, price, signal.reason));
      
      console.log(`🟢 BUY executed: ${positionSize.toFixed(6)} BTC at $${price.toFixed(2)} (${signal.reason})`);
      
      await this.saveState();
      this.broadcastStatus();
    }
  }

  async executeSellSignal(signal, price) {
    const totalBtc = this.positionManager.getTotalBtc();
    
    if (totalBtc > 0) {
      const saleValue = totalBtc * price;
      
      // Execute the sale
      await this.tradeExecutor.executeSell(totalBtc, price, signal.reason);
      
      // Update balance and clear positions
      this.balance.usd += saleValue;
      this.balance.btc = 0;
      
      this.positionManager.clearAllPositions();
      this.strategy.clearAllPositions();
      this.trades.push(this.createTradeRecord('sell', totalBtc, price, signal.reason));
      
      console.log(`🔴 SELL executed: ${totalBtc.toFixed(6)} BTC at $${price.toFixed(2)} (${signal.reason})`);
      
      await this.saveState();
      this.broadcastStatus();
    }
  }

  createTradeRecord(side, amount, price, reason) {
    return {
      id: Date.now(),
      timestamp: Date.now(),
      side,
      amount,
      price,
      value: amount * price,
      fees: (amount * price) * 0.001,
      reason
    };
  }

  updateCandles(price) {
    const now = Date.now();
    const currentMinute = Math.floor(now / 60000) * 60000;
    
    if (!this.currentCandle || this.currentCandle.time < currentMinute / 1000) {
      if (this.currentCandle) {
        this.candles.push(this.currentCandle);
        
        if (this.candles.length > 500) {
          this.candles = this.candles.slice(-500);
        }
      }
      
      this.currentCandle = {
        time: currentMinute / 1000,
        open: price,
        high: price,
        low: price,
        close: price,
        volume: 0
      };
    } else {
      this.currentCandle.high = Math.max(this.currentCandle.high, price);
      this.currentCandle.low = Math.min(this.currentCandle.low, price);
      this.currentCandle.close = price;
    }
  }

  getStatus() {
    let positions = this.positionManager.getPositions();
    
    // HOTFIX: If we have BTC balance but no positions, reconstruct from trades
    if (positions.length === 0 && this.balance.btc > 0 && this.trades.length > 0) {
      // Find the most recent buy trade to reconstruct the position
      const buyTrades = this.trades.filter(t => t.side === 'buy' || t.type === 'buy');
      if (buyTrades.length > 0) {
        const lastBuyTrade = buyTrades[buyTrades.length - 1];
        const reconstructedPosition = {
          id: lastBuyTrade.id || lastBuyTrade.timestamp,
          entryPrice: lastBuyTrade.price,
          size: this.balance.btc, // Use current BTC balance as position size
          timestamp: lastBuyTrade.timestamp,
          type: 'buy',
          reason: lastBuyTrade.reason || 'Reconstructed from trade history'
        };
        positions = [reconstructedPosition];
        console.log('🔧 HOTFIX: Reconstructed position from BTC balance and trade history');
      }
    }
    
    return {
      isRunning: this.isRunning,
      isPaused: this.isPaused,
      balance: this.balance,
      currentPrice: this.currentPrice,
      positions: positions,
      trades: this.trades,
      strategyType: this.strategy ? this.strategyConfig?.strategyType : null,
      positionCount: positions.length,
      totalValue: this.calculateTotalValue()
    };
  }

  calculateTotalValue() {
    return this.balance.usd + (this.balance.btc * this.currentPrice);
  }

  broadcastStatus() {
    this.broadcast({
      type: 'status',
      data: this.getStatus()
    });
  }

  async resetState() {
    this.isRunning = false;
    this.isPaused = false;
    this.strategy = null;
    this.balance = { usd: 10000, btc: 0 };
    this.trades = [];
    this.positionManager.clearAllPositions();
    this.chartData = {
      recentHigh: 0,
      recentLow: 0,
      initialTradingPrice: 0,
      initialRecentHigh: 0,
      initialTradingAngle: 0,
      lastTradeTime: 0
    };
    
    await this.saveState();
    console.log('✅ State reset completed');
  }

  async loadState() {
    try {
      const state = await this.stateRepository.loadState();
      if (state) {
        Object.assign(this, state);
        console.log(`✅ State loaded for bot ${this.botId}`);
      }
    } catch (error) {
      console.error('Error loading state:', error);
    }
  }

  async saveState() {
    try {
      await this.stateRepository.saveState(this.getStatus());
    } catch (error) {
      console.error('Error saving state:', error);
    }
  }

  cleanup() {
    // Cleanup resources
    this.stopTrading();
    this.clients.clear();
  }
}