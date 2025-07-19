import { Strategy } from '../strategies/base/Strategy';
import type { CandleData, Trade, BacktestResult, StrategyState } from '../strategies/base/StrategyTypes';

export interface BacktestConfig {
  initialBalance: number;
  startTime: number;
  endTime: number;
  feePercent: number; // Legacy - keeping for compatibility
  makerFeePercent: number; // Maker fee (limit orders)
  takerFeePercent: number; // Taker fee (market orders)
  feeRebatePercent: number; // Percentage of fees rebated (e.g., 25%)
  slippage: number;
}

export class BacktestingEngine {
  private strategy: Strategy;
  private config: BacktestConfig;
  private trades: Trade[] = [];
  private equityHistory: Array<{
    timestamp: number;
    value: number;
    btcBalance: number;
    usdBalance: number;
    vaultBalance: number;
  }> = [];
  private peakValue: number = 0;
  private maxDrawdown: number = 0;
  private vaultGrowthHistory: Array<{time: number; value: number}> = [];
  private btcGrowthHistory: Array<{time: number; value: number}> = [];
  private drawdownHistory: Array<{time: number; value: number}> = [];
  private totalFeesCollected: number = 0;
  private totalFeeRebates: number = 0;
  private initialBalanceGrowth: number = 0; // Tracks growth of trading balance from profits

  constructor(strategy: Strategy, config: BacktestConfig) {
    this.strategy = strategy;
    this.config = config;
  }

