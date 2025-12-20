import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BackendStrategyAdapter, BackendStrategyFactory } from './BackendStrategyAdapter';
import type { CandleData } from '../base/StrategyTypes';

// Mock the BackendAPIService
vi.mock('../../services/api/BackendAPIService', () => ({
  BackendAPIService: {
    getInstance: () => ({
      analyzeCandles: vi.fn().mockResolvedValue(null),
      getStrategyState: vi.fn().mockResolvedValue({}),
      updateStrategyConfig: vi.fn().mockResolvedValue(undefined),
      resetStrategy: vi.fn().mockResolvedValue(undefined),
      getAvailableStrategies: vi.fn().mockResolvedValue(['reverse-descending-grid'])
    })
  }
}));

// Mock the logger
vi.mock('../../services/core/LoggingService', () => ({
  logger: {
    strategy: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    }
  }
}));

describe('BackendStrategyAdapter', () => {
  let adapter: BackendStrategyAdapter;
  
  beforeEach(() => {
    adapter = BackendStrategyAdapter.create('test-strategy', {
      initialDropPercent: 0.1,
      levelDropPercent: 0.1,
      profitTarget: 0.85,
      maxLevels: 12,
      basePositionPercent: 6
    });
  });

  it('should create adapter with proper configuration', () => {
    expect(adapter).toBeInstanceOf(BackendStrategyAdapter);
    expect(adapter.getName()).toBe('Backend Strategy Adapter');
  });

  it('should analyze candles', async () => {
    const candles: CandleData[] = [
      { time: 1000, open: 100, high: 110, low: 90, close: 105, volume: 1000 }
    ];

    const result = await adapter.analyze(candles);
    expect(result).toBeNull(); // Mocked to return null
  });

  it('should get strategy state', async () => {
    const state = await adapter.getStrategyState();
    expect(state).toEqual({});
  });

  it('should update configuration', async () => {
    await expect(adapter.updateConfig({ maxLevels: 15 })).resolves.not.toThrow();
  });

  it('should reset strategy', async () => {
    await expect(adapter.reset()).resolves.not.toThrow();
  });

  it('should get available strategies', async () => {
    const strategies = await BackendStrategyAdapter.getAvailableStrategies();
    expect(strategies).toEqual(['reverse-descending-grid']);
  });
});

describe('BackendStrategyFactory', () => {
  it('should create reverse ratio strategy', () => {
    const strategy = BackendStrategyFactory.createReverseRatio({
      maxLevels: 10
    });
    
    expect(strategy).toBeInstanceOf(BackendStrategyAdapter);
  });

  it('should create grid trading strategy', () => {
    const strategy = BackendStrategyFactory.createGridTrading({
      gridSize: 1.0
    });
    
    expect(strategy).toBeInstanceOf(BackendStrategyAdapter);
  });

  it('should create RSI mean reversion strategy', () => {
    const strategy = BackendStrategyFactory.createRSIMeanReversion({
      rsiPeriod: 21
    });
    
    expect(strategy).toBeInstanceOf(BackendStrategyAdapter);
  });

  it('should create micro scalping strategy', () => {
    const strategy = BackendStrategyFactory.createMicroScalping({
      spreadThreshold: 0.1
    });
    
    expect(strategy).toBeInstanceOf(BackendStrategyAdapter);
  });

  it('should create ultra micro scalping strategy', () => {
    const strategy = BackendStrategyFactory.createUltraMicroScalping({
      minProfit: 0.05
    });
    
    expect(strategy).toBeInstanceOf(BackendStrategyAdapter);
  });
});