/**
 * @file paperTestService.ts
 * @description Main paper test service that orchestrates all components
 */

import type { CandleData } from '../../../types/coinbase';
import type { PaperTestOptions, PaperTestResults } from './types';
import { PaperTestStateManager } from './stateManager';
import { TradeExecutor } from './tradeExecutor';
import { ChartManager } from './chartManager';
import { SignalProcessor } from './signalProcessor';

export class PaperTestService {
  private stateManager: PaperTestStateManager;
  private tradeExecutor: TradeExecutor;
  private chartManager: ChartManager;
  private signalProcessor: SignalProcessor;

  constructor() {
    this.stateManager = new PaperTestStateManager();
    this.tradeExecutor = new TradeExecutor(this.stateManager);
    this.chartManager = new ChartManager(this.stateManager);
    this.signalProcessor = new SignalProcessor(this.stateManager, this.tradeExecutor);
  }

  async start(options: PaperTestOptions): Promise<void> {
    if (this.stateManager.isRunning()) return;
    
    this.stateManager.initializeForTest(options);
    
    try {
      // Set the paper-test instance as active
      options.dataFeed.setActiveInstance('paper-test');
      
      // Load historical data for the selected date
      const startOfDay = new Date(options.date);
      startOfDay.setUTCHours(0, 0, 0, 0);
      const endOfDay = new Date(options.date);
      endOfDay.setUTCHours(23, 59, 59, 999);
      
      this.stateManager.log('Paper Test date range:', {
        selectedDate: options.date.toLocaleDateString(),
        startOfDay: startOfDay.toString(),
        endOfDay: endOfDay.toString(),
        startUTC: startOfDay.toISOString(),
        endUTC: endOfDay.toISOString()
      });
      
      const candles = await options.dataFeed.getHistoricalData(
        'BTC-USD',
        startOfDay,
        endOfDay,
        options.granularity
      );
      
      if (!candles || candles.length === 0) {
        throw new Error('No historical data available for the selected date');
      }
      
      this.stateManager.setCandles(candles);
      this.stateManager.log(`Paper Test: Loaded ${candles.length} candles for ${options.date.toLocaleDateString()}`);
      
      // Display initial candles on chart
      this.chartManager.displayInitialCandles(options);
      
      // Start the simulation
      this.runSimulation(options);
      
    } catch (error) {
      console.error('Paper Test Error:', error);
      this.stateManager.stop();
      throw error;
    }
  }

  private runSimulation(options: PaperTestOptions): void {
    const state = this.stateManager.getState();
    const playbackState = this.stateManager.getPlaybackState();
    
    this.stateManager.setAnimationStartTime(Date.now());
    this.stateManager.resetTotalElapsed();
    
    let lastUpdateTime = 0;
    const WINDOW_SIZE = 60;
    
    const step = () => {
      if (!this.stateManager.isRunning()) return;
      
      if (this.stateManager.isPaused()) {
        this.stateManager.setAnimationFrameId(requestAnimationFrame(step));
        return;
      }
      
      const now = Date.now();
      const currentElapsed = now - playbackState.animationStartTime;
      const totalElapsed = playbackState.totalElapsedBeforePause + currentElapsed;
      
      // Calculate progress based on playback speed
      const baseDuration = this.stateManager.getBaseDuration();
      const adjustedDuration = baseDuration / playbackState.playbackSpeed;
      const progress = Math.min(totalElapsed / adjustedDuration, 1);
      
      // Update progress callback
      if (options.onProgress) {
        const progressPercent = progress * 100;
        if (Math.floor(progressPercent / 5) > Math.floor(state.lastLoggedProgress / 5)) {
          this.stateManager.log(`Paper Test Progress: ${progressPercent.toFixed(1)}%`);
          state.lastLoggedProgress = progressPercent;
        }
        options.onProgress(progressPercent, state.currentSimTime);
      }
      
      // Process candles based on progress
      while (state.currentCandleIndex < state.candles.length) {
        const expectedIndex = Math.floor(progress * state.candles.length);
        if (state.currentCandleIndex > expectedIndex) break;
        
        const candle = state.candles[state.currentCandleIndex];
        this.stateManager.updateCurrentSimTime(candle.time);
        
        // Log candle details in debug mode
        if (state.currentCandleIndex % 10 === 0) {
          this.stateManager.log(`Paper Test Candle: #${state.currentCandleIndex + 1}/${state.candles.length}`);
          this.stateManager.log(`  - Candle time: ${new Date(candle.time * 1000).toISOString()} (Unix: ${candle.time})`);
          this.stateManager.log(`  - Sim time: ${new Date(state.currentSimTime * 1000).toISOString()} (Unix: ${Math.floor(state.currentSimTime)})`);
          this.stateManager.log(`  - Price: $${candle.close.toFixed(2)} (O:${candle.open.toFixed(2)} H:${candle.high.toFixed(2)} L:${candle.low.toFixed(2)})`);
        }
        
        // Notify about new candle
        if (options.onCandle) {
          options.onCandle(candle);
        }
        
        // Process candle for trading
        this.signalProcessor.processCandle(candle, options);
        
        this.stateManager.incrementCandleIndex();
      }
      
      // Update chart display
      if (now - lastUpdateTime > 16) { // Update every 16ms for smoother animation
        this.chartManager.updateChartDisplay(options, progress);
        lastUpdateTime = now;
      }
      
      if (progress < 1) {
        this.stateManager.setAnimationFrameId(requestAnimationFrame(step));
      } else {
        this.complete(options);
      }
    };
    
    this.stateManager.setAnimationFrameId(requestAnimationFrame(step));
  }

