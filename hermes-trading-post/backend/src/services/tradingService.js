import axios from 'axios';
import { EventEmitter } from 'events';

export class TradingService extends EventEmitter {
  constructor() {
    super();
    this.clients = new Set();
    this.isRunning = false;
    this.isPaused = false;
    this.strategy = null;
    this.positions = [];
    this.trades = [];
    this.balance = {
      usd: 10000,
      btc: 0
    };
    this.currentPrice = 0;
    this.priceHistory = [];
    this.startTime = null;
    this.lastUpdateTime = null;
    this.tradingInterval = null;
    this.priceUpdateInterval = null;
    this.chartData = {
      recentHigh: 0,
      recentLow: 0,
      initialTradingPrice: 0,
      initialRecentHigh: 0,
      initialTradingAngle: 0,
      lastTradeTime: 0
    };

    this.loadState();
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

  async fetchCurrentPrice() {
    try {
      const response = await axios.get('https://api.coinbase.com/v2/exchange-rates?currency=BTC');
      const price = parseFloat(response.data.data.rates.USD);
      this.currentPrice = price;
      this.priceHistory.push({ time: Date.now(), price });
      
      if (this.priceHistory.length > 1000) {
        this.priceHistory = this.priceHistory.slice(-500);
      }
      
      return price;
    } catch (error) {
      console.error('Error fetching price:', error);
      return this.currentPrice || 0;
    }
  }

  async startTrading(config) {
    if (this.isRunning && !this.isPaused) {
      console.log('Trading already running');
      return;
    }

    console.log('Starting trading with config:', config);
    
    this.strategy = config.strategy;
    this.isRunning = true;
    this.isPaused = false;
    this.startTime = this.startTime || Date.now();
    
    if (config.reset) {
      this.resetState();
    }

    await this.fetchCurrentPrice();
    
    if (this.chartData.initialTradingPrice === 0) {
      this.chartData.initialTradingPrice = this.currentPrice;
      this.chartData.initialRecentHigh = this.currentPrice;
      this.chartData.recentHigh = this.currentPrice;
      this.chartData.recentLow = this.currentPrice;
    }

    this.priceUpdateInterval = setInterval(async () => {
      await this.fetchCurrentPrice();
      this.updateChartData();
      this.broadcast({
        type: 'priceUpdate',
        price: this.currentPrice,
        chartData: this.chartData
      });
    }, 5000);

    this.tradingInterval = setInterval(() => {
      if (!this.isPaused) {
        this.executeTradingLogic();
      }
    }, 1000);

    this.broadcast({
      type: 'tradingStarted',
      status: this.getStatus()
    });

    this.saveState();
  }

  stopTrading() {
    console.log('Stopping trading');
    this.isRunning = false;
    this.isPaused = false;
    
    if (this.tradingInterval) {
      clearInterval(this.tradingInterval);
      this.tradingInterval = null;
    }
    
    if (this.priceUpdateInterval) {
      clearInterval(this.priceUpdateInterval);
      this.priceUpdateInterval = null;
    }

    this.broadcast({
      type: 'tradingStopped',
      status: this.getStatus()
    });

    this.saveState();
  }

  pauseTrading() {
    console.log('Pausing trading');
    this.isPaused = true;
    
    this.broadcast({
      type: 'tradingPaused',
      status: this.getStatus()
    });

    this.saveState();
  }

  resumeTrading() {
    console.log('Resuming trading');
    this.isPaused = false;
    
    this.broadcast({
      type: 'tradingResumed',
      status: this.getStatus()
    });

    this.saveState();
  }

  updateStrategy(strategy) {
    console.log('Updating strategy:', strategy);
    this.strategy = strategy;
    
    this.broadcast({
      type: 'strategyUpdated',
      strategy: this.strategy
    });

    this.saveState();
  }

  updateChartData() {
    const recentPrices = this.priceHistory.slice(-20).map(p => p.price);
    
    if (recentPrices.length > 0) {
      this.chartData.recentHigh = Math.max(...recentPrices);
      this.chartData.recentLow = Math.min(...recentPrices);
    }

    if (this.currentPrice > this.chartData.initialRecentHigh) {
      this.chartData.initialTradingAngle = 
        ((this.currentPrice - this.chartData.initialTradingPrice) / 
         this.chartData.initialTradingPrice) * 100;
    }
  }

  executeTradingLogic() {
    if (!this.strategy || !this.currentPrice) return;

    const tradeAmount = this.calculateTradeAmount();
    const shouldBuy = this.shouldBuy();
    const shouldSell = this.shouldSell();

    if (shouldBuy && this.balance.usd >= tradeAmount) {
      this.executeBuy(tradeAmount);
    } else if (shouldSell && this.balance.btc > 0) {
      this.executeSell();
    }

    this.lastUpdateTime = Date.now();
    this.saveState();
  }

  calculateTradeAmount() {
    const percentage = this.strategy.tradePercentage || 10;
    return (this.balance.usd * percentage) / 100;
  }

  shouldBuy() {
    if (!this.strategy || this.positions.length > 0) return false;

    const priceDropThreshold = this.strategy.buyThreshold || -0.5;
    const priceChangePercent = ((this.currentPrice - this.chartData.recentHigh) / 
                                this.chartData.recentHigh) * 100;

    return priceChangePercent <= priceDropThreshold;
  }

  shouldSell() {
    if (!this.strategy || this.positions.length === 0) return false;

    const position = this.positions[0];
    const profitPercent = ((this.currentPrice - position.entryPrice) / 
                           position.entryPrice) * 100;

    return profitPercent >= (this.strategy.sellThreshold || 0.5);
  }

  executeBuy(amount) {
    const btcAmount = amount / this.currentPrice;
    
    this.balance.usd -= amount;
    this.balance.btc += btcAmount;

    const position = {
      id: Date.now(),
      type: 'buy',
      entryPrice: this.currentPrice,
      amount: btcAmount,
      usdValue: amount,
      timestamp: Date.now()
    };

    this.positions.push(position);
    this.trades.push(position);
    this.chartData.lastTradeTime = Date.now();

    console.log('Executed buy:', position);

    this.broadcast({
      type: 'trade',
      trade: position,
      status: this.getStatus()
    });
  }

  executeSell() {
    const position = this.positions[0];
    const usdAmount = this.balance.btc * this.currentPrice;
    
    this.balance.btc = 0;
    this.balance.usd += usdAmount;

    const trade = {
      id: Date.now(),
      type: 'sell',
      exitPrice: this.currentPrice,
      amount: position.amount,
      usdValue: usdAmount,
      profit: usdAmount - position.usdValue,
      profitPercent: ((usdAmount - position.usdValue) / position.usdValue) * 100,
      timestamp: Date.now()
    };

    this.positions = [];
    this.trades.push(trade);
    this.chartData.lastTradeTime = Date.now();

    console.log('Executed sell:', trade);

    this.broadcast({
      type: 'trade',
      trade: trade,
      status: this.getStatus()
    });
  }

  getStatus() {
    const totalValue = this.balance.usd + (this.balance.btc * this.currentPrice);
    const profitLoss = totalValue - 10000;
    const profitLossPercent = (profitLoss / 10000) * 100;

    return {
      isRunning: this.isRunning,
      isPaused: this.isPaused,
      strategy: this.strategy,
      balance: this.balance,
      positions: this.positions,
      trades: this.trades,
      currentPrice: this.currentPrice,
      totalValue,
      profitLoss,
      profitLossPercent,
      startTime: this.startTime,
      lastUpdateTime: this.lastUpdateTime,
      chartData: this.chartData,
      tradesCount: this.trades.length,
      openPositions: this.positions.length
    };
  }

  resetState() {
    this.positions = [];
    this.trades = [];
    this.balance = {
      usd: 10000,
      btc: 0
    };
    this.startTime = Date.now();
    this.chartData = {
      recentHigh: this.currentPrice,
      recentLow: this.currentPrice,
      initialTradingPrice: this.currentPrice,
      initialRecentHigh: this.currentPrice,
      initialTradingAngle: 0,
      lastTradeTime: 0
    };
  }

  saveState() {
    const state = {
      isRunning: this.isRunning,
      isPaused: this.isPaused,
      strategy: this.strategy,
      balance: this.balance,
      positions: this.positions,
      trades: this.trades,
      startTime: this.startTime,
      lastUpdateTime: this.lastUpdateTime,
      chartData: this.chartData,
      currentPrice: this.currentPrice,
      priceHistory: this.priceHistory.slice(-100)
    };

    global.tradingState = state;
  }

  loadState() {
    if (global.tradingState) {
      const state = global.tradingState;
      
      this.isRunning = state.isRunning || false;
      this.isPaused = state.isPaused || false;
      this.strategy = state.strategy || null;
      this.balance = state.balance || { usd: 10000, btc: 0 };
      this.positions = state.positions || [];
      this.trades = state.trades || [];
      this.startTime = state.startTime || null;
      this.lastUpdateTime = state.lastUpdateTime || null;
      this.chartData = state.chartData || {
        recentHigh: 0,
        recentLow: 0,
        initialTradingPrice: 0,
        initialRecentHigh: 0,
        initialTradingAngle: 0,
        lastTradeTime: 0
      };
      this.currentPrice = state.currentPrice || 0;
      this.priceHistory = state.priceHistory || [];

      console.log('Loaded trading state:', {
        isRunning: this.isRunning,
        isPaused: this.isPaused,
        tradesCount: this.trades.length,
        positionsCount: this.positions.length
      });

      if (this.isRunning) {
        console.log('Resuming trading from saved state');
        this.startTrading({ strategy: this.strategy, reset: false });
      }
    }
  }

  cleanup() {
    this.stopTrading();
    this.removeAllListeners();
    this.clients.clear();
  }
}