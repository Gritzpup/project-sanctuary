import { Strategy } from '../strategies/base/Strategy';
import type { CandleData, Trade, BacktestResult, StrategyState } from '../strategies/base/StrategyTypes';

export interface BacktestConfig {
  initialBalance: number;
  startTime: number;
  endTime: number;
  feePercent: number;
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

  constructor(strategy: Strategy, config: BacktestConfig) {
    this.strategy = strategy;
    this.config = config;
  }

  async runBacktest(candles: CandleData[]): Promise<BacktestResult> {
    // Initialize state
    const state: StrategyState = {
      positions: [],
      balance: {
        usd: this.config.initialBalance,
        btc: 0,
        vault: 0
      }
    };

    this.strategy.setState(state);
    this.trades = [];
    this.equityHistory = [];
    this.peakValue = this.config.initialBalance;
    this.maxDrawdown = 0;

    // Filter candles to backtest period
    const filteredCandles = candles.filter(
      c => c.time >= this.config.startTime && c.time <= this.config.endTime
    );

    // Process each candle
    for (let i = 0; i < filteredCandles.length; i++) {
      const currentCandle = filteredCandles[i];
      const historicalData = filteredCandles.slice(0, i + 1);
      
      // Skip if not enough historical data
      const requiredData = this.strategy.getRequiredHistoricalData();
      if (historicalData.length < requiredData) continue;

      // Get strategy signal
      const signal = this.strategy.analyze(historicalData, currentCandle.close);

      // Process signal
      if (signal.type === 'buy') {
        this.processBuySignal(signal, currentCandle, state);
      } else if (signal.type === 'sell') {
        this.processSellSignal(signal, currentCandle, state);
      }

      // Update equity history
      this.updateEquityHistory(currentCandle, state);
    }

    // Calculate metrics
    const metrics = this.calculateMetrics(state, filteredCandles[filteredCandles.length - 1].close);

    return {
      trades: this.trades,
      metrics,
      equity: this.equityHistory
    };
  }

  private processBuySignal(signal: any, candle: CandleData, state: StrategyState): void {
    // Calculate position size
    const size = this.strategy.calculatePositionSize(state.balance.usd, signal, candle.close);
    if (size <= 0) return;

    // Apply slippage
    const executionPrice = candle.close * (1 + this.config.slippage / 100);
    const cost = size * executionPrice;
    const fee = cost * (this.config.feePercent / 100);
    const totalCost = cost + fee;

    // Check if we have enough balance
    if (totalCost > state.balance.usd) return;

    // Execute trade
    state.balance.usd -= totalCost;
    state.balance.btc += size;

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
      fee: fee,
      position: position,
      reason: signal.reason
    };

    this.trades.push(trade);
  }

  private processSellSignal(signal: any, candle: CandleData, state: StrategyState): void {
    const size = signal.size || this.strategy.getTotalPositionSize();
    if (size <= 0) return;

    // Apply slippage
    const executionPrice = candle.close * (1 - this.config.slippage / 100);
    const proceeds = size * executionPrice;
    const fee = proceeds * (this.config.feePercent / 100);
    const netProceeds = proceeds - fee;

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

    // Allocate profits
    if (profit > 0) {
      const allocation = this.strategy.allocateProfits(profit);
      state.balance.vault += allocation.vault;
      state.balance.btc += allocation.btc / executionPrice; // Convert to BTC
      state.balance.usd += netProceeds - allocation.vault;
    } else {
      state.balance.usd += netProceeds;
    }

    state.balance.btc -= size;

    // Remove closed positions
    closedPositions.forEach(p => this.strategy.removePosition(p));

    // Record trade
    const trade: Trade = {
      id: `trade-${this.trades.length + 1}`,
      timestamp: candle.time,
      type: 'sell',
      price: executionPrice,
      size: size,
      value: proceeds,
      fee: fee,
      profit: profit,
      profitPercent: profitPercent,
      reason: signal.reason
    };

    this.trades.push(trade);
  }

  private updateEquityHistory(candle: CandleData, state: StrategyState): void {
    const btcValue = state.balance.btc * candle.close;
    const totalValue = state.balance.usd + btcValue + state.balance.vault;

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
      btcBalance: state.balance.btc,
      usdBalance: state.balance.usd,
      vaultBalance: state.balance.vault
    });
  }

  private calculateMetrics(state: StrategyState, lastPrice: number): BacktestResult['metrics'] {
    const totalValue = state.balance.usd + (state.balance.btc * lastPrice) + state.balance.vault;
    const totalReturn = totalValue - this.config.initialBalance;
    const totalReturnPercent = (totalReturn / this.config.initialBalance) * 100;

    const winningTrades = this.trades.filter(t => t.type === 'sell' && (t.profit || 0) > 0).length;
    const losingTrades = this.trades.filter(t => t.type === 'sell' && (t.profit || 0) < 0).length;
    const totalTrades = this.trades.filter(t => t.type === 'sell').length;
    const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;

    const wins = this.trades.filter(t => t.type === 'sell' && (t.profit || 0) > 0).map(t => t.profit || 0);
    const losses = this.trades.filter(t => t.type === 'sell' && (t.profit || 0) < 0).map(t => Math.abs(t.profit || 0));
    
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
      averageHoldTime: averageHoldTime / 3600, // Convert to hours
      vaultBalance: state.balance.vault,
      btcGrowth: state.balance.btc
    };
  }
}