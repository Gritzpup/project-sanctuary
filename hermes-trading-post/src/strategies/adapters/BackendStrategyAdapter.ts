/**
 * @file BackendStrategyAdapter.ts
 * @description Adapter that allows frontend to use backend strategies
 * Eliminates frontend/backend strategy duplication
 */

import { Strategy } from '../base/Strategy';
import type { CandleData, Position, Signal, StrategyConfig } from '../base/StrategyTypes';
import { BackendAPIService } from '../../services/api/BackendAPIService';
import { logger } from '../../services/core/LoggingService';

// Specific strategy configurations
export interface ReverseRatioConfig {
  initialDropPercent: number;
  levelDropPercent: number;
  profitTarget: number;
  maxLevels: number;
  basePositionPercent: number;
}

export interface GridTradingConfig {
  gridSize: number;
  gridLevels: number;
  baseOrderSize: number;
}

export interface RSIMeanReversionConfig {
  rsiPeriod: number;
  oversoldLevel: number;
  overboughtLevel: number;
  positionSize: number;
}

export interface ScalpingConfig {
  spreadThreshold: number;
  minProfit: number;
  maxHoldTime: number;
  positionSize: number;
}

// Union type for all possible backend configurations
export type BackendConfigType = 
  | ReverseRatioConfig 
  | GridTradingConfig 
  | RSIMeanReversionConfig 
  | ScalpingConfig 
  | Record<string, never>; // For strategies without specific config

export interface BackendStrategyConfig extends StrategyConfig {
  strategyType: string; // The backend strategy identifier
  backendConfig: BackendConfigType; // Typed config to send to backend
}

/**
 * Adapter that proxies strategy calls to the backend server
 * This eliminates the need for duplicate strategy implementations
 */
export class BackendStrategyAdapter extends Strategy {
  private backendAPI: BackendAPIService;
  private strategyType: string;
  private backendConfig: BackendConfigType;
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
      logger.strategy.error(this.strategyType, 'Backend strategy analysis failed', error as Error);
      return null;
    }
  }
  
  /**
   * Get strategy state from backend
   */
  async getStrategyState(): Promise<unknown> {
    try {
      return await this.backendAPI.getStrategyState(this.strategyType);
    } catch (error) {
      logger.strategy.error(this.strategyType, 'Failed to get backend strategy state', error as Error);
      return {};
    }
  }
  
  /**
   * Update strategy configuration on backend
   */
  async updateConfig(newConfig: Partial<BackendConfigType>): Promise<void> {
    this.backendConfig = { ...this.backendConfig, ...newConfig };
    
    try {
      await this.backendAPI.updateStrategyConfig(this.strategyType, this.backendConfig);
    } catch (error) {
      logger.strategy.error(this.strategyType, 'Failed to update backend strategy config', error as Error);
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
      logger.strategy.error(this.strategyType, 'Failed to reset backend strategy', error as Error);
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
      logger.strategy.error('BackendStrategyAdapter', 'Failed to get available strategies', error as Error);
      return [];
    }
  }
  
  /**
   * Create a backend strategy adapter for a specific strategy type
   */
  static create(strategyType: string, config: BackendConfigType = {}): BackendStrategyAdapter {
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
   * Create a Reverse Descending Grid strategy adapter
   */
  static createReverseRatio(config: Partial<ReverseRatioConfig> = {}): BackendStrategyAdapter {
    return BackendStrategyAdapter.create('reverse-descending-grid', {
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
  static createGridTrading(config: Partial<GridTradingConfig> = {}): BackendStrategyAdapter {
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
  static createRSIMeanReversion(config: Partial<RSIMeanReversionConfig> = {}): BackendStrategyAdapter {
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
  static createMicroScalping(config: Partial<ScalpingConfig> = {}): BackendStrategyAdapter {
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
  static createUltraMicroScalping(config: Partial<ScalpingConfig> = {}): BackendStrategyAdapter {
    return BackendStrategyAdapter.create('ultra-micro-scalping', {
      profitTarget: 0.1,
      stopLoss: 0.05,
      timeframe: '1m',
      aggression: 'high',
      ...config
    });
  }
}