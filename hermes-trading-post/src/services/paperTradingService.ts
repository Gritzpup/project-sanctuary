import { Strategy } from '../strategies/base/Strategy';
import { CandleData, Trade, StrategyState, Signal } from '../strategies/base/StrategyTypes';
import { Writable, writable } from 'svelte/store';

export interface PaperTradingState {
  isRunning: boolean;
  strategy: Strategy | null;
  balance: {
    usd: number;
    btc: number;
    vault: number;
  };
  trades: Trade[];
  currentSignal: Signal | null;
  performance: {
    totalValue: number;
    pnl: number;
    pnlPercent: number;
    winRate: number;
    totalTrades: number;
  };
  lastUpdate: number;
}

class PaperTradingService {
  private state: Writable<PaperTradingState>;
  private candles: CandleData[] = [];
  private initialBalance: number = 10000;
  private feePercent: number = 0.1;

  constructor() {
    this.state = writable<PaperTradingState>({
      isRunning: false,
      strategy: null,
      balance: {
        usd: this.initialBalance,
        btc: 0,
        vault: 0
      },
      trades: [],
      currentSignal: null,
      performance: {
        totalValue: this.initialBalance,
        pnl: 0,
        pnlPercent: 0,
        winRate: 0,
        totalTrades: 0
      },
      lastUpdate: Date.now()
    });
  }

  getState(): Writable<PaperTradingState> {
    return this.state;
  }

  startStrategy(strategy: Strategy, initialBalance: number = 10000): void {
    this.initialBalance = initialBalance;
    
    // Initialize strategy state
    const strategyState: StrategyState = {
      positions: [],
      balance: {
        usd: initialBalance,
        btc: 0,
        vault: 0
      }
    };
    
    strategy.setState(strategyState);

    this.state.update(s => ({
      ...s,
      isRunning: true,
      strategy,
      balance: { ...strategyState.balance },
      trades: [],
      currentSignal: null,
      performance: {
        totalValue: initialBalance,
        pnl: 0,
        pnlPercent: 0,
        winRate: 0,
        totalTrades: 0
      },
      lastUpdate: Date.now()
    }));
  }

  stopStrategy(): void {
    this.state.update(s => ({
      ...s,
      isRunning: false,
      currentSignal: null
    }));
  }

  resetStrategy(): void {
    this.state.update(s => ({
      ...s,
      isRunning: false,
      strategy: null,
      balance: {
        usd: this.initialBalance,
        btc: 0,
        vault: 0
      },
      trades: [],
      currentSignal: null,
      performance: {
        totalValue: this.initialBalance,
        pnl: 0,
        pnlPercent: 0,
        winRate: 0,
        totalTrades: 0
      },
      lastUpdate: Date.now()
    }));
  }

  updateCandles(candles: CandleData[]): void {
    this.candles = candles;
    
    // Process latest candle if strategy is running
    this.state.update(state => {
      if (!state.isRunning || !state.strategy || candles.length === 0) {
        return state;
      }

      const currentPrice = candles[candles.length - 1].close;
      const requiredData = state.strategy.getRequiredHistoricalData();
      
      if (candles.length < requiredData) {
        return state;
      }

      // Get strategy signal
      const signal = state.strategy.analyze(candles, currentPrice);
      
      // Process signal if changed
      if (signal.type !== 'hold' && (!state.currentSignal || signal.type !== state.currentSignal.type)) {
        const newState = this.processSignal(signal, currentPrice, state);
        return {
          ...newState,
          currentSignal: signal,
          lastUpdate: Date.now()
        };
      }

      // Update performance metrics
      const totalValue = state.balance.usd + (state.balance.btc * currentPrice) + state.balance.vault;
      const pnl = totalValue - this.initialBalance;
      const pnlPercent = (pnl / this.initialBalance) * 100;

      return {
        ...state,
        currentSignal: signal,
        performance: {
          ...state.performance,
          totalValue,
          pnl,
          pnlPercent
        },
        lastUpdate: Date.now()
      };
    });
  }

