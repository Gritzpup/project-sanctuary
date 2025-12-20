import { EventEmitter } from 'events';
import { strategyRegistry } from '../../strategies/StrategyRegistry.js';
import { TradeExecutor } from './TradeExecutor.js';
import { PositionManager } from './PositionManager.js';
import { TradingStateRepository } from '../persistence/TradingStateRepository.js';
import { TradingLogger } from '../logging/TradingLogger.js';

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
    this.logger = new TradingLogger(botId);
    
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
    //   isRunning: this.isRunning,
    //   config: config
    // });

    if (this.isRunning) {
      return;
    }

    try {
      // Try to create strategy instance, but allow bot to run even if it fails
      this.strategyConfig = config.strategyConfig || {};
      try {
        const strategyType = config.strategyType || this.selectedStrategyType || 'reverse-descending-grid';
        this.strategy = strategyRegistry.createStrategy(strategyType, this.strategyConfig);

        // Restore positions to strategy if they exist
        if (this.positionManager.getPositions().length > 0) {
          this.strategy.restorePositions(this.positionManager.getPositions());
        }
      } catch (strategyError) {
        this.strategy = null;
      }

      this.isRunning = true;
      this.isPaused = false;
      
      // Store initial conditions for strategy context
      if (this.currentPrice > 0) {
        this.chartData.initialTradingPrice = this.currentPrice;
        this.chartData.initialRecentHigh = this.currentPrice;
        if (this.strategy) {
          this.strategy.recentHigh = this.currentPrice;
        }
      }
      
      
      // Save state and broadcast
      await this.saveState();
      this.broadcastStatus();
      
    } catch (error) {
      this.isRunning = false;
      throw error;
    }
  }

  stopTrading() {
    
    this.isRunning = false;
    this.isPaused = false;
    this.strategy = null;
    
    this.broadcastStatus();
  }

  pauseTrading() {
    if (this.isRunning) {
      this.isPaused = true;
      this.broadcastStatus();
    }
  }

  resumeTrading() {
    if (this.isRunning && this.isPaused) {
      this.isPaused = false;
      this.broadcastStatus();
    }
  }

  async processPrice(price, product_id) {
    // 🔥 PERFORMANCE FIX: Rate limit price processing to prevent lag
    const now = Date.now();
    if (this._lastPriceUpdate && (now - this._lastPriceUpdate) < 2000) {
      // Skip processing if less than 2 seconds since last update
      this.currentPrice = price; // Still update price for display
      return;
    }
    this._lastPriceUpdate = now;

    // Log trading status periodically
    await this.logger.logTradingStatus(this);
    
    // STATE VALIDATION: Ensure runtime state matches saved state (rate limited)
    if (this.balance.btc === 0 && this.positionManager.getPositions().length === 0) {
      if (!this._lastStateReload || (now - this._lastStateReload) > 10000) {
        this._lastStateReload = now;
        await this.loadState();
      }
    }
    
    // Always update current price for accurate displays
    const prevPrice = this.currentPrice;
    this.currentPrice = price;
    
    // 🔥 CRITICAL: Always check for profitable sells, regardless of bot status  
    if (this.positionManager && this.positionManager.getPositions().length > 0) {
      try {
        const positions = this.positionManager.getPositions();
        // Use the same profit target as the strategy calculation for consistency
        const strategyConfig = this.strategy?.config || this.strategyConfig || {
          profitTarget: 0.4,
          profitTargetPercent: 0.4
        };
        const profitTarget = strategyConfig?.profitTarget || strategyConfig?.profitTargetPercent || 0.4; // Default 0.4%
        
        // GRID TRADING: Check if ANY position is profitable enough to sell
        let mostProfitablePosition = null;
        let highestProfitPercent = -Infinity;
        
        for (const position of positions) {
          const profitPercent = ((price - position.entryPrice) / position.entryPrice) * 100;
          if (profitPercent > highestProfitPercent) {
            highestProfitPercent = profitPercent;
            mostProfitablePosition = position;
          }
        }
        
        // Debug the most profitable position
        //   currentPrice: price.toFixed(2),
        //   totalPositions: positions.length,
        //   mostProfitableEntry: mostProfitablePosition?.entryPrice?.toFixed(2),
        //   highestProfitPercent: highestProfitPercent.toFixed(4),
        //   profitTarget,
        //   readyToSell: highestProfitPercent >= profitTarget,
        //   sellTriggerPrice: mostProfitablePosition ? (mostProfitablePosition.entryPrice * (1 + profitTarget / 100)).toFixed(2) : 'N/A'
        // });
        
        if (mostProfitablePosition && highestProfitPercent >= profitTarget) {
          await this.executeSellSignal({ reason: `Grid sell: ${highestProfitPercent.toFixed(2)}% profit` }, price);
          return; // Exit early after sell
        } else {
        }
      } catch (error) {
      }
    }
    
    // Only continue with regular trading logic if running, not paused, and has strategy
    if (!this.isRunning || this.isPaused) return;
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
      // Only proceed with strategy analysis if strategy exists
      if (this.strategy) {
        // Analyze market conditions
        const signal = this.strategy.analyze(this.candles, price);

        if (signal.type === 'buy') {
          await this.executeBuySignal(signal, price);
        } else if (signal.type === 'sell') {
          await this.executeSellSignal(signal, price);
        }
      } else {
      }

    } catch (error) {
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
      const tradeRecord = this.createTradeRecord('buy', positionSize, price, signal.reason);
      this.trades.push(tradeRecord);
      
      
      // Log the trade execution
      await this.logger.logTradeExecution(tradeRecord, 'BUY', position);
      
      await this.saveState();
      this.broadcastStatus();
    }
  }

  async executeSellSignal(signal, price) {
    const positions = this.positionManager.getPositions();
    
    if (positions.length > 0) {
      // GRID TRADING: Sell only the most profitable position (highest profit margin)
      let mostProfitablePosition = null;
      let highestProfitPercent = -Infinity;
      
      for (const position of positions) {
        const profitPercent = ((price - position.entryPrice) / position.entryPrice) * 100;
        if (profitPercent > highestProfitPercent) {
          highestProfitPercent = profitPercent;
          mostProfitablePosition = position;
        }
      }
      
      if (!mostProfitablePosition || highestProfitPercent < 0.4) {
        return;
      }
      
      // Sell only this one position
      const positionSize = mostProfitablePosition.size;
      const saleValue = positionSize * price;
      const costBasis = mostProfitablePosition.entryPrice * positionSize;
      const profit = saleValue - costBasis;
      const fees = saleValue * 0.001; // 0.1% trading fees
      const netProfit = profit - fees;
      
      // Execute the sale for this single position
      await this.tradeExecutor.executeSell(positionSize, price, signal.reason);
      
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
        this.balance.usd += costBasis + tradingRebalance;
        
        
        // Track rebalance amount for growth
        this.statistics.totalRebalance += tradingRebalance;
        
      } else {
        // Losing trade (shouldn't happen with profit check above)
        this.statistics.losingTrades++;
        this.balance.usd += saleValue;
      }
      
      // Update BTC balance (subtract only the sold position)
      this.balance.btc -= positionSize;
      
      // Remove only the sold position (not all positions!)
      this.positionManager.removePosition(mostProfitablePosition);
      // Only remove from strategy if it exists
      if (this.strategy && this.strategy.removePosition) {
        this.strategy.removePosition(mostProfitablePosition.id);
      }
      
      const tradeRecord = this.createTradeRecord('sell', positionSize, price, signal.reason);
      tradeRecord.profit = netProfit;
      tradeRecord.costBasis = costBasis;
      tradeRecord.positionId = mostProfitablePosition.id;
      this.trades.push(tradeRecord);
      
      
      // Log the trade execution with profit details
      await this.logger.logTradeExecution(tradeRecord, 'SELL', mostProfitablePosition);
      
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
    
    // Debug: Check if positions are being properly maintained
    //   positionsCount: positions.length,
    //   btcBalance: this.balance.btc,
    //   tradesCount: this.trades.length,
    //   shouldHavePositions: this.balance.btc > 0
    // });
    
    // RECONSTRUCT POSITIONS FROM TRADES - Enhanced version to show all positions
    if (positions.length === 0 && this.balance.btc > 0 && this.trades.length > 0) {
      const buyTrades = this.trades.filter(t => t.side === 'buy' || t.type === 'buy');
      
      if (buyTrades.length > 0) {
        // Create individual positions from each buy trade instead of consolidating
        positions = buyTrades.map(trade => ({
          id: trade.id || trade.timestamp,
          entryPrice: trade.price,
          size: trade.amount, // Use individual trade amount, not total balance
          timestamp: trade.timestamp,
          type: 'buy',
          reason: trade.reason || 'Reconstructed from trade history'
        }));
        
        
        // Also restore them to the PositionManager
        this.positionManager.clearAllPositions();
        positions.forEach(position => {
          this.positionManager.addPosition(position);
        });
      }
    }
    
    // Calculate win rate
    const totalTrades = this.statistics.winningTrades + this.statistics.losingTrades;
    const winRate = totalTrades > 0 ? (this.statistics.winningTrades / totalTrades) * 100 : 0;
    
    // Calculate next buy/sell trigger distances
    let nextBuyDistance = null;
    let nextSellDistance = null;
    let nextBuyPrice = null;
    let nextSellPrice = null;
    
    // Debug logging removed to prevent memory leak
    
    // Only calculate trigger distances if bot is actually running and has trading state
    if (this.isRunning && this.currentPrice > 0) {
      // Always use saved strategy config or defaults - don't require active strategy
      const strategyConfig = this.strategy?.config || {
        initialDropPercent: 0.02,   // Ultra aggressive: 0.02% drop for first buy
        levelDropPercent: 0.02,     // Ultra aggressive: 0.02% additional drop per level
        profitTarget: 0.4,          // FIXED: 0.4% profit target (matches actual sell trigger)
        profitTargetPercent: 0.4,   // FIXED: 0.4% profit target (matches actual sell trigger)
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
      }
      // Calculate next buy trigger (if not at max levels)
      const currentLevel = this.positionManager.getPositions().length + 1;
      const maxLevels = strategyConfig.maxLevels || 12;
      
      //   currentLevel,
      //   maxLevels,
      //   canBuy: currentLevel <= maxLevels,
      //   recentHigh,
      //   currentPrice: this.currentPrice
      // });
      
      if (currentLevel <= maxLevels && recentHigh > 0) {
        const initialDropPercent = strategyConfig.initialDropPercent || 1.0; // 1% initial drop
        const levelDropPercent = strategyConfig.levelDropPercent || 0.5;   // 0.5% per additional level
        const requiredDrop = initialDropPercent + (currentLevel - 1) * levelDropPercent;
        const currentDrop = ((recentHigh - this.currentPrice) / recentHigh) * 100;
        
        // Calculate the actual buy trigger price
        nextBuyPrice = recentHigh * (1 - requiredDrop / 100);
        
        // Calculate progress percentage (how close we are to triggering the buy)
        // If currentDrop >= requiredDrop, we're ready to trigger (0% distance remaining)
        // Otherwise, show percentage of progress toward the trigger
        let progressToTrigger = 0;
        if (currentDrop >= requiredDrop) {
          nextBuyDistance = 0; // Ready to trigger
          progressToTrigger = 100; // Show 100% when ready
        } else {
          progressToTrigger = requiredDrop > 0 ? (currentDrop / requiredDrop) * 100 : 0;
          nextBuyDistance = Math.max(0, progressToTrigger);
        }
        
        // Buy distance debug logging removed to prevent memory leak
      }
      
      // Calculate next sell trigger (check both positions and BTC balance)
      const savedPositions = this.positionManager.getPositions();
      const hasBtcBalance = this.balance.btc > 0;
      const positionsCount = savedPositions.length;
      
      //   positionsCount,
      //   hasBtcBalance,
      //   btcBalance: this.balance.btc,
      //   hasPositions: positionsCount > 0 || hasBtcBalance,
      //   hasStrategy: !!this.strategy
      // });
      
      // Calculate sell trigger if we have BTC balance (even without explicit positions)
      if (positionsCount > 0 || hasBtcBalance) {
        let profitPercent = 0;
        let averageEntryPrice = 0; // Declare at higher scope so it's accessible for price calculation
        
        // CRITICAL FIX: Always calculate from actual positions data first
        if (savedPositions.length > 0) {
          // Use position data - this is the most reliable source
          const totalCostBasis = savedPositions.reduce((sum, pos) => sum + (pos.entryPrice * pos.size), 0);
          const totalBtc = savedPositions.reduce((sum, pos) => sum + pos.size, 0);
          averageEntryPrice = totalBtc > 0 ? totalCostBasis / totalBtc : 0;
          
        } else if (hasBtcBalance && this.trades.length > 0) {
          // Calculate from recent buy trades if no explicit positions
          const buyTrades = this.trades.filter(t => t.side === 'buy' || t.type === 'buy');
          
          if (buyTrades.length > 0) {
            const totalCost = buyTrades.reduce((sum, t) => sum + (t.price * (t.amount || t.quantity || 0)), 0);
            const totalAmount = buyTrades.reduce((sum, t) => sum + (t.amount || t.quantity || 0), 0);
            averageEntryPrice = totalAmount > 0 ? totalCost / totalAmount : 0;
            
          }
        }
        
        // Calculate profit percentage from our reliable average entry price
        profitPercent = averageEntryPrice > 0 ? ((this.currentPrice - averageEntryPrice) / averageEntryPrice) * 100 : 0;
        
        // Only try strategy fallback if positions calculation failed
        if (averageEntryPrice === 0 && this.strategy && this.strategy.calculateProfitPercent) {
          profitPercent = this.strategy.calculateProfitPercent(this.currentPrice);
          // Try to get average entry price from strategy if available
          if (this.strategy.getAverageEntryPrice) {
            averageEntryPrice = this.strategy.getAverageEntryPrice();
          }
        }
        
        const profitTarget = strategyConfig?.profitTarget || strategyConfig?.profitTargetPercent || 0.4; // Default 0.4%
        
        // GRID TRADING FIX: Calculate sell trigger based on the LOWEST sell trigger (most profitable position)
        // This ensures we sell individual positions when they become profitable, not wait for average
        if (savedPositions.length > 0) {
          let lowestSellTrigger = Infinity;
          for (const position of savedPositions) {
            const sellTrigger = position.entryPrice * (1 + profitTarget / 100);
            if (sellTrigger < lowestSellTrigger) {
              lowestSellTrigger = sellTrigger;
            }
          }
          nextSellPrice = lowestSellTrigger < Infinity ? lowestSellTrigger : null;
        } else {
          // Fallback to average if no positions (shouldn't happen)
          nextSellPrice = averageEntryPrice > 0 ? averageEntryPrice * (1 + profitTarget / 100) : null;
        }
        
        //   averageEntryPrice: averageEntryPrice.toFixed(2),
        //   profitTarget,
        //   nextSellPrice: nextSellPrice ? nextSellPrice.toFixed(2) : 'null',
        //   lowestEntryPrice: savedPositions.length > 0 ? Math.min(...savedPositions.map(p => p.entryPrice)).toFixed(2) : 'N/A',
        //   positionsCount: savedPositions.length
        // });
        
        // Calculate progress percentage (how close we are to triggering the sell)
        // If profitPercent >= profitTarget, we're ready to trigger (0% distance remaining)
        // Otherwise, show percentage of progress toward the sell trigger
        let progressToSell = 0;
        if (profitPercent >= profitTarget) {
          nextSellDistance = 0; // Ready to trigger
          progressToSell = 100; // Show 100% when ready
        } else {
          progressToSell = profitTarget > 0 ? (profitPercent / profitTarget) * 100 : 0;
          nextSellDistance = Math.max(0, progressToSell);
        }
        
        // Sell distance debug logging removed to prevent memory leak
      }
    } else {
      // Silently skip - price not available yet (normal during startup)
    }
    
    // 🔍 DEBUG: Log vault balances being sent

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
      
      // Next trigger distances and prices
      nextBuyDistance: nextBuyDistance,
      nextSellDistance: nextSellDistance,
      nextBuyPrice: nextBuyPrice,
      nextSellPrice: nextSellPrice
    };
  }

  calculateTotalValue() {
    return this.balance.usd + (this.balance.btc * this.currentPrice);
  }

  broadcastStatus() {
    const status = this.getStatus();
    // 🔍 DEBUG: Log vault balances being broadcast

    this.broadcast({
      type: 'status',
      data: status
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
  }

  async loadState() {
    try {
      const state = await this.stateRepository.loadState();
      if (state) {
        // Migrate old state format to include vault balances and statistics
        if (state.balance && !state.balance.vault) {
          state.balance.vault = 0;
          state.balance.btcVault = 0;
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
        }
        
        // 🔍 DEBUG: Log what's being loaded from state

        // CRITICAL FIX: Instead of Object.assign, selectively restore properties to avoid overwriting instances
        this.isRunning = state.isRunning || false;
        this.isPaused = state.isPaused || false;
        this.currentPrice = state.currentPrice || 0;
        this.balance = { ...state.balance };

        // 🔍 DEBUG: Log what this.balance contains after loading

        this.trades = [...(state.trades || [])];
        this.statistics = { ...state.statistics };
        this.chartData = { ...state.chartData };
        this.selectedStrategyType = state.selectedStrategyType || 'reverse-descending-grid';
        this.strategyConfig = state.strategyConfig || null;
        
        // Restore positions to PositionManager (this is the critical part)
        if (state.positions && Array.isArray(state.positions)) {
          // Clear any existing positions and restore from saved state
          this.positionManager.clearAllPositions();
          state.positions.forEach(position => {
            this.positionManager.addPosition(position);
          });
        }

        // 🔧 FIX: Recreate strategy if bot was running
        if (this.isRunning && this.selectedStrategyType) {
          try {
            this.strategy = strategyRegistry.createStrategy(this.selectedStrategyType, this.strategyConfig || {});

            // Restore positions to strategy if they exist
            if (this.positionManager.getPositions().length > 0) {
              this.strategy.restorePositions(this.positionManager.getPositions());
            }
          } catch (strategyError) {
            this.strategy = null;
          }
        }

        // 🎯 FIX: Recalculate totalReturn from trade history
        // This ensures totalReturn is accurate even after restarts
        if (this.trades && Array.isArray(this.trades)) {
          const calculatedReturn = this.trades
            .filter(t => t.side === 'sell' && t.profit > 0)
            .reduce((sum, t) => sum + t.profit, 0);

          // Only update if we calculated a different value (trades exist but stats were reset)
          if (calculatedReturn > 0 && this.statistics.totalReturn === 0) {
            this.statistics.totalReturn = calculatedReturn;
            this.statistics.winningTrades = this.trades.filter(t => t.side === 'sell' && t.profit > 0).length;
          }
        }

        // Save the migrated state
        await this.saveState();
      }
    } catch (error) {
    }
  }

  async saveState() {
    try {
      await this.stateRepository.saveState(this.getStatus());
    } catch (error) {
    }
  }

  async updateSelectedStrategy(strategyType) {
    this.selectedStrategyType = strategyType;
    await this.saveState();
  }

  cleanup() {
    // Cleanup resources
    this.stopTrading();
    this.clients.clear();
    
    // Clean old logs
    if (this.logger) {
      this.logger.cleanOldLogs();
    }
  }
}