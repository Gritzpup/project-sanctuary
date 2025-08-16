/**
 * @file paperTradingService.ts
 * @description Simulates live trading with fake money for strategy testing
 */

import { Strategy } from '../strategies/base/Strategy';
import type { CandleData, Trade, StrategyState, Signal } from '../strategies/base/StrategyTypes';
import { writable, get } from 'svelte/store';
import type { Writable } from 'svelte/store';
import { vaultService } from './vaultService';
import { paperTradingPersistence } from './paperTradingPersistence';
import type { PersistentTradingState } from './paperTradingPersistence';

export interface PaperTradingState {
  isRunning: boolean;
  isPaused?: boolean;
  strategy: Strategy | null;
  balance: {
    usd: number;
    btcVault: number;
    btcPositions: number;
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
  chartData?: {
    recentHigh: number;
    recentLow: number;
    initialTradingPrice: number;
    initialRecentHigh: number;
    initialTradingAngle: number;
    lastTradeTime: number;
  };
}

class PaperTradingService {
  private state: Writable<PaperTradingState>;
  private candles: CandleData[] = [];
  private initialBalance: number = 10000;
  private feePercent: number = 0.1;
  private botId: string | null = null;
  private asset: string = 'BTC';
  private restorationPromise: Promise<boolean> | null = null;
  private savedPositions: any[] | null = null; // Store positions for later restoration
  private instanceId: string;