  private complete(options: PaperTestOptions): void {
    const state = this.stateManager.getState();
    
    this.stateManager.log(`Paper Test: Simulation completed with ${state.trades.length} trades`);
    
    // Set final chart state
    this.chartManager.setFinalChartState(options);
    
    // Calculate results
    const results = this.calculateResults();
    
    this.stateManager.stop();
    
    if (options.onComplete) {
      options.onComplete(results);
    }
  }

  private calculateResults(): PaperTestResults {
    const state = this.stateManager.getState();
    const initialBalance = state.currentOptions?.initialBalance || 0;
    
    const sellTrades = state.trades.filter(t => t.type === 'sell');
    const winningTrades = sellTrades.filter(t => {
      // Calculate profit for each sell trade
      const buyTrade = state.trades.find(buy => 
        buy.type === 'buy' && buy.timestamp <= t.timestamp
      );
      if (!buyTrade) return false;
      
      const profit = (t.price - buyTrade.price) * t.amount;
      return profit > 0;
    });
    
    const winRate = sellTrades.length > 0 ? (winningTrades.length / sellTrades.length) * 100 : 0;
    const finalBalance = state.balance + (state.btcBalance * (state.candles[state.candles.length - 1]?.close || 0));
    const totalReturn = finalBalance - initialBalance;
    
    // Calculate max drawdown (simplified)
    let peak = initialBalance;
    let maxDrawdown = 0;
    
    for (let i = 0; i < state.trades.length; i++) {
      const currentBalance = this.calculateBalanceAtTrade(i);
      if (currentBalance > peak) {
        peak = currentBalance;
      } else {
        const drawdown = ((peak - currentBalance) / peak) * 100;
        maxDrawdown = Math.max(maxDrawdown, drawdown);
      }
    }
    
    return {
      totalTrades: state.trades.length,
      winRate,
      totalReturn,
      finalBalance,
      trades: state.trades,
      maxDrawdown
    };
  }

  private calculateBalanceAtTrade(tradeIndex: number): number {
    const state = this.stateManager.getState();
    const initialBalance = state.currentOptions?.initialBalance || 0;
    
    let balance = initialBalance;
    let btcBalance = 0;
    
    for (let i = 0; i <= tradeIndex; i++) {
      const trade = state.trades[i];
      if (trade.type === 'buy') {
        balance -= trade.total;
        btcBalance += trade.amount;
      } else {
        balance += trade.total;
        btcBalance -= trade.amount;
      }
    }
    
    const lastPrice = state.candles[state.currentCandleIndex - 1]?.close || 0;
    return balance + (btcBalance * lastPrice);
  }

  // Control methods
  stop(): void {
    this.stateManager.stop();
  }

  pause(): void {
    this.stateManager.pause();
  }

  resume(): void {
    this.stateManager.resume();
  }

  setPlaybackSpeed(speed: number): void {
    if (this.stateManager.isPaused()) {
      this.stateManager.setPlaybackSpeed(speed);
    } else {
      const wasRunning = !this.stateManager.isPaused();
      if (wasRunning) {
        this.pause();
        this.stateManager.setPlaybackSpeed(speed);
        this.resume();
      }
    }
  }

  stepForward(): void {
    if (!this.stateManager.isRunning() || !this.stateManager.isPaused() || !this.stateManager.getState().currentOptions) return;
    
    const state = this.stateManager.getState();
    const options = state.currentOptions!;
    
    // Process one candle forward
    if (state.currentCandleIndex < state.candles.length) {
      const candle = state.candles[state.currentCandleIndex];
      
      // Update current simulation time
      this.stateManager.updateCurrentSimTime(candle.time);
      
      // Notify about new candle
      if (options.onCandle) {
        options.onCandle(candle);
      }
      
      // Process candle for trading
      this.signalProcessor.processCandle(candle, options);
      
      this.stateManager.incrementCandleIndex();
      
      // Update progress
      const progress = this.stateManager.getCurrentProgress();
      if (options.onProgress) {
        options.onProgress(progress * 100, state.currentSimTime);
      }
      
      // Update chart display
      this.chartManager.updateMarkersForStep(options);
    }
  }

  clearAllTrades(): void {
    this.stateManager.resetTrades();
    
    // Reset strategy state
    const state = this.stateManager.getState();
    if (state.currentOptions) {
      this.signalProcessor.resetStrategyState(state.currentOptions);
    }
    
    this.stateManager.log('Paper Test: All trades and positions cleared');
  }

  // Status getters
  isActive(): boolean {
    return this.stateManager.isRunning();
  }

  isPausedState(): boolean {
    return this.stateManager.isPaused();
  }

  getPlaybackSpeed(): number {
    return this.stateManager.getPlaybackSpeed();
  }
}