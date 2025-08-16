import axios from 'axios';
import { EventEmitter } from 'events';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Simplified strategy implementations
class ReverseRatioStrategy {
  constructor(config) {
    // Ensure we use the correct defaults for Micro-Scalping
    this.config = {
      initialDropPercent: 0.1,     // 0.1% drop triggers entry
      levelDropPercent: 0.1,       // 0.1% between levels
      profitTarget: 0.85,          // 0.85% profit target
      maxLevels: 12,               // Up to 12 levels
      basePositionPercent: 6,      // 6% of balance for first level
      ...config
    };
    this.positions = [];
    this.recentHigh = 0;
  }

  analyze(candles, currentPrice) {
    // Update recent high
    const recentCandles = candles.slice(-20);
    if (recentCandles.length > 0) {
      const prevHigh = this.recentHigh;
      this.recentHigh = Math.max(...recentCandles.map(c => c.high), this.recentHigh);
      if (this.recentHigh > prevHigh) {
        // Only log significant high changes (more than 1%)
        if ((this.recentHigh - prevHigh) / prevHigh > 0.01) {
          console.log('New recent high:', this.recentHigh);
        }
      }
    } else if (this.recentHigh === 0) {
      // Initialize with current price if no candles yet
      this.recentHigh = currentPrice;
      // console.log('Initialized recent high with current price:', this.recentHigh);
    }

    // Check for sell signal
    if (this.positions.length > 0) {
      const avgEntryPrice = this.positions.reduce((sum, p) => sum + p.entryPrice * p.size, 0) / 
                           this.positions.reduce((sum, p) => sum + p.size, 0);
      const profitPercent = ((currentPrice - avgEntryPrice) / avgEntryPrice) * 100;
      
      if (profitPercent >= this.config.profitTarget) {
        return { type: 'sell', reason: `Target profit ${this.config.profitTarget}% reached` };
      }
    }

    // Check for buy signal
    const dropFromHigh = ((this.recentHigh - currentPrice) / this.recentHigh) * 100;
    const currentLevel = this.positions.length + 1;
    
    if (currentLevel <= this.config.maxLevels) {
      const requiredDrop = this.config.initialDropPercent + 
                          (currentLevel - 1) * this.config.levelDropPercent;
      
      // Only log when very close to trigger (within 0.05%)
      if (Math.abs(dropFromHigh - requiredDrop) < 0.05) {
        console.log(`Buy trigger approaching: ${dropFromHigh.toFixed(3)}% / ${requiredDrop.toFixed(3)}%`);
      }
      
      if (dropFromHigh >= requiredDrop) {
        return { 
          type: 'buy', 
          reason: `Drop level ${currentLevel} reached: ${dropFromHigh.toFixed(2)}%`,
          metadata: { level: currentLevel }
        };
      }
    }

    return { type: 'hold' };
  }

  calculatePositionSize(totalBalance, signal, currentPrice) {
    const level = signal.metadata?.level || 1;
    const baseAmount = totalBalance * (this.config.basePositionPercent / 100);
    const multiplier = Math.pow(1.5, level - 1); // Increase size with each level
    return (baseAmount * multiplier) / currentPrice;
  }

  addPosition(position) {
    this.positions.push(position);
  }

  removePosition(position) {
    this.positions = this.positions.filter(p => p !== position);
  }