  constructor(instanceId: string = 'default') {
    this.instanceId = instanceId;
    this.state = writable<PaperTradingState>({
      isRunning: false,
      isPaused: false,
      strategy: null,
      balance: {
        usd: this.initialBalance,
        btcVault: 0,
        btcPositions: 0,
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
      lastUpdate: Date.now(),
      chartData: undefined
    });
    
    // Subscribe to state changes to auto-save
    let saveTimeout: NodeJS.Timeout | null = null;
    this.state.subscribe(state => {
      if (state.isRunning) {
        // Debounce saves to avoid excessive localStorage writes
        if (saveTimeout) clearTimeout(saveTimeout);
        saveTimeout = setTimeout(() => {
          this.saveState();
        }, 100); // Reduced from 1000ms for more responsive saves
      }
    });
    
    // Attempt to restore state immediately on service creation
    // This ensures state is available as soon as the service is created
    this.restorationPromise = this.restoreFromSavedState();
  }

  getState(): Writable<PaperTradingState> {
    return this.state;
  }
  
  getInitialState(): PaperTradingState {
    return {
      isRunning: false,
      isPaused: false,
      strategy: null,
      balance: {
        usd: this.initialBalance,
        btcVault: 0,
        btcPositions: 0,
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
      lastUpdate: Date.now(),
      chartData: undefined
    };
  }
  
  async waitForRestoration(): Promise<void> {
    if (this.restorationPromise) {
      await this.restorationPromise;
    }
  }
  
  private saveState(): void {
    const currentState = get(this.state);
    
    if (!currentState) {
      console.warn('PaperTradingService: Cannot save - no state');
      return;
    }
    
    // We can save even without a strategy if we have trades/positions
    // This is important for custom strategies that load asynchronously
    const strategyName = currentState.strategy?.getName() || 'Unknown';
    const strategyTypeKey = currentState.strategy ? this.getStrategyKey(strategyName) : 'unknown';
    const positions = currentState.strategy?.getState().positions || this.savedPositions || [];
    
    const persistentState: PersistentTradingState = {
      isRunning: currentState.isRunning,
      isPaused: currentState.isPaused || false,
      strategyType: strategyName,
      strategyTypeKey: strategyTypeKey,
      strategyConfig: (currentState.strategy as any)?.config || {},
      balance: currentState.balance,
      positions: positions,
      trades: currentState.trades,
      startTime: currentState.lastUpdate,
      lastUpdateTime: Date.now(),
      chartData: currentState.chartData
    };
    
    console.log('PaperTradingService: Saving state with positions:', positions.length, 'trades:', currentState.trades.length, 'instanceId:', this.instanceId);
    paperTradingPersistence.saveState(persistentState, this.instanceId);
  }
  
  async restoreFromSavedState(): Promise<boolean> {
    // console.log('PaperTradingService: Starting restoration');
    const savedState = paperTradingPersistence.loadState(this.instanceId);
    if (!savedState) {
      // console.log('PaperTradingService: No saved state found');
      return false;
    }
    
    // console.log('PaperTradingService: Found saved state:', {
    //   isRunning: savedState.isRunning,
    //   strategyType: savedState.strategyType,
    //   strategyTypeKey: savedState.strategyTypeKey,
    //   tradesCount: savedState.trades.length,
    //   positionsCount: savedState.positions.length,
    //   balance: savedState.balance
    // });
    
    try {
      // Import strategy classes to recreate strategy
      const strategies = await import('../strategies');
      let strategy: Strategy | null = null;
      
      // Map strategy names to classes
      switch (savedState.strategyType) {
        case 'Reverse Ratio Buying':
          strategy = new strategies.ReverseRatioStrategy(savedState.strategyConfig);
          break;
        case 'Grid Trading':
          strategy = new strategies.GridTradingStrategy(savedState.strategyConfig);
          break;
        case 'RSI Mean Reversion':
          strategy = new strategies.RSIMeanReversionStrategy(savedState.strategyConfig);
          break;
        case 'Dollar Cost Averaging':
          strategy = new strategies.DCAStrategy(savedState.strategyConfig);
          break;
        case 'VWAP Bounce':
          strategy = new strategies.VWAPBounceStrategy(savedState.strategyConfig);
          break;
        case 'Micro Scalping (1H)':
          strategy = new strategies.MicroScalpingStrategy(savedState.strategyConfig);
          break;
        case 'Ultra Micro-Scalping':
          // This is a custom strategy, can't create it here
          console.log('PaperTradingService: Ultra Micro-Scalping is a custom strategy, deferring creation');
          strategy = null;
          break;
        case 'Proper Scalping':
          strategy = new strategies.ProperScalpingStrategy(savedState.strategyConfig);
          break;
        default:
          console.error('Strategy not found:', savedState.strategyType);
          // Don't fail completely - continue restoration without strategy
          console.log('Continuing restoration without strategy to preserve trades and state');
          break;
      }
      
      // Restore strategy state if we have a strategy
      if (strategy) {
        const strategyState: StrategyState = {
          positions: savedState.positions,
          balance: savedState.balance
        };
        strategy.setState(strategyState);
        this.savedPositions = null; // Clear saved positions since they're restored
      } else {
        // Store positions for later restoration when strategy is created
        this.savedPositions = savedState.positions;
        console.log('PaperTradingService: Saved positions for later restoration:', this.savedPositions.length);
      }
      
      // Update our state - restore everything including running state
      this.state.update(s => ({
        ...s,
        isRunning: savedState.isRunning, // Preserve the running state even without strategy
        isPaused: savedState.isPaused || false,
        strategy: strategy || null,
        balance: savedState.balance,
        trades: savedState.trades,
        currentSignal: null,
        performance: {
          totalValue: savedState.balance.usd + savedState.balance.vault,
          pnl: 0,
          pnlPercent: 0,
          winRate: 0,
          totalTrades: savedState.trades.length
        },
        lastUpdate: savedState.lastUpdateTime,
        chartData: savedState.chartData
      }));
      
      // Recalculate performance metrics on next candle update
      // console.log('PaperTradingService: State restored successfully');
      return true;
    } catch (error) {
      console.error('Failed to restore state:', error);
      return false;
    }
  }
  
  getStatus() {
    const currentState = get(this.state);
    
    if (!currentState) {
      return {
        usdBalance: 0,
        btcBalance: 0,
        vaultBalance: 0,
        positions: [],
        trades: [],
        isRunning: false
      };
    }
    
    // If we have saved positions and no strategy, return the saved positions
    const positions = currentState.strategy?.getState().positions || this.savedPositions || [];
    
    return {
      usdBalance: currentState.balance.usd,
      btcBalance: (currentState.balance.btcVault || 0) + (currentState.balance.btcPositions || 0),
      vaultBalance: currentState.balance.vault,
      positions: positions,
      trades: currentState.trades,
      isRunning: currentState.isRunning
    };
  }

  start(strategy: Strategy, symbol: string = 'BTC-USD', initialBalance: number = 10000): void {
    // Check if already running with same strategy - avoid re-initialization
    const currentState = get(this.state);
    if (currentState.isRunning && currentState.strategy && 
        currentState.strategy.getName() === strategy.getName()) {
      console.log('Paper trading already running with same strategy, skipping re-initialization');
      return;
    }
    
    // Check if we have saved positions to restore
    if (this.savedPositions && this.savedPositions.length > 0) {
      console.log('PaperTradingService: Restoring saved positions to strategy:', this.savedPositions.length);
      const strategyState: StrategyState = {
        positions: this.savedPositions,
        balance: currentState.balance
      };
      strategy.setState(strategyState);
      this.savedPositions = null; // Clear saved positions after restoration
      
      // Update state to ensure positions are reflected
      this.state.update(s => ({
        ...s,
        strategy: strategy
      }));
    }
    
    // Extract asset from symbol
    this.asset = symbol.split('-')[0];
    this.initialBalance = initialBalance;
    
    // Initialize strategy state, preserving existing positions if any
    const strategyCurrentState = strategy.getState();
    const hasExistingPositions = strategyCurrentState && strategyCurrentState.positions && strategyCurrentState.positions.length > 0;
    
    const strategyState: StrategyState = {
      positions: hasExistingPositions ? strategyCurrentState.positions : [],
      balance: {
        usd: initialBalance,
        btcVault: strategyCurrentState?.balance?.btcVault || 0,
        btcPositions: strategyCurrentState?.balance?.btcPositions || 0,
        vault: strategyCurrentState?.balance?.vault || 0
      }
    };
    
    strategy.setState(strategyState);

    // Create vault entry for this bot
    const strategyName = strategy.getName();
    const botName = `Paper ${this.asset} - ${strategyName}`;
    
    vaultService.addBot(this.asset, {
      name: botName,
      strategy: this.getStrategyKey(strategyName),
      asset: this.asset,
      status: 'active',
      value: 0, // Starts with 0, will accumulate from profits
      initialDeposit: 0,
      growthPercent: 0,
      totalTrades: 0,
      winRate: 0,
      startedAt: Date.now(),
      deposits: []
    });
    
    // Get the bot ID from the last added bot
    const vaultData = vaultService.getVaultData();
    const assetVaults = vaultData.assets[this.asset]?.vaults || [];
    this.botId = assetVaults[assetVaults.length - 1]?.botId || null;

    // Check if we're resuming an existing session
    const isResuming = currentState.trades && currentState.trades.length > 0;
    
    // Preserve existing trades and performance if resuming
    this.state.update(s => ({
      ...s,
      isRunning: true,
      strategy,
      balance: { ...strategyState.balance },
      trades: isResuming ? s.trades : [],
      currentSignal: s.currentSignal || null,
      performance: isResuming ? s.performance : {
        totalValue: initialBalance,
        pnl: 0,
        pnlPercent: 0,
        winRate: 0,
        totalTrades: 0
      },
      lastUpdate: Date.now()
    }));
  }
  
  private getStrategyKey(strategyName: string): string {
    const mapping: Record<string, string> = {
      'Reverse Ratio Buying': 'reverse-ratio',
      'Grid Trading': 'grid-trading',
      'RSI Mean Reversion': 'rsi-mean-reversion',
      'Dollar Cost Averaging': 'dca',
      'VWAP Bounce': 'vwap-bounce',
      'Micro Scalping (1H)': 'micro-scalping',
      'Proper Scalping': 'proper-scalping',
      'Ultra Micro-Scalping': 'ultra-micro-scalping'
    };
    
    // Check if it's already a strategy key (lowercase with hyphens)
    if (strategyName.match(/^[a-z-]+$/)) {
      return strategyName;
    }
    
    // If not found in mapping, convert to key format (lowercase, spaces to hyphens)
    const key = mapping[strategyName] || strategyName.toLowerCase().replace(/\s+/g, '-');
    console.log(`PaperTradingService: Converted strategy name "${strategyName}" to key "${key}"`);
    return key;
  }

  stop(): void {
    this.stopStrategy();
  }
  
  stopStrategy(clearPersistence: boolean = false): void {
    // Update vault bot status
    if (this.botId) {
      vaultService.updateBotStatus(this.botId, 'stopped');
    }
    
    this.state.update(s => ({
      ...s,
      isRunning: false,
      currentSignal: null
    }));
    
    // Only clear persisted state if explicitly requested (e.g., when resetting)
    if (clearPersistence) {
      paperTradingPersistence.clearState(this.instanceId);
    } else {
      // Save final state before stopping
      this.saveState();
    }
  }

  resetStrategy(): void {
    // Clear persisted state
    paperTradingPersistence.clearState(this.instanceId);
    
    // Reset vault bot if exists
    if (this.botId) {
      vaultService.updateBotStatus(this.botId, 'stopped');
      this.botId = null;
    }
    
    this.state.update(s => ({
      ...s,
      isRunning: false,
      strategy: null,
      balance: {
        usd: this.initialBalance,
        btcVault: 0,
        btcPositions: 0,
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
  
  // Save current state without stopping
  save(): void {
    this.saveState();
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
      const totalBtcValue = ((state.balance.btcVault || 0) + (state.balance.btcPositions || 0)) * currentPrice;
      const totalValue = state.balance.usd + totalBtcValue + state.balance.vault;
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
      // CRITICAL: Calculate position size using total available capital
      // This includes both USD balance and USDC vault (profit storage)
      // Strategies need the full picture to size positions correctly
      const totalAvailable = strategyState.balance.usd + strategyState.balance.vault;
      
      // Let the strategy determine position size based on its rules
      // This could be fixed amounts, percentages, or complex algorithms
      const size = state.strategy.calculatePositionSize(totalAvailable, signal, currentPrice);
      if (size <= 0) return state;

      // Calculate total cost including fees
      const cost = size * currentPrice;
      const fee = cost * (this.feePercent / 100);
      const totalCost = cost + fee;

      // Verify we have sufficient funds
      if (totalCost > totalAvailable) return state;

      // Execute buy with capital priority system:
      // 1. Use USD trading balance first (preserves liquidity)
      // 2. Then tap into vault funds if needed (uses profits)
      if (totalCost <= strategyState.balance.usd) {
        // Simple case: Enough USD available
        strategyState.balance.usd -= totalCost;
      } else {
        // Complex case: Need to use vault funds
        // This allows strategies to reinvest profits automatically
        const fromVault = totalCost - strategyState.balance.usd;
        strategyState.balance.vault -= fromVault;
        strategyState.balance.usd = 0;
      }
      strategyState.balance.btcPositions += size;
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
      
      // Force immediate save after trade
      setTimeout(() => this.saveState(), 0);
    }
    else if (signal.type === 'sell') {
      const size = signal.size || state.strategy.getTotalPositionSize();
      if (size <= 0) return state;
      
      // Validate we have enough BTC to sell
      if (size > strategyState.balance.btcPositions) {
        console.error(`[PaperTrading] Cannot sell ${size.toFixed(6)} BTC - only have ${strategyState.balance.btcPositions.toFixed(6)} BTC available`);
        return state;
      }

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

      // Allocate profits using strategy's vault allocation rules
      if (profit > 0) {
        // Get profit allocation from strategy (default: 85.7% vault, 14.3% BTC)
        // This maintains the 6:1 ratio (6 parts vault, 1 part BTC)
        const allocation = state.strategy.allocateProfits(profit);
        
        // Update vault balances with allocated profits
        // Vault (USDC): Stable profit storage (typically 85.7%)
        strategyState.balance.vault += allocation.vault;
        
        // BTC Vault: Convert profit portion to BTC for long-term holding
        // Formula: USD allocation / current BTC price = BTC amount
        strategyState.balance.btcVault += allocation.btc / currentPrice;
        
        // Return principal + remaining profit to USD trading balance
        // This keeps the principal available for future trades
        strategyState.balance.usd += netProceeds - allocation.vault;
        
        // Sync with vault service for UI display
        // This updates the bot's performance metrics in real-time
        if (this.botId && allocation.vault > 0) {
          const currentVaultData = vaultService.getVaultData();
          const bot = currentVaultData.assets[this.asset]?.vaults.find(v => v.botId === this.botId);
          if (bot) {
            // Add profit to bot's vault value and mark as profit deposit
            vaultService.updateBotValue(this.botId, bot.value + allocation.vault, true);
          }
        }
      } else {
        // Loss scenario: Return all proceeds to USD for capital preservation
        strategyState.balance.usd += netProceeds;
      }

      strategyState.balance.btcPositions -= size;
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
      
      // Force immediate save after trade
      setTimeout(() => this.saveState(), 0);
    }

    // Update performance
    const totalBtcValue = ((newState.balance.btcVault || 0) + (newState.balance.btcPositions || 0)) * currentPrice;
    const totalValue = newState.balance.usd + totalBtcValue + newState.balance.vault;
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
    
    // Update vault service stats
    if (this.botId) {
      vaultService.updateBotStats(this.botId, {
        totalTrades: newState.trades.length,
        winRate: winRate
      });
    }

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
      newState.balance.btcPositions += size;

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
      
      // Force immediate save after manual trade
      setTimeout(() => this.saveState(), 0);

      // Update performance
      const totalBtcValue = ((newState.balance.btcVault || 0) + (newState.balance.btcPositions || 0)) * currentPrice;
    const totalValue = newState.balance.usd + totalBtcValue + newState.balance.vault;
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

      if (size > (state.balance.btcPositions || 0)) return state;

      const proceeds = amount;
      const fee = proceeds * (this.feePercent / 100);
      const netProceeds = proceeds - fee;

      const newState = { ...state };
      newState.balance.usd += netProceeds;
      newState.balance.btcPositions -= size;

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
      
      // Force immediate save after manual trade
      setTimeout(() => this.saveState(), 0);

      // Update performance
      const totalBtcValue = ((newState.balance.btcVault || 0) + (newState.balance.btcPositions || 0)) * currentPrice;
    const totalValue = newState.balance.usd + totalBtcValue + newState.balance.vault;
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
  
  updateChartData(chartData: {
    recentHigh: number;
    recentLow: number;
    initialTradingPrice: number;
    initialRecentHigh: number;
    initialTradingAngle: number;
    lastTradeTime: number;
  }): void {
    this.state.update(state => ({
      ...state,
      chartData
    }));
    // Save state immediately for chart data updates
    this.saveState();
  }
  
  setPaused(isPaused: boolean): void {
    this.state.update(state => ({
      ...state,
      isPaused
    }));
    // Save state immediately for pause state changes
    this.saveState();
  }
  
  // Method to ensure trades are preserved when strategy changes
  preserveTrades(trades: Trade[]): void {
    this.state.update(state => ({
      ...state,
      trades: trades
    }));
  }
  
  setInitialBalance(newBalance: number): void {
    this.initialBalance = newBalance;
    this.state.update(s => ({
      ...s,
      balance: {
        ...s.balance,
        usd: newBalance
      },
      performance: {
        ...s.performance,
        totalValue: newBalance + (s.balance.btcPositions * (s.strategy?.getCurrentPrice?.() || 0)) + s.balance.vault
      }
    }));
    this.saveState();
  }
}

// Export class for type annotations
export { PaperTradingService };

// Export singleton instance
export const paperTradingService = new PaperTradingService();