  async runBacktest(candles: CandleData[]): Promise<BacktestResult> {
    // Initialize state with full balance in USD for trading
    const state: StrategyState = {
      positions: [],
      balance: {
        usd: this.config.initialBalance, // All funds start in USD
        btcVault: 0, // No initial BTC vault
        btcPositions: 0, // No initial BTC positions
        vault: 0 // No initial USDC vault
      }
    };
    
    try {

    // Reset strategy state before starting
    if (this.strategy.reset) {
      this.strategy.reset();
    }
    
    this.strategy.setState(state);
    this.trades = [];
    this.equityHistory = [];
    this.peakValue = this.config.initialBalance;
    this.maxDrawdown = 0;
    this.vaultGrowthHistory = [];
    this.btcGrowthHistory = [];
    this.drawdownHistory = [];
    this.totalFeesCollected = 0;
    this.totalFeeRebates = 0;
    this.initialBalanceGrowth = 0;

    // Filter candles to backtest period
    const filteredCandles = candles.filter(
      c => c.time >= this.config.startTime && c.time <= this.config.endTime
    );
    
    console.log('Backtesting time range:', {
      configStart: new Date(this.config.startTime * 1000).toISOString(),
      configEnd: new Date(this.config.endTime * 1000).toISOString(),
      candlesIn: candles.length,
      candlesFiltered: filteredCandles.length
    });

    // Check if we have any candles in the backtest period
    if (filteredCandles.length === 0) {
      console.error('No candles found in backtest period', {
        startTime: new Date(this.config.startTime * 1000),
        endTime: new Date(this.config.endTime * 1000),
        totalCandles: candles.length,
        firstCandle: candles[0] ? new Date(candles[0].time * 1000) : 'none',
        lastCandle: candles[candles.length - 1] ? new Date(candles[candles.length - 1].time * 1000) : 'none'
      });
      throw new Error('No historical data available for the selected backtest period');
    }

    // Process each candle
    for (let i = 0; i < filteredCandles.length; i++) {
      const currentCandle = filteredCandles[i];
      const historicalData = filteredCandles.slice(0, i + 1);
      
      // Skip if not enough historical data
      const requiredData = this.strategy.getRequiredHistoricalData();
      if (historicalData.length < requiredData) continue;

      // Get strategy signal
      const signal = this.strategy.analyze(historicalData, currentCandle.close);

      // Debug logging for first few candles and any non-hold signals
      if (i < 5 || signal.type !== 'hold') {
        console.log(`Candle ${i}:`, {
          time: new Date(currentCandle.time * 1000).toISOString(),
          price: currentCandle.close,
          signal: signal.type,
          reason: signal.reason,
          metadata: signal.metadata,
          btcPositions: state.balance.btcPositions,
          usdBalance: state.balance.usd
        });
      }

      // Process signal with validation
      if (signal.type === 'buy') {
        // Validate buy signal
        if (this.strategy.validateSignal(signal, state.balance.usd, currentCandle.close)) {
          this.processBuySignal(signal, currentCandle, state);
        }
      } else if (signal.type === 'sell') {
        // Validate sell signal - check if we have enough BTC
        const requestedSize = signal.size || this.strategy.getTotalPositionSize();
        if (requestedSize > state.balance.btcPositions && state.balance.btcPositions > 0) {
          // Adjust the sell size to what we actually have
          console.warn(`[${new Date(currentCandle.time * 1000).toISOString()}] Adjusting sell size from ${requestedSize.toFixed(6)} to ${state.balance.btcPositions.toFixed(6)} BTC (all available)`);
          signal.size = state.balance.btcPositions;
        } else if (state.balance.btcPositions <= 0) {
          console.warn(`[${new Date(currentCandle.time * 1000).toISOString()}] Cannot sell - no BTC available (requested: ${requestedSize.toFixed(6)} BTC)`);
          // Force strategy to sync its positions
          this.strategy.reset();
          return;
        }
        if (this.strategy.validateSignal(signal, state.balance.usd, currentCandle.close)) {
          this.processSellSignal(signal, currentCandle, state);
        }
      }

      // Update equity history
      this.updateEquityHistory(currentCandle, state);
      
      // Log balance distribution every 1000 candles or after trades
      if (i % 1000 === 0 || (signal.type !== 'hold' && (signal.type === 'buy' || signal.type === 'sell'))) {
        const btcValue = (state.balance.btcPositions + state.balance.btcVault) * currentCandle.close;
        const totalValue = state.balance.usd + state.balance.vault + btcValue;
        console.log(`[BacktestEngine] Balance distribution at ${new Date(currentCandle.time * 1000).toISOString()}:`, {
          usd: state.balance.usd.toFixed(2),
          vault: state.balance.vault.toFixed(2),
          btcPositions: state.balance.btcPositions.toFixed(6),
          btcVault: state.balance.btcVault.toFixed(6),
          btcValueUSD: btcValue.toFixed(2),
          totalValue: totalValue.toFixed(2),
          availableForTrading: (state.balance.usd + state.balance.vault).toFixed(2)
        });
      }
    }

    // Calculate metrics - use last candle price if available
    const lastPrice = filteredCandles.length > 0 ? filteredCandles[filteredCandles.length - 1].close : 0;
    const metrics = this.calculateMetrics(state, lastPrice);

    // Generate chart data
    const chartData = this.generateChartData();

    console.log(`Backtest Summary: ${this.trades.length} trades executed`, {
      trades: this.trades.length,
      buyTrades: this.trades.filter(t => t.type === 'buy').length,
      sellTrades: this.trades.filter(t => t.type === 'sell').length,
      finalEquity: state.balance.usd + ((state.balance.btcVault + state.balance.btcPositions) * lastPrice) + state.balance.vault,
      profit: metrics.totalReturn,
      profitPercent: metrics.totalReturnPercent
    });

    return {
      trades: this.trades,
      metrics,
      equity: this.equityHistory,
      chartData
    };
    } catch (error) {
      console.error('Backtest error:', error);
      // Return a valid result even on error
      const lastPrice = candles.length > 0 ? candles[candles.length - 1].close : 0;
      const finalEquity = state ? 
        (state.balance.usd + ((state.balance.btcVault + state.balance.btcPositions) * lastPrice) + state.balance.vault) : 
        this.config.initialBalance;
      
      return {
        trades: this.trades,
        metrics: {
          totalTrades: this.trades.length,
          winningTrades: 0,
          losingTrades: 0,
          winRate: 0,
          totalReturn: 0,
          totalReturnPercent: 0,
          maxDrawdown: 0,
          sharpeRatio: 0,
          profitFactor: 0,
          finalEquity: finalEquity,
          totalFees: this.totalFeesCollected
        },
        equity: this.equityHistory,
        chartData: this.generateChartData()
      };
    }
  }