  private processSignal(signal: Signal, currentPrice: number, state: PaperTradingState): PaperTradingState {
    if (!state.strategy) return state;

    const newState = { ...state };
    const strategyState = state.strategy.getState();

    if (signal.type === 'buy') {
      const size = state.strategy.calculatePositionSize(strategyState.balance.usd, signal, currentPrice);
      if (size <= 0) return state;

      const cost = size * currentPrice;
      const fee = cost * (this.feePercent / 100);
      const totalCost = cost + fee;

      if (totalCost > strategyState.balance.usd) return state;

      // Execute buy
      strategyState.balance.usd -= totalCost;
      strategyState.balance.btc += size;
      newState.balance = { ...strategyState.balance };

      // Create position
      const position = {
        entryPrice: currentPrice,
        entryTime: Date.now() / 1000,
        size: size,
        type: 'long' as const,
        metadata: signal.metadata
      };

      state.strategy.addPosition(position);

      // Record trade
      const trade: Trade = {
        id: `trade-${newState.trades.length + 1}`,
        timestamp: Date.now() / 1000,
        type: 'buy',
        price: currentPrice,
        size: size,
        value: cost,
        fee: fee,
        reason: signal.reason
      };

      newState.trades = [...newState.trades, trade];
    }
    else if (signal.type === 'sell') {
      const size = signal.size || state.strategy.getTotalPositionSize();
      if (size <= 0) return state;

      const proceeds = size * currentPrice;
      const fee = proceeds * (this.feePercent / 100);
      const netProceeds = proceeds - fee;

      // Calculate profit
      const positions = state.strategy.getPositions();
      let totalCost = 0;
      let remainingSize = size;
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
        const allocation = state.strategy.allocateProfits(profit);
        strategyState.balance.vault += allocation.vault;
        strategyState.balance.btc += allocation.btc / currentPrice;
        strategyState.balance.usd += netProceeds - allocation.vault;
      } else {
        strategyState.balance.usd += netProceeds;
      }

      strategyState.balance.btc -= size;
      newState.balance = { ...strategyState.balance };

      // Remove closed positions
      closedPositions.forEach(p => state.strategy!.removePosition(p));

      // Record trade
      const trade: Trade = {
        id: `trade-${newState.trades.length + 1}`,
        timestamp: Date.now() / 1000,
        type: 'sell',
        price: currentPrice,
        size: size,
        value: proceeds,
        fee: fee,
        profit: profit,
        profitPercent: profitPercent,
        reason: signal.reason
      };

      newState.trades = [...newState.trades, trade];
    }

    // Update performance
    const totalValue = newState.balance.usd + (newState.balance.btc * currentPrice) + newState.balance.vault;
    const pnl = totalValue - this.initialBalance;
    const pnlPercent = (pnl / this.initialBalance) * 100;
    
    const sellTrades = newState.trades.filter(t => t.type === 'sell');
    const winningTrades = sellTrades.filter(t => (t.profit || 0) > 0).length;
    const winRate = sellTrades.length > 0 ? (winningTrades / sellTrades.length) * 100 : 0;

    newState.performance = {
      totalValue,
      pnl,
      pnlPercent,
      winRate,
      totalTrades: newState.trades.length
    };

    return newState;
  }

  // Manual trading functions for UI
  manualBuy(amount: number): void {
    this.state.update(state => {
      if (this.candles.length === 0) return state;
      
      const currentPrice = this.candles[this.candles.length - 1].close;
      const size = amount / currentPrice;
      const fee = amount * (this.feePercent / 100);
      const totalCost = amount + fee;

      if (totalCost > state.balance.usd) return state;

      const newState = { ...state };
      newState.balance.usd -= totalCost;
      newState.balance.btc += size;

      const trade: Trade = {
        id: `trade-${newState.trades.length + 1}`,
        timestamp: Date.now() / 1000,
        type: 'buy',
        price: currentPrice,
        size: size,
        value: amount,
        fee: fee,
        reason: 'Manual buy'
      };

      newState.trades = [...newState.trades, trade];

      // Update performance
      const totalValue = newState.balance.usd + (newState.balance.btc * currentPrice) + newState.balance.vault;
      const pnl = totalValue - this.initialBalance;
      const pnlPercent = (pnl / this.initialBalance) * 100;

      newState.performance = {
        ...newState.performance,
        totalValue,
        pnl,
        pnlPercent,
        totalTrades: newState.trades.length
      };

      return newState;
    });
  }

  manualSell(amount: number): void {
    this.state.update(state => {
      if (this.candles.length === 0) return state;
      
      const currentPrice = this.candles[this.candles.length - 1].close;
      const size = amount / currentPrice;

      if (size > state.balance.btc) return state;

      const proceeds = amount;
      const fee = proceeds * (this.feePercent / 100);
      const netProceeds = proceeds - fee;

      const newState = { ...state };
      newState.balance.usd += netProceeds;
      newState.balance.btc -= size;

      const trade: Trade = {
        id: `trade-${newState.trades.length + 1}`,
        timestamp: Date.now() / 1000,
        type: 'sell',
        price: currentPrice,
        size: size,
        value: proceeds,
        fee: fee,
        reason: 'Manual sell'
      };

      newState.trades = [...newState.trades, trade];

      // Update performance
      const totalValue = newState.balance.usd + (newState.balance.btc * currentPrice) + newState.balance.vault;
      const pnl = totalValue - this.initialBalance;
      const pnlPercent = (pnl / this.initialBalance) * 100;

      newState.performance = {
        ...newState.performance,
        totalValue,
        pnl,
        pnlPercent,
        totalTrades: newState.trades.length
      };

      return newState;
    });
  }
}

// Export singleton instance
export const paperTradingService = new PaperTradingService();