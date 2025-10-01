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
      btc: 0,
      vault: 0,        // USDC vault (85.7% of profits)
      btcVault: 0      // BTC vault (14.3% of profits)
    };
    this.currentPrice = 0;
    this.trades = [];
    this.candles = [];
    
    // Trading statistics
    this.statistics = {
      totalFees: 0,
      totalRebates: 0,
      totalReturn: 0,
      totalRebalance: 0,
      winningTrades: 0,
      losingTrades: 0,
      initialBalance: 10000
    };
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
      
      // Calculate the cost basis from all buy positions
      const totalCostBasis = this.positionManager.getTotalCostBasis();
      const profit = saleValue - totalCostBasis;
      const fees = saleValue * 0.001; // 0.1% trading fees
      const netProfit = profit - fees;
      
      // Execute the sale
      await this.tradeExecutor.executeSell(totalBtc, price, signal.reason);
      
      // Update trading statistics
      this.statistics.totalFees += fees;
      
      if (netProfit > 0) {
        // Profitable trade - allocate to vaults
        this.statistics.winningTrades++;
        this.statistics.totalReturn += netProfit;
        
        // Vault allocation: 85.7% USDC vault, 14.3% BTC vault
        const usdcVaultAllocation = netProfit * 0.857;
        const btcVaultAllocation = netProfit * 0.143;
        
        this.balance.vault += usdcVaultAllocation;
        this.balance.btcVault += btcVaultAllocation / price; // Convert to BTC
        
        // Remaining goes back to trading balance
        const remainingForTrading = netProfit - usdcVaultAllocation - btcVaultAllocation;
        this.balance.usd += totalCostBasis + remainingForTrading;
        
        console.log(`💰 PROFITABLE SELL: Profit $${netProfit.toFixed(2)} allocated to vaults`);
        console.log(`  - USDC Vault: +$${usdcVaultAllocation.toFixed(2)}`);
        console.log(`  - BTC Vault: +${(btcVaultAllocation / price).toFixed(6)} BTC`);
        
        // Track rebalance amount (20% of profit goes back to trading balance)
        this.statistics.totalRebalance += remainingForTrading;
        
      } else {
        // Losing trade
        this.statistics.losingTrades++;
        this.balance.usd += saleValue;
        console.log(`📉 LOSING SELL: Loss $${Math.abs(netProfit).toFixed(2)}`);
      }
      
      this.balance.btc = 0;
      
      this.positionManager.clearAllPositions();
      this.strategy.clearAllPositions();
      
      const tradeRecord = this.createTradeRecord('sell', totalBtc, price, signal.reason);
      tradeRecord.profit = netProfit;
      tradeRecord.costBasis = totalCostBasis;
      this.trades.push(tradeRecord);
      
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
      }
    }
    
    // Calculate win rate
    const totalTrades = this.statistics.winningTrades + this.statistics.losingTrades;
    const winRate = totalTrades > 0 ? (this.statistics.winningTrades / totalTrades) * 100 : 0;
    
    return {
      isRunning: this.isRunning,
      isPaused: this.isPaused,
      balance: this.balance,
      currentPrice: this.currentPrice,
      positions: positions,
      trades: this.trades,
      strategyType: this.strategy ? this.strategyConfig?.strategyType : null,
      positionCount: positions.length,
      totalValue: this.calculateTotalValue(),
      
      // Trading statistics (FIXED: these were missing!)
      totalFees: this.statistics.totalFees,
      totalRebates: this.statistics.totalRebates,
      totalReturn: this.statistics.totalReturn,
      totalRebalance: this.statistics.totalRebalance,
      winRate: winRate,
      
      // Vault balances (FIXED: these were missing!)
      vaultBalance: this.balance.vault,
      btcVaultBalance: this.balance.btcVault,
      
      // Additional debugging info
      recentHigh: this.chartData.recentHigh,
      recentLow: this.chartData.recentLow
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
    this.balance = { 
      usd: 10000, 
      btc: 0, 
      vault: 0, 
      btcVault: 0 
    };
    this.statistics = {
      totalFees: 0,
      totalRebates: 0,
      totalReturn: 0,
      totalRebalance: 0,
      winningTrades: 0,
      losingTrades: 0,
      initialBalance: 10000
    };
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
        // Migrate old state format to include vault balances and statistics
        if (state.balance && !state.balance.vault) {
          state.balance.vault = 0;
          state.balance.btcVault = 0;
          console.log(`🔄 Migrated balance structure to include vault fields for bot ${this.botId}`);
        }
        
        // Migrate to include statistics if missing
        if (!state.statistics) {
          state.statistics = {
            totalFees: 0,
            totalRebates: 0,
            totalReturn: 0,
            totalRebalance: 0,
            winningTrades: 0,
            losingTrades: 0,
            initialBalance: state.balance?.usd || 10000
          };
          console.log(`🔄 Migrated to include trading statistics for bot ${this.botId}`);
        }
        
        Object.assign(this, state);
        console.log(`✅ State loaded for bot ${this.botId}`);
        
        // Save the migrated state
        await this.saveState();
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