/**
 * @file BackendStrategyAdapter.ts
 * @description Adapter that allows frontend to use backend strategies
 * Eliminates frontend/backend strategy duplication
 */

import { Strategy } from '../base/Strategy';
import type { CandleData, Position, Signal, StrategyConfig } from '../base/StrategyTypes';
import { BackendAPIService } from '../../services/api/BackendAPIService';

export interface BackendStrategyConfig extends StrategyConfig {
  strategyType: string; // The backend strategy identifier
  backendConfig: Record<string, any>; // Config to send to backend
}

/**
 * Adapter that proxies strategy calls to the backend server
 * This eliminates the need for duplicate strategy implementations
 */
export class BackendStrategyAdapter extends Strategy {
  private backendAPI: BackendAPIService;
  private strategyType: string;
  private backendConfig: Record<string, any>;
  private lastCandles: CandleData[] = [];
  
  constructor(config: BackendStrategyConfig) {
    super(config);
    this.backendAPI = BackendAPIService.getInstance();
    this.strategyType = config.strategyType;
    this.backendConfig = config.backendConfig;
  }
  
  /**
   * Process new candle data by sending to backend
   */
  async processCandle(candle: CandleData): Promise<Signal | null> {
    this.lastCandles.push(candle);
    
    // Keep only recent candles for performance
    if (this.lastCandles.length > 100) {
      this.lastCandles = this.lastCandles.slice(-100);
    }
    
    try {
      // Call backend strategy analysis
      const response = await this.backendAPI.analyzeStrategy({
        strategyType: this.strategyType,
        candles: this.lastCandles,
        currentPrice: candle.close,
        config: this.backendConfig
      });
      
      if (response.signal) {
        return {
          action: response.signal.type === 'buy' ? 'buy' : 'sell',
          amount: response.signal.amount || 0.01,
          price: candle.close,
          confidence: response.signal.confidence || 0.5,
          reason: response.signal.reason || 'Backend strategy signal'
        };
      }
      
      return null;
    } catch (error) {
      console.warn('Backend strategy analysis failed:', error);
      return null;
    }
  }
  
  /**
   * Get strategy state from backend
   */
  async getStrategyState(): Promise<any> {
    try {
      return await this.backendAPI.getStrategyState(this.strategyType);
    } catch (error) {
      console.warn('Failed to get backend strategy state:', error);
      return {};
    }
  }
  
  /**
   * Update strategy configuration on backend
   */
  async updateConfig(newConfig: Record<string, any>): Promise<void> {
    this.backendConfig = { ...this.backendConfig, ...newConfig };
    
    try {
      await this.backendAPI.updateStrategyConfig(this.strategyType, this.backendConfig);
    } catch (error) {
      console.warn('Failed to update backend strategy config:', error);
    }
  }
  
  /**
   * Reset strategy state on backend
   */
  async reset(): Promise<void> {
    this.lastCandles = [];
    
    try {
      await this.backendAPI.resetStrategy(this.strategyType);
    } catch (error) {
      console.warn('Failed to reset backend strategy:', error);
    }
  }
  
  /**
   * Get available strategies from backend
   */
  static async getAvailableStrategies(): Promise<string[]> {
    const backendAPI = BackendAPIService.getInstance();
    try {
      return await backendAPI.getAvailableStrategies();
    } catch (error) {
      console.warn('Failed to get available strategies:', error);
      return [];
    }
  }
  
  /**
   * Create a backend strategy adapter for a specific strategy type
   */
  static create(strategyType: string, config: Record<string, any> = {}): BackendStrategyAdapter {
    return new BackendStrategyAdapter({
      strategyType,
      backendConfig: config,
      vaultAllocation: 85.7, // Default vault allocation
      btcGrowthAllocation: 14.3 // Default BTC growth allocation
    });
  }
}

/**
 * Factory for creating common backend strategies
 */
export class BackendStrategyFactory {
  /**
   * Create a Reverse Ratio strategy adapter
   */
  static createReverseRatio(config: Record<string, any> = {}): BackendStrategyAdapter {
    return BackendStrategyAdapter.create('reverse-ratio', {
      initialDropPercent: 0.1,
      levelDropPercent: 0.1,
      profitTarget: 0.85,
      maxLevels: 12,
      basePositionPercent: 6,
      ...config
    });
  }
  
  /**
   * Create a Grid Trading strategy adapter
   */
  static createGridTrading(config: Record<string, any> = {}): BackendStrategyAdapter {
    return BackendStrategyAdapter.create('grid-trading', {
      gridSize: 0.5,
      gridLevels: 10,
      baseOrderSize: 100,
      ...config
    });
  }
  
  /**
   * Create an RSI Mean Reversion strategy adapter
   */
  static createRSIMeanReversion(config: Record<string, any> = {}): BackendStrategyAdapter {
    return BackendStrategyAdapter.create('rsi-mean-reversion', {
      rsiPeriod: 14,
      oversoldThreshold: 30,
      overboughtThreshold: 70,
      ...config
    });
  }
  
  /**
   * Create a Micro Scalping strategy adapter
   */
  static createMicroScalping(config: Record<string, any> = {}): BackendStrategyAdapter {
    return BackendStrategyAdapter.create('micro-scalping', {
      profitTarget: 0.2,
      stopLoss: 0.1,
      timeframe: '1m',
      ...config
    });
  }
  
  /**
   * Create an Ultra Micro Scalping strategy adapter
   */
  static createUltraMicroScalping(config: Record<string, any> = {}): BackendStrategyAdapter {
    return BackendStrategyAdapter.create('ultra-micro-scalping', {
      profitTarget: 0.1,
      stopLoss: 0.05,
      timeframe: '1m',
      aggression: 'high',
      ...config
    });
  }
}