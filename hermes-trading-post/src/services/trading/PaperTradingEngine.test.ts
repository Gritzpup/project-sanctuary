/**
 * @file PaperTradingEngine.test.ts  
 * @description Tests for the unified PaperTradingEngine
 */

import { testRunner, assert } from '../../utils/testing/TestRunner';
import { PaperTradingEngine } from './PaperTradingEngine';
import { get } from 'svelte/store';

describe('PaperTradingEngine', () => {
  let engine: PaperTradingEngine;
  
  beforeEach(() => {
    engine = PaperTradingEngine.getInstance();
    engine.resetTrading();
  });
  
  it('should be a singleton', () => {
    const instance1 = PaperTradingEngine.getInstance();
    const instance2 = PaperTradingEngine.getInstance();
    assert.equals(instance1, instance2, 'Should return same instance');
  });
  
  it('should have initial state', () => {
    const state = get(engine.getState());
    
    assert.false(state.isRunning, 'Should not be running initially');
    assert.false(state.isPaused, 'Should not be paused initially');
    assert.equals(state.balance.usd, 10000, 'Should start with $10,000');
    assert.equals(state.balance.btc, 0, 'Should start with 0 BTC');
    assert.equals(state.trades.length, 0, 'Should start with no trades');
  });
  
  it('should update price correctly', () => {
    const initialState = get(engine.getState());
    const initialPrice = initialState.currentPrice;
    
    engine.feedPrice(50000);
    
    const newState = get(engine.getState());
    assert.equals(newState.currentPrice, 50000, 'Price should be updated');
    assert.true(newState.lastUpdate > initialState.lastUpdate, 'Last update should be more recent');
  });
  
  it('should reset to initial state', () => {
    // Modify state
    engine.feedPrice(50000);
    
    // Reset
    engine.resetTrading();
    
    const state = get(engine.getState());
    assert.false(state.isRunning, 'Should not be running after reset');
    assert.equals(state.balance.usd, 10000, 'Should reset balance');
    assert.equals(state.trades.length, 0, 'Should clear trades');
  });
  
  it('should handle trading mode configuration', async () => {
    const mockStrategy = {
      processCandle: async () => null,
      reset: async () => {},
      updateConfig: async () => {}
    } as any;
    
    const options = {
      mode: { type: 'live' as const },
      strategy: mockStrategy,
      initialBalance: 5000
    };
    
    await engine.startTrading(options);
    
    const state = get(engine.getState());
    assert.true(state.isRunning, 'Should be running after start');
    assert.equals(state.mode.type, 'live', 'Should be in live mode');
    assert.equals(state.balance.usd, 5000, 'Should use custom initial balance');
  });
  
  it('should pause and resume correctly', async () => {
    const mockStrategy = {
      processCandle: async () => null,
      reset: async () => {},
      updateConfig: async () => {}
    } as any;
    
    await engine.startTrading({
      mode: { type: 'live' },
      strategy: mockStrategy,
      initialBalance: 10000
    });
    
    engine.pauseTrading();
    let state = get(engine.getState());
    assert.true(state.isPaused, 'Should be paused');
    assert.true(state.isRunning, 'Should still be running when paused');
    
    engine.resumeTrading();
    state = get(engine.getState());
    assert.false(state.isPaused, 'Should not be paused after resume');
    assert.true(state.isRunning, 'Should still be running after resume');
  });
});

// Run the tests if this file is executed directly  
if (import.meta.url === new URL(import.meta.url).href) {
  testRunner.runAll();
}