  getPositions() {
    return this.positions;
  }
}

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
    this.candles = [];
    this.currentCandle = null;
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
    this.strategyConfig = null;
    
    // Map strategy types to classes
    this.strategyMap = {
      'reverse-ratio': ReverseRatioStrategy,
      'ultra-micro-scalping': ReverseRatioStrategy, // Use same for now
      // Add other strategies as needed
    };

    // Load state asynchronously
    this.loadState().catch(error => {
      console.error('Failed to load initial state:', error);
    });
  }
  
  extractStrategyType(strategyName) {
    const nameToType = {
      'Reverse Ratio Buying': 'reverse-ratio',
      'Ultra Micro-Scalping': 'ultra-micro-scalping'
    };
    
    return nameToType[strategyName] || strategyName.toLowerCase().replace(/\s+/g, '-');
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
      
      // Update or create current candle
      this.updateCandles(price);
      
      return price;
    } catch (error) {
      console.error('Error fetching price:', error);
      return this.currentPrice || 0;
    }
  }
  
  updateCandles(price) {
    const now = Date.now();
    const currentMinute = Math.floor(now / 60000) * 60000;
    
    if (!this.currentCandle || this.currentCandle.time < currentMinute / 1000) {
      // Close previous candle and start new one
      if (this.currentCandle) {
        this.candles.push(this.currentCandle);
        // Only log every 10th candle to reduce spam
        if (this.candles.length % 10 === 0) {
          console.log(`Candle update: ${this.candles.length} candles`);
        }
        
        // Keep only last 500 candles
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
      // Update current candle
      this.currentCandle.high = Math.max(this.currentCandle.high, price);
      this.currentCandle.low = Math.min(this.currentCandle.low, price);
      this.currentCandle.close = price;
    }
  }

  async startTrading(config) {
    if (this.isRunning && !this.isPaused) {
      console.log('Trading already running');
      return;
    }

    console.log('Starting trading');
    
    // Parse strategy configuration
    let strategyType;
    let strategyParams;
    
    // Priority 1: Direct strategyType and strategyConfig (preferred format)
    if (config.strategyType && config.strategyConfig) {
      strategyType = config.strategyType;
      strategyParams = config.strategyConfig;
      // console.log('Using direct strategy format:', strategyType, 'with config:', strategyParams);
    }
    // Priority 2: Strategy object format
    else if (config.strategy) {
      // Handle format from frontend
      if (config.strategy.strategyType) {
        // New format with explicit type
        strategyType = config.strategy.strategyType;
        strategyParams = config.strategy.strategyConfig || config.strategy.config || {};
        // console.log('Using strategy object format:', strategyType, 'with config:', strategyParams);
      } else {
        // Legacy format
        strategyType = this.extractStrategyType(config.strategy.getName ? config.strategy.getName() : 'reverse-ratio');
        strategyParams = config.strategy.config || {};
        // console.log('Using legacy format:', strategyType, 'with config:', strategyParams);
      }
    } else {
      console.error('Invalid strategy configuration');
      return;
    }
    
    // Create strategy instance
    const StrategyClass = this.strategyMap[strategyType];
    if (!StrategyClass) {
      console.error(`Unknown strategy type: ${strategyType}, using reverse-ratio as default`);
      strategyType = 'reverse-ratio';
    }
    
    try {
      const StrategyToUse = this.strategyMap[strategyType];
      this.strategy = new StrategyToUse(strategyParams);
      console.log(`Created ${strategyType} strategy`);
    } catch (error) {
      console.error('Failed to create strategy:', error);
      return;
    }
    
    this.strategyConfig = config;
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
    
    // Create initial candle to jumpstart trading if we don't have one
    if (this.currentPrice && !this.currentCandle && this.candles.length === 0) {
      const now = Date.now();
      const currentMinute = Math.floor(now / 60000) * 60000;
      this.currentCandle = {
        time: currentMinute / 1000,
        open: this.currentPrice,
        high: this.currentPrice,
        low: this.currentPrice,
        close: this.currentPrice,
        volume: 0
      };
      // console.log('Created initial candle to jumpstart trading:', this.currentCandle);
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

    this.saveState().catch(error => {
      console.error('Failed to save state:', error);
    });
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
    
    // Clear strategy to prevent any lingering analysis
    this.strategy = null;

    this.broadcast({
      type: 'tradingStopped',
      status: this.getStatus()
    });

    this.saveState().catch(error => {
      console.error('Failed to save state:', error);
    });
  }

  pauseTrading() {
    console.log('Pausing trading');
    this.isPaused = true;
    
    this.broadcast({
      type: 'tradingPaused',
      status: this.getStatus()
    });

    this.saveState().catch(error => {
      console.error('Failed to save state:', error);
    });
  }

  resumeTrading() {
    console.log('Resuming trading');
    this.isPaused = false;

    this.broadcast({
      type: 'tradingResumed',
      status: this.getStatus()
    });

    this.saveState().catch(error => {
      console.error('Failed to save state:', error);
    });
  }

  updateStrategy(config) {
    console.log('Updating strategy:', config);
    this.strategyConfig = config;
    
    // Parse strategy configuration using same logic as startTrading
    let strategyType;
    let strategyParams;
    
    // Priority 1: Direct strategyType and strategyConfig (preferred format)
    if (config.strategyType && config.strategyConfig) {
      strategyType = config.strategyType;
      strategyParams = config.strategyConfig;
      console.log('Updating with direct strategy format:', strategyType, 'with config:', strategyParams);
    }
    // Priority 2: Strategy object format
    else if (config.strategy) {
      if (config.strategy.strategyType) {
        strategyType = config.strategy.strategyType;
        strategyParams = config.strategy.strategyConfig || config.strategy.config || {};
      } else {
        strategyType = this.extractStrategyType(config.strategy.getName ? config.strategy.getName() : 'reverse-ratio');
        strategyParams = config.strategy.config || {};
      }
    } else {
      strategyType = 'reverse-ratio';
      strategyParams = {};
    }
    
    const StrategyClass = this.strategyMap[strategyType] || this.strategyMap['reverse-ratio'];
    this.strategy = new StrategyClass(strategyParams);
    console.log(`Updated to ${strategyType} strategy with params:`, strategyParams);
    
    this.broadcast({
      type: 'strategyUpdated',
      status: this.getStatus()
    });
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
    if (!this.strategy || !this.currentPrice) {
      // Only log on first occurrence
      if (!this._loggedMissingStrategy) {
        console.log('Trading logic check:', {
          hasStrategy: !!this.strategy,
          currentPrice: this.currentPrice,
          candleCount: this.candles.length
        });
        this._loggedMissingStrategy = true;
      }
      return;
    }
    this._loggedMissingStrategy = false;

    // Get candles for strategy analysis
    const candlesForAnalysis = [...this.candles];
    if (this.currentCandle) {
      candlesForAnalysis.push(this.currentCandle);
    }

    // Get signal from strategy
    const signal = this.strategy.analyze(candlesForAnalysis, this.currentPrice);
    
    // Only log if we have a buy/sell signal or every 100 executions
    if (!this._executionCounter) this._executionCounter = 0;
    this._executionCounter++;
    
    // Only log buy/sell signals, not holds
    if (signal.type !== 'hold') {
      console.log(`${signal.type.toUpperCase()}: ${signal.reason}`);
    }
    
    if (signal.type === 'buy') {
      this.processBuySignal(signal).catch(error => {
        console.error('Error processing buy signal:', error);
      });
    } else if (signal.type === 'sell') {
      this.processSellSignal(signal).catch(error => {
        console.error('Error processing sell signal:', error);
      });
    }

    this.lastUpdateTime = Date.now();
    this.saveState().catch(error => {
      console.error('Failed to save state after trading logic:', error);
    });
  }

  async processBuySignal(signal) {
    if (!this.strategy) return;
    
    // Calculate position size using strategy's method
    const totalAvailable = this.balance.usd;
    const positionSize = this.strategy.calculatePositionSize(totalAvailable, signal, this.currentPrice);
    
    // Removed verbose buy signal logging
    
    if (positionSize <= 0) {
      // console.log('Position size too small or no funds available');
      return;
    }
    
    const cost = positionSize * this.currentPrice;
    const fee = cost * 0.001; // 0.1% fee
    const totalCost = cost + fee;
    
    if (totalCost > this.balance.usd) {
      // console.log('Insufficient funds for trade:', { totalCost, availableUSD: this.balance.usd });
      return;
    }
    
    // Execute buy
    this.balance.usd -= totalCost;
    this.balance.btc += positionSize;
    
    const position = {
      id: Date.now(),
      type: 'buy',
      entryPrice: this.currentPrice,
      size: positionSize,
      usdValue: cost,
      timestamp: Math.floor(Date.now() / 1000)
    };
    
    this.positions.push(position);
    this.trades.push({
      ...position,
      price: this.currentPrice,
      value: cost,
      fee: fee,
      side: 'buy',
      reason: signal.reason || 'Strategy signal'
    });
    
    // Update strategy state
    if (this.strategy.addPosition) {
      this.strategy.addPosition({
        entryPrice: this.currentPrice,
        entryTime: Date.now() / 1000,
        size: positionSize,
        type: 'long',
        metadata: signal.metadata
      });
    }
    
    console.log(`BUY executed at $${this.currentPrice.toFixed(2)}`);
    this.broadcast({
      type: 'trade',
      trade: this.trades[this.trades.length - 1], // Send the trade object, not the position
      status: this.getStatus()
    });
    
    // Save state after trade
    await this.saveState();
  }

  async processSellSignal(signal) {
    if (!this.strategy || this.positions.length === 0) return;
    
    const size = signal.size || this.balance.btc;
    if (size <= 0 || size > this.balance.btc) {
      console.log('Invalid sell size');
      return;
    }
    
    const proceeds = size * this.currentPrice;
    const fee = proceeds * 0.001; // 0.1% fee
    const netProceeds = proceeds - fee;
    
    // Calculate profit
    let totalCost = 0;
    let remainingSize = size;
    const closedPositions = [];
    
    for (const position of this.positions) {
      if (remainingSize <= 0) break;
      
      const closeSize = Math.min(remainingSize, position.size);
      totalCost += closeSize * position.entryPrice;
      remainingSize -= closeSize;
      
      if (closeSize === position.size) {
        closedPositions.push(position);
      }
    }
    
    const profit = netProceeds - totalCost;
    const profitPercent = (profit / totalCost) * 100;
    
    // Execute sell
    this.balance.btc -= size;
    this.balance.usd += netProceeds;
    
    // Remove closed positions
    this.positions = this.positions.filter(p => !closedPositions.includes(p));
    
    const trade = {
      id: Date.now(),
      type: 'sell',
      side: 'sell',
      price: this.currentPrice,
      exitPrice: this.currentPrice,
      size: size,
      value: proceeds,
      usdValue: proceeds,
      profit: profit,
      profitPercent: profitPercent,
      fee: fee,
      timestamp: Math.floor(Date.now() / 1000),
      reason: signal.reason || 'Strategy signal'
    };
    
    this.trades.push(trade);
    
    // Update strategy state
    if (this.strategy.removePosition) {
      closedPositions.forEach(p => {
        if (this.strategy && this.strategy.removePosition) {
          this.strategy.removePosition(p);
        }
      });
    }
    
    console.log(`SELL executed at $${this.currentPrice.toFixed(2)}, profit: ${profit >= 0 ? '+' : ''}$${profit.toFixed(2)}`);
    this.broadcast({
      type: 'trade',
      trade: trade,
      status: this.getStatus()
    });
    
    // Save state after trade
    await this.saveState();
  }

  getStatus() {
    const totalValue = this.balance.usd + (this.balance.btc * this.currentPrice);
    const profitLoss = totalValue - 10000;
    const profitLossPercent = (profitLoss / 10000) * 100;

    // Calculate next buy price
    let nextBuyPrice = null;
    let nextBuyLevel = null;
    if (this.strategy && this.strategy.recentHigh > 0) {
      const currentLevel = this.positions.length + 1;
      const requiredDrop = this.strategy.config.initialDropPercent + 
                          (currentLevel - 1) * this.strategy.config.levelDropPercent;
      nextBuyPrice = this.strategy.recentHigh * (1 - requiredDrop / 100);
      nextBuyLevel = currentLevel;
    }

    // Calculate next sell price (based on lowest entry price)
    let nextSellPrice = null;
    let lowestEntryPrice = null;
    let avgEntryPrice = null;
    if (this.positions.length > 0 && this.strategy) {
      // Find lowest entry price
      lowestEntryPrice = Math.min(...this.positions.map(p => p.entryPrice));
      
      // Calculate average entry price
      avgEntryPrice = this.positions.reduce((sum, p) => sum + p.entryPrice * p.size, 0) / 
                      this.positions.reduce((sum, p) => sum + p.size, 0);
      
      // Next sell price based on average (this is what actually triggers)
      nextSellPrice = avgEntryPrice * (1 + this.strategy.config.profitTarget / 100);
    }

    return {
      isRunning: this.isRunning,
      isPaused: this.isPaused,
      strategy: this.strategyConfig,
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
      openPositions: this.positions.length,
      nextBuyPrice,
      nextBuyLevel,
      nextSellPrice,
      lowestEntryPrice,
      avgEntryPrice
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
    this.chartData.lastTradeTime = 0;
  }

  async loadState() {
    try {
      // Create data directory if it doesn't exist
      const dataDir = path.join(__dirname, '../../data');
      await fs.mkdir(dataDir, { recursive: true });
      
      // Use botId for unique state files
      const filename = this.botId ? `trading-state-${this.botId}.json` : 'trading-state.json';
      const stateFile = path.join(dataDir, filename);
      
      try {
        const data = await fs.readFile(stateFile, 'utf8');
        
        // Check if file has content
        if (!data || data.trim() === '') {
          console.log('State file is empty, using defaults');
          return;
        }
        
        const state = JSON.parse(data);
        
        // Restore state
        this.trades = state.trades || [];
        this.positions = state.positions || [];
        this.balance = state.balance || { usd: 10000, btc: 0 };
        this.chartData = state.chartData || {
          recentHigh: 0,
          recentLow: 0,
          initialTradingPrice: 0,
          initialRecentHigh: 0,
          initialTradingAngle: 0,
          lastTradeTime: 0
        };
        this.startTime = state.startTime || null;
        this.lastUpdateTime = state.lastUpdateTime || null;
        this.strategyConfig = state.strategyConfig || null;
        
        // Restore strategy if it was configured
        if (state.strategyType && state.strategyParams) {
          const StrategyClass = this.strategyMap[state.strategyType];
          if (StrategyClass) {
            this.strategy = new StrategyClass(state.strategyParams);
            // Restore strategy-specific state
            if (state.strategyState) {
              this.strategy.positions = state.strategyState.positions || [];
              this.strategy.recentHigh = state.strategyState.recentHigh || 0;
            }
          }
        }
        
        // Restore candles
        this.candles = state.candles || [];
        this.currentCandle = state.currentCandle || null;
        
        // Restore price history (keep only recent entries)
        this.priceHistory = state.priceHistory || [];
        if (this.priceHistory.length > 1000) {
          this.priceHistory = this.priceHistory.slice(-500);
        }
        
        // Check saved running state but DO NOT auto-resume
        const wasRunning = state.isRunning || false;
        const wasPaused = state.isPaused || false;
        
        // Only log successful loads for debugging
        // console.log('Trading state loaded successfully');
        
        // Do NOT auto-resume trading - user must manually start
        // This prevents unexpected trading continuation after stops
        if (wasRunning) {
          console.log('Previous trading session was running but NOT auto-resuming');
          // Reset running state to prevent confusion
          this.isRunning = false;
          this.isPaused = false;
        }
      } catch (error) {
        if (error.code === 'ENOENT') {
          // Expected for new bots, don't log
        } else {
          console.error(`Error reading state file for bot ${this.botId}:`, error.message);
        }
      }
    } catch (error) {
      console.error('Error loading state:', error);
    }
  }

  async saveState() {
    try {
      // Create data directory if it doesn't exist
      const dataDir = path.join(__dirname, '../../data');
      await fs.mkdir(dataDir, { recursive: true });
      
      // Use botId for unique state files
      const filename = this.botId ? `trading-state-${this.botId}.json` : 'trading-state.json';
      const stateFile = path.join(dataDir, filename);
      
      // Prepare state object
      const state = {
        trades: this.trades,
        positions: this.positions,
        balance: this.balance,
        chartData: this.chartData,
        startTime: this.startTime,
        lastUpdateTime: this.lastUpdateTime,
        strategyConfig: this.strategyConfig,
        candles: this.candles,
        currentCandle: this.currentCandle,
        priceHistory: this.priceHistory.slice(-100), // Keep only recent 100 entries
        isRunning: this.isRunning,
        isPaused: this.isPaused,
        savedAt: Date.now()
      };
      
      // Save strategy-specific information
      if (this.strategy) {
        // Determine strategy type
        let strategyType = 'reverse-ratio'; // default
        for (const [type, StrategyClass] of Object.entries(this.strategyMap)) {
          if (this.strategy.constructor === StrategyClass) {
            strategyType = type;
            break;
          }
        }
        
        state.strategyType = strategyType;
        state.strategyParams = this.strategy.config || {};
        
        // Save strategy-specific state
        state.strategyState = {
          positions: this.strategy.positions || [],
          recentHigh: this.strategy.recentHigh || 0
        };
      }
      
      // Write state to file
      await fs.writeFile(stateFile, JSON.stringify(state, null, 2));
      
      // Also create a backup with timestamp
      const backupDir = path.join(dataDir, 'backups');
      await fs.mkdir(backupDir, { recursive: true });
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFile = path.join(backupDir, `trading-state-${timestamp}.json`);
      await fs.writeFile(backupFile, JSON.stringify(state, null, 2));
      
      // Clean up old backups (keep only last 10)
      const backups = await fs.readdir(backupDir);
      const sortedBackups = backups
        .filter(f => f.startsWith('trading-state-') && f.endsWith('.json'))
        .sort()
        .reverse();
      
      if (sortedBackups.length > 10) {
        for (const oldBackup of sortedBackups.slice(10)) {
          await fs.unlink(path.join(backupDir, oldBackup)).catch(() => {});
        }
      }
      
      console.log('Trading state saved successfully');
    } catch (error) {
      console.error('Error saving state:', error);
    }
  }

  cleanup() {
    this.stopTrading();
    this.removeAllListeners();
    this.clients.clear();
  }
}