  private processBuySignal(signal: any, candle: CandleData, state: StrategyState): void {
    // Use both USD and vault balance for buying (vault is USDC profit storage)
    const availableBalance = state.balance.usd + state.balance.vault;
    
    console.log(`[BacktestEngine] Processing BUY signal at ${new Date(candle.time * 1000).toISOString()}`, {
      availableBalance,
      signalMetadata: signal.metadata,
      currentPrice: candle.close
    });
    
    // Calculate position size
    const size = this.strategy.calculatePositionSize(availableBalance, signal, candle.close);
    if (size <= 0) {
      console.warn(`[BacktestEngine] Position size is 0 or negative:`, {
        calculatedSize: size,
        availableBalance,
        price: candle.close
      });
      return;
    }

    // Apply slippage
    const executionPrice = candle.close * (1 + this.config.slippage / 100);
    const cost = size * executionPrice;
    
    // Use taker fee for market orders (buys are typically market orders in backtesting)
    const feePercent = this.config.takerFeePercent || this.config.feePercent || 0.75;
    const grossFee = cost * (feePercent / 100);
    const feeRebate = grossFee * ((this.config.feeRebatePercent || 0) / 100);
    const netFee = grossFee - feeRebate;
    
    const totalCost = cost + netFee;
    this.totalFeesCollected += grossFee;
    this.totalFeeRebates += feeRebate;

    // Check if we have enough balance
    if (totalCost > availableBalance) {
      console.warn(`[BacktestEngine] Insufficient balance for buy:`, {
        totalCost,
        availableBalance,
        shortage: totalCost - availableBalance,
        size,
        price: executionPrice
      });
      return;
    }

    // Execute trade - use USD first, then vault if needed
    if (totalCost <= state.balance.usd) {
      state.balance.usd -= totalCost;
    } else {
      const usdPortion = state.balance.usd;
      const vaultPortion = totalCost - usdPortion;
      state.balance.usd = 0;
      state.balance.vault -= vaultPortion;
      console.log(`[BacktestEngine] Using vault funds:`, {
        totalCost,
        usdUsed: usdPortion,
        vaultUsed: vaultPortion,
        remainingVault: state.balance.vault
      });
    }
    state.balance.btcPositions += size;
    
    console.log(`Buy executed: ${size.toFixed(6)} BTC @ $${executionPrice.toFixed(2)}, btcPositions: ${state.balance.btcPositions.toFixed(6)}`);

    // Create position
    const position = {
      entryPrice: executionPrice,
      entryTime: candle.time,
      size: size,
      type: 'long' as const,
      metadata: signal.metadata
    };

    this.strategy.addPosition(position);

    // Record trade
    const trade: Trade = {
      id: `trade-${this.trades.length + 1}`,
      timestamp: candle.time,
      type: 'buy',
      price: executionPrice,
      size: size,
      value: cost,
      fee: netFee,
      grossFee: grossFee,
      feeRebate: feeRebate,
      position: position,
      reason: signal.reason
    };

    this.trades.push(trade);
    console.log(`Trade recorded: ${trade.type} at timestamp ${trade.timestamp} (${new Date(trade.timestamp * 1000).toISOString()})`);
    
    // Update strategy state after trade
    this.strategy.setState(state);
  }

