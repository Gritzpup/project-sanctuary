/**
 * @file backtestingEngine.ts
 * @description Main backtesting engine that orchestrates all components
 */

import { Strategy } from '../../../strategies/base/Strategy';
import type { CandleData, BacktestResult, StrategyState, VaultAllocationConfig } from '../../../types/strategy/strategy';
import { CompoundEngine } from '../../trading/CompoundEngine';
import { OpportunityDetector } from '../../trading/OpportunityDetector';
import { VAULT_ALLOCATION } from '../../../constants';

import { BacktestStateManager } from './stateManager';
import { TradeExecutor } from './tradeExecutor';
import { ProfitDistributor } from './profitDistributor';
import { MetricsCalculator } from './metricsCalculator';
import type { BacktestConfig } from './types';

export class BacktestingEngine {
  private strategy: Strategy;
  private config: BacktestConfig;
  private stateManager: BacktestStateManager;
  private tradeExecutor: TradeExecutor;
  private profitDistributor: ProfitDistributor;
  private metricsCalculator: MetricsCalculator;
  private compoundEngine: CompoundEngine;
  private opportunityDetector: OpportunityDetector | null = null;

  constructor(strategy: Strategy, config: BacktestConfig) {
    this.strategy = strategy;
    this.config = config;
    
    // Initialize state manager
    this.stateManager = new BacktestStateManager(config);
    
    // Initialize compound engine
    const strategyConfig = this.strategy.getConfig();
    const vaultConfig: VaultAllocationConfig = strategyConfig.vaultConfig || {
      btcVaultPercent: VAULT_ALLOCATION.BTC_VAULT_PERCENT,
      usdGrowthPercent: VAULT_ALLOCATION.USD_GROWTH_PERCENT,
      usdcVaultPercent: VAULT_ALLOCATION.USDC_VAULT_PERCENT,
      compoundFrequency: 'trade',
      minCompoundAmount: 0.01,
      autoCompound: true
    };
    
    this.compoundEngine = new CompoundEngine(vaultConfig);
    
    // Initialize components
    this.tradeExecutor = new TradeExecutor(config, this.stateManager);
    this.profitDistributor = new ProfitDistributor(this.compoundEngine, this.stateManager);
    this.metricsCalculator = new MetricsCalculator(config, this.compoundEngine);
    
    // Initialize opportunity detector if config provided
    if (strategyConfig.opportunityConfig) {
      this.opportunityDetector = new OpportunityDetector(strategy, strategyConfig.opportunityConfig);
    }
  }

  async runBacktest(candles: CandleData[]): Promise<BacktestResult> {
    // Initialize state
    const state: StrategyState = {
      positions: [],
      balance: {
        usd: this.config.initialBalance,
        btcVault: 0,
        btcPositions: 0,
        vault: 0
      }
    };
    
    try {
      // Reset components
      if (this.strategy.reset) {
        this.strategy.reset();
      }
      
      this.strategy.setState(state);
      this.stateManager.reset();
      
      // Filter candles to backtest period
      const filteredCandles = candles.filter(candle => 
        candle.time >= this.config.startTime && candle.time <= this.config.endTime
      );
      
      // PERF: Disabled - console.log(`[BacktestingEngine] Running backtest with ${filteredCandles.length} candles from ${new Date(this.config.startTime * 1000)} to ${new Date(this.config.endTime * 1000)}`);
      
      // Main backtest loop
      for (let i = 0; i < filteredCandles.length; i++) {
        const candle = filteredCandles[i];
        const currentState = this.strategy.getState();
        
        // Update strategy with current candle
        await this.strategy.updateCandle(candle);
        
        // Get signal from strategy
        const signal = await this.strategy.getSignal(candle);
        
        // Process opportunity detection
        if (this.opportunityDetector && signal && signal.type !== 'hold') {
          const opportunities = await this.opportunityDetector.detectOpportunities(candle, signal);
          opportunities.forEach(opp => this.stateManager.addDetectedOpportunity(opp));
        }
        
        // Execute trades based on signals
        if (signal && signal.type === 'buy' && currentState.balance.usd > 10) {
          this.tradeExecutor.processBuySignal(signal, candle, currentState, this.strategy);
        } else if (signal && signal.type === 'sell' && currentState.balance.btcPositions > 0.00001) {
          const profitData = this.tradeExecutor.processSellSignal(signal, candle, currentState, this.strategy);
          if (profitData) {
            this.profitDistributor.distributeProfit(profitData, candle, currentState);
          }
        }
        
        // Update equity tracking
        this.stateManager.updateEquity(candle, currentState);
        
        // Log progress periodically
        if (i % 1000 === 0) {
          const progress = ((i / filteredCandles.length) * 100).toFixed(1);
          // PERF: Disabled - console.log(`[BacktestingEngine] Progress: ${progress}% (${i}/${filteredCandles.length})`);
        }
      }
      
      // PERF: Disabled - console.log(`[BacktestingEngine] Backtest completed with ${this.stateManager.getState().trades.length} trades`);
      
      // Generate final results
      return this.generateResults(state, filteredCandles[filteredCandles.length - 1]?.close || 0);
      
    } catch (error) {
      // PERF: Disabled - console.error('[BacktestingEngine] Error during backtest:', error);
      throw error;
    }
  }

  private generateResults(finalState: StrategyState, lastPrice: number): BacktestResult {
    const backtestState = this.stateManager.getState();
    
    const metrics = this.metricsCalculator.calculateMetrics(backtestState, finalState, lastPrice);
    const chartData = this.metricsCalculator.generateChartData(backtestState);
    
    return {
      trades: backtestState.trades,
      metrics,
      equity: backtestState.equityHistory,
      chartData
    };
  }
}