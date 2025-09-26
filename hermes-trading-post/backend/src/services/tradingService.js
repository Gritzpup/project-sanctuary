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
      console.log('Initialized recent high with current price:', this.recentHigh);
    }
    
    // If we still have no recent high, use current price as starting point
    if (this.recentHigh === 0 || !this.recentHigh) {
      this.recentHigh = currentPrice;
      console.log('Strategy: No recent high found, using current price:', currentPrice);
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
    
    // Special handling for initial position - be VERY aggressive
    if (this.positions.length === 0) {
      console.log(`Initial position check: recentHigh=${this.recentHigh}, currentPrice=${currentPrice}, drop=${dropFromHigh.toFixed(3)}%, candles=${candles.length}`);
      
      // For the first position, open immediately or on ANY drop
      // This ensures the strategy can start working
      if (candles.length <= 5) {
        // Within first 5 candles, open immediately
        console.log(`INITIAL BUY SIGNAL: Opening first position immediately at ${currentPrice} (startup phase)`);
        return { 
          type: 'buy', 
          reason: `Opening initial position immediately (startup)`,
          metadata: { level: 1 }
        };
      } else if (dropFromHigh >= 0.01) {
        // After startup, trigger on tiny 0.01% drop
        console.log(`INITIAL BUY SIGNAL: Opening first position at ${currentPrice}, drop: ${dropFromHigh.toFixed(2)}%`);
        return { 
          type: 'buy', 
          reason: `Opening initial position (drop: ${dropFromHigh.toFixed(2)}%)`,
          metadata: { level: 1 }
        };
      }
    }
    
    if (currentLevel <= this.config.maxLevels) {
      const requiredDrop = this.config.initialDropPercent + 
                          (currentLevel - 1) * this.config.levelDropPercent;
      
      // Debug logging for buy levels
      if (this.positions.length > 0 && !this._lastLoggedLevel) {
        this._lastLoggedLevel = 0;
      }
      if (this.positions.length !== this._lastLoggedLevel) {
        console.log(`Strategy state: ${this.positions.length} positions, Level ${currentLevel}, Required drop: ${requiredDrop.toFixed(2)}%, Current drop: ${dropFromHigh.toFixed(2)}%`);
        this._lastLoggedLevel = this.positions.length;
      }
      
      // Only log when very close to trigger (within 0.05%)
      if (Math.abs(dropFromHigh - requiredDrop) < 0.05) {
        console.log(`Buy trigger approaching: ${dropFromHigh.toFixed(3)}% / ${requiredDrop.toFixed(3)}%`);
      }
      
      if (dropFromHigh >= requiredDrop) {
        console.log(`BUY SIGNAL: Level ${currentLevel}, Drop ${dropFromHigh.toFixed(2)}% >= Required ${requiredDrop.toFixed(2)}%`);
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
    console.log(`Strategy: Added position #${this.positions.length} at price $${position.entryPrice.toFixed(2)}`);
  }

  removePosition(position) {
    this.positions = this.positions.filter(p => p !== position);
  }
  
  clearAllPositions() {
    const count = this.positions.length;
    this.positions = [];
    console.log(`Strategy: Cleared all ${count} positions`);
  }
  
  restorePositions(positions) {
    this.positions = positions;
    console.log(`Strategy: Restored ${this.positions.length} positions`);
  }

  getPositions() {
    return this.positions;
  }
}

// Track all active bot instances to prevent recreation
const activeBotInstances = new Map();

export class TradingService extends EventEmitter {
  constructor(botId = null) {
    super();
    
    // Check if this bot already exists and is running
    if (botId && activeBotInstances.has(botId)) {
      console.warn(`WARNING: Bot ${botId} already exists and may be running! Preventing duplicate.`);
    }
    
    this.botId = botId; // Set botId first so loadState can use it
    
    // Register this instance
    if (botId) {
      activeBotInstances.set(botId, this);
    }
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
      'micro-scalping': ReverseRatioStrategy, // Use same strategy class
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
        // if (this.candles.length % 10 === 0) {
        //   console.log(`Candle update: ${this.candles.length} candles`);
        // }
        
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
    console.log('TradingService.startTrading called:', {
      isRunning: this.isRunning,
      isPaused: this.isPaused,
      hasInterval: !!this.tradingInterval,
      hasStrategy: !!this.strategy,
      balance: this.balance,
      config
    });
    
    // Check if we have an active trading interval
    if (this.tradingInterval && this.isRunning && !this.isPaused) {
      console.log('Trading already running with interval - broadcasting status');
      // Broadcast current status to sync frontend
      this.broadcast({
        type: 'tradingStarted',
        status: this.getStatus()
      });
      return;
    }
    
    if (this.isRunning && !this.isPaused && !this.tradingInterval) {
      console.log('Trading marked as running but no interval - will create interval');
    }

    console.log('Starting trading');
    console.log('Received config structure:', JSON.stringify(config, null, 2));
    
    // Check if reset flag is set (could be nested in config)
    const shouldReset = config.reset || (config.config && config.config.reset);
    
    // Preserve existing trades and state if not resetting
    const preserveState = !shouldReset && this.trades && this.trades.length > 0;
    const existingTrades = preserveState ? [...this.trades] : [];
    const existingPositions = preserveState ? [...this.positions] : [];
    const existingBalance = preserveState ? { ...this.balance } : { usd: 10000, btc: 0 };
    
    console.log(`Preserving state: ${preserveState}, existing trades: ${existingTrades.length}`);
    
    // Parse strategy configuration
    let strategyType;
    let strategyParams;
    
    // Handle nested config structure from frontend
    const actualConfig = config.strategy || config;
    
    // Priority 1: Direct strategyType and strategyConfig (preferred format)
    if (actualConfig.strategyType && actualConfig.strategyConfig) {
      strategyType = actualConfig.strategyType;
      strategyParams = actualConfig.strategyConfig;
      // console.log('Using direct strategy format:', strategyType, 'with config:', strategyParams);
    }
    // Priority 2: Strategy object format
    else if (actualConfig.strategy) {
      // Handle format from frontend
      if (actualConfig.strategy.strategyType) {
        // New format with explicit type
        strategyType = actualConfig.strategy.strategyType;
        strategyParams = actualConfig.strategy.strategyConfig || actualConfig.strategy.config || {};
        // console.log('Using strategy object format:', strategyType, 'with config:', strategyParams);
      } else {
        // Legacy format
        strategyType = this.extractStrategyType(actualConfig.strategy.getName ? actualConfig.strategy.getName() : 'reverse-ratio');
        strategyParams = actualConfig.strategy.config || {};
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
    
    // Save only the essential config for restart
    this.strategyConfig = {
      strategyType,
      strategyConfig: strategyParams
    };
    this.isRunning = true;
    this.isPaused = false;
    this.startTime = this.startTime || Date.now();
    
    console.log(`Bot ${this.botId} marked as running, strategy: ${strategyType}`);
    
    if (shouldReset) {
      this.resetState();
    } else if (preserveState) {
      // Restore preserved state
      this.trades = existingTrades;
      this.positions = existingPositions;
      this.balance = existingBalance;
      
      // Sync strategy positions if strategy has positions
      if (this.strategy && existingPositions.length > 0) {
        const strategyPositions = existingPositions.map(pos => ({
          entryPrice: pos.entryPrice,
          entryTime: pos.timestamp || pos.entryTime,
          size: pos.size,
          type: pos.type || 'long',
          id: pos.id,
          usdValue: pos.usdValue
        }));
        
        if (this.strategy.restorePositions) {
          this.strategy.restorePositions(strategyPositions);
        } else {
          this.strategy.positions = strategyPositions;
        }
        
        console.log(`Restored ${existingTrades.length} trades and ${existingPositions.length} positions to strategy`);
      }
    }

    // No need to fetch price - we get it from WebSocket now
    console.log('Current price at start:', this.currentPrice);
    
    if (this.chartData.initialTradingPrice === 0 && this.currentPrice > 0) {
      this.chartData.initialTradingPrice = this.currentPrice;
      this.chartData.initialRecentHigh = this.currentPrice;
      this.chartData.recentHigh = this.currentPrice;
      this.chartData.recentLow = this.currentPrice;
    }
    
    // Create initial candle to jumpstart trading if we don't have one
    if (this.currentPrice && this.currentPrice > 0) {
      if (!this.currentCandle && this.candles.length === 0) {
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
        console.log('Created initial candle to jumpstart trading:', this.currentCandle);
      }
      
      // Also initialize chart data if needed
      if (this.chartData.initialTradingPrice === 0) {
        this.chartData.initialTradingPrice = this.currentPrice;
        this.chartData.initialRecentHigh = this.currentPrice;
        this.chartData.recentHigh = this.currentPrice;
        this.chartData.recentLow = this.currentPrice;
      }
    }

    // Disable HTTP polling since we now use WebSocket real-time prices
    // this.priceUpdateInterval = setInterval(async () => {
    //   await this.fetchCurrentPrice();
    //   this.updateChartData();
    //   this.broadcast({
    //     type: 'priceUpdate',
    //     price: this.currentPrice,
    //     chartData: this.chartData
    //   });
    // }, 5000);

    // Wait for price if we don't have one yet
    if (!this.currentPrice || this.currentPrice === 0) {
      console.log('WARNING: No price available yet, waiting for WebSocket price...');
      
      // Clear any existing price wait interval to prevent leaks
      if (this.waitForPriceInterval) {
        clearInterval(this.waitForPriceInterval);
        this.waitForPriceInterval = null;
      }
      
      // Set up a listener to start trading once we get a price with timeout
      let attempts = 0;
      const maxAttempts = 300; // 30 seconds timeout (300 * 100ms)
      
      this.waitForPriceInterval = setInterval(() => {
        attempts++;
        
        if (this.currentPrice > 0) {
          clearInterval(this.waitForPriceInterval);
          this.waitForPriceInterval = null;
          console.log('Price received, starting trading logic:', this.currentPrice);
          this.startTradingInterval();
        } else if (attempts >= maxAttempts) {
          clearInterval(this.waitForPriceInterval);
          this.waitForPriceInterval = null;
          console.error('Timeout waiting for price after 30 seconds, stopping trading attempt');
          this.stopTrading();
        }
      }, 100);
      return;
    }
    
    console.log('Starting trading interval with price:', this.currentPrice);
    this.startTradingInterval();
  }
  
  startTradingInterval() {
    // Prevent duplicate intervals
    if (this.tradingInterval) {
      console.log('WARNING: Trading interval already exists, not creating duplicate');
      return;
    }
    
    console.log('Starting trading interval with price:', this.currentPrice);
    
    // Initialize strategy's recent high if needed
    if (this.strategy && this.strategy.recentHigh === 0 && this.currentPrice > 0) {
      this.strategy.recentHigh = this.currentPrice;
      console.log('Initialized strategy recent high:', this.currentPrice);
    }
    
    // Create initial candle if we still don't have one
    if (this.currentPrice > 0 && this.candles.length === 0 && !this.currentCandle) {
      console.log('Creating initial candle');
      this.updateCandles(this.currentPrice);
    }
    
    // Initialize chart data if needed
    if (this.chartData.initialTradingPrice === 0 && this.currentPrice > 0) {
      this.chartData.initialTradingPrice = this.currentPrice;
      this.chartData.initialRecentHigh = this.currentPrice;
      this.chartData.recentHigh = this.currentPrice;
      this.chartData.recentLow = this.currentPrice;
    }
    
    // Execute first trading logic immediately
    console.log('Executing first trading logic check');
    this.executeTradingLogic();
    
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
    
    console.log(`Trading interval started successfully for bot ${this.botId}`);
    
    // Save state periodically while trading to ensure persistence
    if (!this.stateSaveInterval) {
      this.stateSaveInterval = setInterval(() => {
        if (this.isRunning && this.tradingInterval) {
          this.saveState().catch(error => {
            console.error('Failed to save state periodically:', error);
          });
        }
      }, 30000); // Save every 30 seconds
    }
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
    
    if (this.stateSaveInterval) {
      clearInterval(this.stateSaveInterval);
      this.stateSaveInterval = null;
    }
    
    if (this.waitForPriceInterval) {
      clearInterval(this.waitForPriceInterval);
      this.waitForPriceInterval = null;
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

  updateRealtimePrice(price, productId) {
    // First price update - always accept it
    if (this.currentPrice === 0) {
      // console.log('First price received:', price);
      this.currentPrice = price;
    } else {
      // Always update the current price
      this.currentPrice = price;
    }
    this.priceHistory.push({ time: Date.now(), price });
    
    if (this.priceHistory.length > 1000) {
      this.priceHistory = this.priceHistory.slice(-500);
    }
    
    // Update or create current candle - CRITICAL for strategy to work!
    this.updateCandles(price);
    
    // Update chart data with real-time price
    this.updateChartData();
    
    // Broadcast price update
    this.broadcast({
      type: 'priceUpdate',
      price: this.currentPrice,
      chartData: this.chartData
    });
    
    // Execute trading logic with real-time price
    if (this.isRunning && !this.isPaused) {
      this.executeTradingLogic();
    }
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
      console.log('Trading logic blocked:', {
        hasStrategy: !!this.strategy,
        currentPrice: this.currentPrice,
        isRunning: this.isRunning,
        isPaused: this.isPaused,
        candleCount: this.candles.length,
        balance: this.balance
      });
      return;
    }
    
    // Remove forced first trade - let strategy decide naturally
    // This was causing issues with normal operation
    
    // Log every 10th execution to track activity
    if (!this._logCounter) this._logCounter = 0;
    this._logCounter++;
    if (this._logCounter % 10 === 0) {
      console.log('Trading logic running:', {
        price: this.currentPrice,
        candles: this.candles.length,
        positions: this.strategy.positions?.length || 0,
        balance: this.balance
      });
    }

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
    console.log('Processing buy signal:', signal);
    
    if (!this.strategy) {
      console.log('No strategy available for buy signal');
      return;
    }
    
    // Calculate position size using strategy's method
    const totalAvailable = this.balance.usd;
    const positionSize = this.strategy.calculatePositionSize(totalAvailable, signal, this.currentPrice);
    
    // console.log('Buy calculation:', {
    //   totalAvailable,
    //   positionSize,
    //   currentPrice: this.currentPrice,
    //   signal
    // });
    
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
    
    // Update strategy state - create proper position format for strategy
    if (this.strategy.addPosition) {
      this.strategy.addPosition({
        entryPrice: position.entryPrice,
        entryTime: position.timestamp,
        size: position.size,
        type: 'long',
        id: position.id,
        usdValue: position.usdValue
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
    
    // Update strategy state - clear all positions since we sell all at once
    if (this.strategy.clearAllPositions) {
      this.strategy.clearAllPositions();
    } else if (this.strategy.positions) {
      // Fallback: clear positions array directly
      this.strategy.positions = [];
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
    // Verify trading is actually running (has interval)
    const actuallyRunning = this.isRunning && this.tradingInterval !== null;
    
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
      isRunning: actuallyRunning,  // Use verified running state
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
        
        // console.log(`Loading state for bot ${this.botId}:`, {
        //   trades: state.trades?.length || 0,
        //   positions: state.positions?.length || 0,
        //   balance: state.balance,
        //   wasRunning: state.isRunning,
        //   wasPaused: state.isPaused
        // });
        
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
            console.log(`Restored ${state.strategyType} strategy with ${this.strategy.positions.length} positions`);
            
            // Ensure positions are in sync
            if (this.positions.length !== this.strategy.positions.length) {
              console.warn(`Position mismatch detected: Service has ${this.positions.length}, Strategy has ${this.strategy.positions.length}`);
              // Convert service positions to strategy format
              const strategyPositions = this.positions.map(pos => ({
                entryPrice: pos.entryPrice,
                entryTime: pos.timestamp || pos.entryTime,
                size: pos.size,
                type: pos.type || 'long',
                id: pos.id,
                usdValue: pos.usdValue
              }));
              
              // Use restore method if available, otherwise direct assignment
              if (this.strategy.restorePositions) {
                this.strategy.restorePositions(strategyPositions);
              } else {
                this.strategy.positions = strategyPositions;
                console.log('Synced strategy positions with service positions');
              }
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
        
        // Restore current price from last known value
        if (state.currentPrice && state.currentPrice > 0) {
          this.currentPrice = state.currentPrice;
          // console.log(`Restored current price: $${this.currentPrice}`);
        }
        
        // Check saved running state but DO NOT auto-resume
        const wasRunning = state.isRunning || false;
        const wasPaused = state.isPaused || false;
        
        // Only log successful loads for debugging
        // console.log('Trading state loaded successfully');
        
        // Simply restore the state - DO NOT restart trading
        // console.log(`Bot ${this.botId} loaded state: running=${wasRunning}, paused=${wasPaused}`);
        
        // Restore the state flags
        this.isRunning = wasRunning;
        this.isPaused = wasPaused;
        
        // If bot was running, set a flag to indicate it needs to be restarted
        // The trading interval is lost on backend restart, so we need to recreate it
        if (wasRunning && !wasPaused) {
          console.log(`Bot ${this.botId} was running - will restart after initialization`);
          this.needsRestart = true;
          this.savedStrategyConfig = state.strategyConfig;
        }
        
        // Broadcast current status to all connected clients after state load
        setTimeout(() => {
          this.broadcast({
            type: 'status',
            status: this.getStatus()
          });
        }, 100);
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
      // IMPORTANT: Save actual running state based on tradingInterval
      const actuallyRunning = this.isRunning && this.tradingInterval !== null;
      
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
        currentPrice: this.currentPrice,
        priceHistory: this.priceHistory.slice(-100), // Keep only recent 100 entries
        isRunning: actuallyRunning, // Save actual running state
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
        // IMPORTANT: Get the actual config from the strategy, not the nested strategyConfig
        const actualConfig = this.strategyConfig?.strategyConfig || this.strategy.config || {};
        
        // Extract the real parameters from deeply nested config if needed
        let finalParams = actualConfig;
        while (finalParams.strategyConfig || finalParams.strategy) {
          finalParams = finalParams.strategyConfig || finalParams.strategy?.strategyConfig || finalParams.strategy || finalParams;
        }
        
        state.strategyParams = finalParams;
        
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
    console.log(`Cleaning up trading service for bot ${this.botId}`);
    // Only stop trading if we're truly shutting down
    // Don't stop on page refresh - keep the bot running!
    if (process.env.SHUTTING_DOWN === 'true') {
      this.stopTrading();
    } else {
      // Just save current state without stopping
      this.saveState().catch(error => {
        console.error('Failed to save state during cleanup:', error);
      });
    }
    this.removeAllListeners();
    this.clients.clear();
    
    // Remove from active instances
    if (this.botId) {
      activeBotInstances.delete(this.botId);
    }
  }
}