  private processSellSignal(signal: any, candle: CandleData, state: StrategyState): void {
    const size = signal.size || this.strategy.getTotalPositionSize();
    if (size <= 0) return;
    
    // Double-check we have enough BTC to sell
    if (size > state.balance.btcPositions) {
      console.error(`Critical: Attempted to sell ${size.toFixed(6)} BTC but only have ${state.balance.btcPositions.toFixed(6)} BTC`);
      return;
    }

    // Apply slippage
    const executionPrice = candle.close * (1 - this.config.slippage / 100);
    const proceeds = size * executionPrice;
    
    // Use taker fee for market orders (sells are typically market orders in backtesting)
    const feePercent = this.config.takerFeePercent || this.config.feePercent || 0.75;
    const grossFee = proceeds * (feePercent / 100);
    const feeRebate = grossFee * ((this.config.feeRebatePercent || 0) / 100);
    const netFee = grossFee - feeRebate;
    
    const netProceeds = proceeds - netFee;
    this.totalFeesCollected += grossFee;
    this.totalFeeRebates += feeRebate;

    // Calculate profit
    const positions = this.strategy.getPositions();
    let totalCost = 0;
    let remainingSize = size;

    // FIFO position closing
    const closedPositions = [];
    for (const position of positions) {
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

    // Triple compounding profit distribution
    if (profit > 0) {
      // Calculate gross profit (before fees were taken)
      // Fees on the sell + estimated fees that were paid when buying
      const buyFees = totalCost * (feePercent / 100) * (1 - (this.config.feeRebatePercent || 0) / 100);
      const totalFees = netFee + buyFees;
      const grossProfit = profit + totalFees;
      const oneSeventhGross = grossProfit / 7;
      
      // Return principal to USD
      state.balance.usd += totalCost;
      
      // 1/7 of gross to BTC vault
      state.balance.btcVault += oneSeventhGross / executionPrice;
      
      // 1/7 of gross to grow USD balance
      state.balance.usd += oneSeventhGross;
      this.initialBalanceGrowth += oneSeventhGross; // Track growth of initial balance
      
      // Remaining NET profit to vault (5/7 minus fees)
      state.balance.vault += profit - (2 * oneSeventhGross);
      
      console.log(`[BacktestEngine] Profit distribution:`, {
        profit,
        principal: totalCost,
        btcVaultAddition: oneSeventhGross / executionPrice,
        usdGrowthAddition: oneSeventhGross,
        vaultAddition: profit - (2 * oneSeventhGross),
        newUsdBalance: state.balance.usd,
        newVaultBalance: state.balance.vault,
        totalInitialBalanceGrowth: this.initialBalanceGrowth
      });
    } else {
      // Loss - return all proceeds to USD
      state.balance.usd += netProceeds;
      console.log(`[BacktestEngine] Loss - returning proceeds to USD:`, {
        loss: profit,
        netProceeds,
        newUsdBalance: state.balance.usd
      });
    }

    state.balance.btcPositions -= size;
    
    console.log(`Sell executed: ${size.toFixed(6)} BTC @ $${executionPrice.toFixed(2)}, btcPositions: ${state.balance.btcPositions.toFixed(6)}, profit: $${profit.toFixed(2)}`);

    // Remove closed positions
    closedPositions.forEach(p => this.strategy.removePosition(p));
    
    // If this was a complete exit, ensure all positions are cleared
    if (signal.metadata?.isCompleteExit && state.balance.btcPositions <= 0.0000001) {
      console.log('[BacktestEngine] Complete exit detected - clearing all strategy positions');
      // Clear all remaining positions from strategy
      const remainingPositions = this.strategy.getPositions();
      remainingPositions.forEach(p => this.strategy.removePosition(p));
    }

    // Record trade
    const trade: Trade = {
      id: `trade-${this.trades.length + 1}`,
      timestamp: candle.time,
      type: 'sell',
      price: executionPrice,
      size: size,
      value: proceeds,
      fee: netFee,
      grossFee: grossFee,
      feeRebate: feeRebate,
      profit: profit,
      profitPercent: profitPercent,
      reason: signal.reason
    };

    this.trades.push(trade);
    console.log(`Trade recorded: ${trade.type} at timestamp ${trade.timestamp} (${new Date(trade.timestamp * 1000).toISOString()})`);
    
    // Update strategy state after trade
    this.strategy.setState(state);
  }

  private updateEquityHistory(candle: CandleData, state: StrategyState): void {
    const btcPositionsValue = state.balance.btcPositions * candle.close;
    const btcVaultValue = state.balance.btcVault * candle.close;
    const totalBtcValue = btcPositionsValue + btcVaultValue;
    const totalValue = state.balance.usd + totalBtcValue + state.balance.vault;

    // Update peak and drawdown
    if (totalValue > this.peakValue) {
      this.peakValue = totalValue;
    }
    const drawdown = ((this.peakValue - totalValue) / this.peakValue) * 100;
    if (drawdown > this.maxDrawdown) {
      this.maxDrawdown = drawdown;
    }

    this.equityHistory.push({
      timestamp: candle.time,
      value: totalValue,
      btcBalance: state.balance.btcVault + state.balance.btcPositions,
      usdBalance: state.balance.usd,
      vaultBalance: state.balance.vault
    });

    // Track chart data
    this.vaultGrowthHistory.push({ time: candle.time, value: state.balance.vault });
    this.btcGrowthHistory.push({ time: candle.time, value: btcVaultValue }); // Store BTC vault value in USD
    this.drawdownHistory.push({ time: candle.time, value: drawdown });
  }

  private calculateMetrics(state: StrategyState, lastPrice: number): BacktestResult['metrics'] {
    const totalBtcValue = (state.balance.btcVault + state.balance.btcPositions) * lastPrice;
    const totalValue = state.balance.usd + totalBtcValue + state.balance.vault;
    const totalReturn = totalValue - this.config.initialBalance;
    const totalReturnPercent = (totalReturn / this.config.initialBalance) * 100;

    const winningTrades = this.trades.filter(t => t.type === 'sell' && (t.profit || 0) > 0).length;
    const losingTrades = this.trades.filter(t => t.type === 'sell' && (t.profit || 0) < 0).length;
    const totalTrades = this.trades.filter(t => t.type === 'sell').length;
    const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;

    const wins = (this.trades || []).filter(t => t.type === 'sell' && (t.profit || 0) > 0).map(t => t.profit || 0);
    const losses = (this.trades || []).filter(t => t.type === 'sell' && (t.profit || 0) < 0).map(t => Math.abs(t.profit || 0));
    
    const averageWin = wins.length > 0 ? wins.reduce((a, b) => a + b, 0) / wins.length : 0;
    const averageLoss = losses.length > 0 ? losses.reduce((a, b) => a + b, 0) / losses.length : 0;
    const profitFactor = averageLoss > 0 ? averageWin / averageLoss : averageWin > 0 ? Infinity : 0;

    // Calculate Sharpe ratio (simplified)
    const returns = [];
    for (let i = 1; i < this.equityHistory.length; i++) {
      const dailyReturn = (this.equityHistory[i].value - this.equityHistory[i-1].value) / this.equityHistory[i-1].value;
      returns.push(dailyReturn);
    }
    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const stdDev = Math.sqrt(returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length);
    const sharpeRatio = stdDev > 0 ? (avgReturn * 365) / (stdDev * Math.sqrt(365)) : 0;

    // Calculate average hold time
    const holdTimes = [];
    const buyTrades = this.trades.filter(t => t.type === 'buy');
    const sellTrades = this.trades.filter(t => t.type === 'sell');
    
    for (let i = 0; i < Math.min(buyTrades.length, sellTrades.length); i++) {
      holdTimes.push(sellTrades[i].timestamp - buyTrades[i].timestamp);
    }
    const averageHoldTime = holdTimes.length > 0 ? holdTimes.reduce((a, b) => a + b, 0) / holdTimes.length : 0;

    // Calculate additional metrics
    const avgPositionSize = buyTrades.length > 0 
      ? buyTrades.reduce((sum, t) => sum + t.value, 0) / buyTrades.length 
      : 0;

    // Calculate trading frequency (config times are in seconds)
    const timeSpanDays = (this.config.endTime - this.config.startTime) / (60 * 60 * 24);
    const tradesPerDay = this.trades.length / timeSpanDays;
    const tradesPerWeek = tradesPerDay * 7;
    const tradesPerMonth = tradesPerDay * 30;

    // Fees as percent of profit
    const grossProfit = wins.reduce((a, b) => a + b, 0);
    const feesAsPercentOfProfit = grossProfit > 0 ? (this.totalFeesCollected / grossProfit) * 100 : 0;

    // Calculate CAGR for vault (starts at 0, so use total return approach)
    const years = timeSpanDays / 365;
    const vaultCAGR = years > 0 && state.balance.vault > 0
      ? (Math.pow(1 + (state.balance.vault / this.config.initialBalance), 1 / years) - 1) * 100
      : 0;

    // BTC growth percent (infinite since we start with 0 BTC)
    const btcGrowthPercent = state.balance.btcVault > 0 ? Infinity : 0;

    // Calculate consecutive losses
    let maxConsecutiveLosses = 0;
    let currentConsecutiveLosses = 0;
    for (const trade of this.trades) {
      if (trade.type === 'sell' && (trade.profit || 0) < 0) {
        currentConsecutiveLosses++;
        maxConsecutiveLosses = Math.max(maxConsecutiveLosses, currentConsecutiveLosses);
      } else if (trade.type === 'sell' && (trade.profit || 0) > 0) {
        currentConsecutiveLosses = 0;
      }
    }

    // Risk reward ratio
    const riskRewardRatio = averageLoss > 0 ? averageWin / averageLoss : 0;

    return {
      totalTrades: this.trades.length,
      winningTrades,
      losingTrades,
      winRate,
      totalReturn,
      totalReturnPercent,
      maxDrawdown: this.maxDrawdown,
      maxDrawdownPercent: this.maxDrawdown,
      sharpeRatio,
      profitFactor,
      averageWin,
      averageLoss,
      averageHoldTime: averageHoldTime / 3600, // Convert seconds to hours
      vaultBalance: state.balance.vault,
      btcGrowth: state.balance.btcVault,
      // New metrics
      avgPositionSize,
      tradesPerDay,
      tradesPerWeek,
      tradesPerMonth,
      totalFees: this.totalFeesCollected,
      feesAsPercentOfProfit,
      vaultCAGR,
      btcGrowthPercent,
      maxConsecutiveLosses,
      riskRewardRatio,
      // Initial balance growth metrics
      initialBalanceGrowth: this.initialBalanceGrowth,
      initialBalanceGrowthPercent: (this.initialBalanceGrowth / this.config.initialBalance) * 100,
      finalTradingBalance: state.balance.usd,
      totalFeeRebates: this.totalFeeRebates,
      netFeesAfterRebates: this.totalFeesCollected - this.totalFeeRebates
    };
  }

  private generateChartData(): BacktestResult['chartData'] {
    // Generate trade distribution data
    const tradeDistribution = {
      daily: new Map<string, number>(),
      weekly: new Map<string, number>(),
      monthly: new Map<string, number>()
    };

    for (const trade of this.trades) {
      const date = new Date(trade.timestamp * 1000); // Convert seconds to milliseconds
      
      // Daily
      const dayKey = date.toISOString().split('T')[0];
      tradeDistribution.daily.set(dayKey, (tradeDistribution.daily.get(dayKey) || 0) + 1);
      
      // Weekly
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay());
      const weekKey = weekStart.toISOString().split('T')[0];
      tradeDistribution.weekly.set(weekKey, (tradeDistribution.weekly.get(weekKey) || 0) + 1);
      
      // Monthly
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      tradeDistribution.monthly.set(monthKey, (tradeDistribution.monthly.get(monthKey) || 0) + 1);
    }

    return {
      vaultGrowth: this.vaultGrowthHistory || [],
      btcGrowth: this.btcGrowthHistory || [],
      equityCurve: (this.equityHistory || []).map(e => ({ time: e.timestamp, value: e.value })),
      drawdown: this.drawdownHistory || [],
      tradeDistribution
    };
  }
}