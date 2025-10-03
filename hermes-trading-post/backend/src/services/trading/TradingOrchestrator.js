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
    this.selectedStrategyType = 'reverse-descending-grid'; // Track dropdown selection
    
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

    const prevPrice = this.currentPrice;
    this.currentPrice = price;
    this.updateCandles(price);

    // Broadcast price update with updated P&L if we have positions
    if (this.positionManager.getPositions().length > 0) {
      // Calculate percentage change from previous price
      const priceChangePercent = prevPrice > 0 ? Math.abs((price - prevPrice) / prevPrice) * 100 : 0;
      
      // Broadcast updated P&L on significant price changes (>0.01%) or every 10th update
      if (priceChangePercent > 0.01 || (this._priceUpdateCount % 10 === 0)) {
        this.broadcast({
          type: 'priceUpdate',
          price: price,
          status: this.getStatus()
        });
      }
    }
    
    // Increment update counter for periodic broadcasts
    this._priceUpdateCount = (this._priceUpdateCount || 0) + 1;

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
        
        // Optimized profit allocation: 60% vault, 20% BTC vault, 20% trading rebalance
        const usdcVaultAllocation = netProfit * 0.60;    // 60% to USDC vault
        const btcVaultAllocation = netProfit * 0.20;     // 20% to BTC vault  
        const tradingRebalance = netProfit * 0.20;       // 20% back to trading for growth
        
        this.balance.vault += usdcVaultAllocation;
        this.balance.btcVault += btcVaultAllocation / price; // Convert to BTC
        
        // Add cost basis back + rebalance amount for trading growth
        this.balance.usd += totalCostBasis + tradingRebalance;
        
        console.log(`💰 PROFITABLE SELL: Profit $${netProfit.toFixed(2)} allocated optimally`);
        console.log(`  - USDC Vault (60%): +$${usdcVaultAllocation.toFixed(2)}`);
        console.log(`  - BTC Vault (20%): +${(btcVaultAllocation / price).toFixed(6)} BTC`);
        console.log(`  - Trading Rebalance (20%): +$${tradingRebalance.toFixed(2)}`);
        
        // Track rebalance amount for growth
        this.statistics.totalRebalance += tradingRebalance;
        
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
    
    // Update recentHigh for trigger calculations
    if (price > this.chartData.recentHigh) {
      this.chartData.recentHigh = price;
      console.log(`📈 New recent high: $${price.toFixed(2)}`);
    }
    
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
    
    // Calculate next buy/sell trigger distances
    let nextBuyDistance = null;
    let nextSellDistance = null;
    
    console.log('🔍 Trigger distance calculation debug:', {
      hasStrategy: !!this.strategy,
      currentPrice: this.currentPrice,
      strategyConfig: this.strategy?.config,
      positionsCount: this.positionManager.getPositions().length,
      recentHigh: this.strategy?.recentHigh || this.chartData.recentHigh,
      selectedStrategyType: this.selectedStrategyType
    });
    
    // Calculate trigger distances from saved state data (works without active strategy)
    if (this.currentPrice > 0) {
      // Always use saved strategy config or defaults - don't require active strategy
      const strategyConfig = this.strategy?.config || {
        initialDropPercent: 0.02,   // Ultra aggressive: 0.02% drop for first buy
        levelDropPercent: 0.02,     // Ultra aggressive: 0.02% additional drop per level
        profitTarget: 0.5,          // Optimized: 0.5% profit target (covers fees + vault + rebalance)
        profitTargetPercent: 0.5,   // Optimized: 0.5% profit target (covers fees + vault + rebalance)
        maxLevels: 15               // Increase levels to accommodate more frequent buys
      };
      
      // Use recentHigh from saved chartData, strategy, or derive from trade history
      let recentHigh = this.strategy?.recentHigh || this.chartData.recentHigh;
      
      // If no recentHigh saved, calculate from trade history or use current price
      if (!recentHigh || recentHigh === 0) {
        if (this.trades.length > 0) {
          // Find the highest price from recent trade history
          const recentTrades = this.trades.slice(-20); // Last 20 trades
          recentHigh = Math.max(...recentTrades.map(t => t.price || 0));
        } else {
          recentHigh = this.currentPrice;
        }
        
        // Update chartData with calculated recentHigh
        this.chartData.recentHigh = recentHigh;
        console.log(`📊 Calculated recentHigh from trade history: $${recentHigh.toFixed(2)}`);
      }
      // Calculate next buy trigger (if not at max levels)
      const currentLevel = this.positionManager.getPositions().length + 1;
      const maxLevels = strategyConfig.maxLevels || 12;
      
      console.log('📊 Buy trigger calculation:', {
        currentLevel,
        maxLevels,
        canBuy: currentLevel <= maxLevels,
        recentHigh,
        currentPrice: this.currentPrice
      });
      
      if (currentLevel <= maxLevels && recentHigh > 0) {
        const initialDropPercent = strategyConfig.initialDropPercent || 0.1;
        const levelDropPercent = strategyConfig.levelDropPercent || 0.1;
        const requiredDrop = initialDropPercent + (currentLevel - 1) * levelDropPercent;
        const currentDrop = ((recentHigh - this.currentPrice) / recentHigh) * 100;
        
        // Calculate progress percentage (how close we are to triggering the buy)
        const progressToTrigger = requiredDrop > 0 ? (currentDrop / requiredDrop) * 100 : 0;
        nextBuyDistance = Math.min(100, Math.max(0, progressToTrigger));
        
        console.log('🟢 Buy distance calculated:', {
          initialDropPercent,
          levelDropPercent,
          requiredDrop,
          currentDrop,
          progressToTrigger,
          nextBuyDistance: `${nextBuyDistance.toFixed(1)}%`
        });
      }
      
      // Calculate next sell trigger (check both positions and BTC balance)
      const savedPositions = this.positionManager.getPositions();
      const hasBtcBalance = this.balance.btc > 0;
      const positionsCount = savedPositions.length;
      
      console.log('📊 Sell trigger calculation:', {
        positionsCount,
        hasBtcBalance,
        btcBalance: this.balance.btc,
        hasPositions: positionsCount > 0 || hasBtcBalance
      });
      
      // Calculate sell trigger if we have BTC balance (even without explicit positions)
      if (positionsCount > 0 || hasBtcBalance) {
        let profitPercent = 0;
        
        if (this.strategy && this.strategy.calculateProfitPercent) {
          profitPercent = this.strategy.calculateProfitPercent(this.currentPrice);
        } else {
          // Calculate from saved data
          let averageEntryPrice = 0;
          
          if (savedPositions.length > 0) {
            // Use position data
            const totalCostBasis = savedPositions.reduce((sum, pos) => sum + (pos.entryPrice * pos.size), 0);
            const totalBtc = savedPositions.reduce((sum, pos) => sum + pos.size, 0);
            averageEntryPrice = totalBtc > 0 ? totalCostBasis / totalBtc : 0;
          } else if (hasBtcBalance && this.trades.length > 0) {
            // Calculate from recent buy trades if no explicit positions
            const buyTrades = this.trades.filter(t => t.side === 'buy' || t.type === 'buy');
            console.log(`📊 Calculating from trade history: ${buyTrades.length} buy trades found out of ${this.trades.length} total trades`);
            
            if (buyTrades.length > 0) {
              const totalCost = buyTrades.reduce((sum, t) => sum + (t.price * (t.amount || t.quantity || 0)), 0);
              const totalAmount = buyTrades.reduce((sum, t) => sum + (t.amount || t.quantity || 0), 0);
              averageEntryPrice = totalAmount > 0 ? totalCost / totalAmount : 0;
              
              console.log(`📊 Trade calculation: totalCost=$${totalCost.toFixed(2)}, totalAmount=${totalAmount.toFixed(6)}, avgEntry=$${averageEntryPrice.toFixed(2)}`);
            }
          }
          
          profitPercent = averageEntryPrice > 0 ? ((this.currentPrice - averageEntryPrice) / averageEntryPrice) * 100 : 0;
          
          console.log(`📊 Profit calculation: currentPrice=$${this.currentPrice.toFixed(2)}, avgEntry=$${averageEntryPrice.toFixed(2)}, profit=${profitPercent.toFixed(3)}%`);
        }
        
        const profitTarget = strategyConfig.profitTarget || strategyConfig.profitTargetPercent || 0.5;
        
        // Calculate progress percentage (how close we are to triggering the sell)
        const progressToSell = profitTarget > 0 ? (profitPercent / profitTarget) * 100 : 0;
        nextSellDistance = Math.min(100, Math.max(0, progressToSell));
        
        console.log('🔴 Sell distance calculated:', {
          profitPercent: profitPercent.toFixed(3),
          profitTarget,
          progressToSell: progressToSell.toFixed(1),
          nextSellDistance: `${nextSellDistance.toFixed(1)}%`
        });
      }
    } else {
      console.log('❌ Cannot calculate trigger distances: no current price');
    }
    
    return {
      isRunning: this.isRunning,
      isPaused: this.isPaused,
      balance: this.balance,
      currentPrice: this.currentPrice,
      positions: positions,
      trades: this.trades,
      strategyType: this.strategy ? this.strategyConfig?.strategyType : null,
      selectedStrategyType: this.selectedStrategyType,
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
      recentLow: this.chartData.recentLow,
      
      // Next trigger distances
      nextBuyDistance: nextBuyDistance,
      nextSellDistance: nextSellDistance
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

  async updateSelectedStrategy(strategyType) {
    this.selectedStrategyType = strategyType;
    await this.saveState();
    console.log(`📝 Updated selected strategy for bot ${this.botId} to: ${strategyType}`);
  }

  cleanup() {
    // Cleanup resources
    this.stopTrading();
    this.clients.clear();
  }
}