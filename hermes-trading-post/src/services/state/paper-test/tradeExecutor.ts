/**
 * @file tradeExecutor.ts
 * @description Handles trade execution and position management for paper testing
 */

import type { CandleData } from '../../../types/coinbase';
import type { Time } from 'lightweight-charts';
import type { PaperTestOptions, Trade, Position, ChartMarker } from './types';
import type { PaperTestStateManager } from './stateManager';

export class TradeExecutor {
  private stateManager: PaperTestStateManager;

  constructor(stateManager: PaperTestStateManager) {
    this.stateManager = stateManager;
  }

  executeBuy(amount: number, price: number, timestamp: number, options: PaperTestOptions, metadata?: any): void {
    const state = this.stateManager.getState();
    
    if (state.balance < amount) {
      this.stateManager.log(`Paper Test: Buy order rejected - Insufficient balance. Required: $${amount.toFixed(2)}, Available: $${state.balance.toFixed(2)}`);
      return;
    }
    
    const size = amount / price;
    this.stateManager.updateBalance(state.balance - amount);
    this.stateManager.updateBtcBalance(state.btcBalance + size);
    
    const trade: Trade = {
      id: `test-${Date.now()}-${Math.random()}`,
      type: 'buy',
      price: price,
      amount: size,
      total: amount,
      timestamp: timestamp,
      time: new Date(timestamp * 1000).toISOString()
    };
    
    this.stateManager.addTrade(trade);
    this.stateManager.log(`Paper Test: BUY executed - Trade #${state.trades.length + 1}, Size: ${size.toFixed(8)} BTC @ $${price.toFixed(2)}, Total: $${amount.toFixed(2)}, New Balance: $${(state.balance - amount).toFixed(2)}, BTC: ${(state.btcBalance + size).toFixed(8)}`);
    
    const position: Position = {
      entryPrice: price,
      entryTime: timestamp,
      size: size,
      type: 'long',
      metadata: metadata || {}
    };
    
    this.stateManager.addPosition(position);
    
    // Update strategy's internal state
    if (options.strategy.addPosition) {
      options.strategy.addPosition(position);
    }
    
    if (options.onTrade) {
      options.onTrade(trade);
    }
    
    // Add visual marker on chart
    const marker: ChartMarker = {
      time: timestamp as Time,
      position: 'belowBar',
      shape: 'arrowUp',
      color: '#26a69a',
      text: 'B'
    };
    
    this.stateManager.addMarker(marker);
    
    // Update position callback
    if (options.onPositionUpdate) {
      const updatedState = this.stateManager.getState();
      options.onPositionUpdate(updatedState.positions, updatedState.balance, updatedState.btcBalance);
    }
  }

  executeSell(amount: number, price: number, timestamp: number, options: PaperTestOptions): void {
    const state = this.stateManager.getState();
    
    if (state.btcBalance < amount) return;
    
    const proceeds = amount * price;
    this.stateManager.updateBalance(state.balance + proceeds);
    this.stateManager.updateBtcBalance(state.btcBalance - amount);
    
    // Calculate profit from positions using FIFO
    let remainingToSell = amount;
    let totalCost = 0;
    
    const newPositions = state.positions.filter(pos => {
      if (remainingToSell <= 0) return true;
      
      if (pos.size <= remainingToSell) {
        totalCost += pos.entryPrice * pos.size;
        remainingToSell -= pos.size;
        return false;
      } else {
        totalCost += pos.entryPrice * remainingToSell;
        pos.size -= remainingToSell;
        remainingToSell = 0;
        return true;
      }
    });
    
    this.stateManager.updatePositions(newPositions);
    
    const profit = proceeds - totalCost;
    const profitPercent = totalCost > 0 ? (profit / totalCost) * 100 : 0;
    
    const trade: Trade = {
      id: `test-${Date.now()}-${Math.random()}`,
      type: 'sell',
      price: price,
      amount: amount,
      total: proceeds,
      timestamp: timestamp,
      time: new Date(timestamp * 1000).toISOString()
    };
    
    this.stateManager.addTrade(trade);
    this.stateManager.log(`Paper Test: SELL executed - Trade #${state.trades.length + 1}, Size: ${amount.toFixed(8)} BTC @ $${price.toFixed(2)}, Proceeds: $${proceeds.toFixed(2)}, Profit: $${profit.toFixed(2)} (${profitPercent.toFixed(2)}%), New Balance: $${(state.balance + proceeds).toFixed(2)}, BTC: ${(state.btcBalance - amount).toFixed(8)}`);
    
    // Update strategy's internal positions
    if (options.strategy.removePosition) {
      // Remove positions that were fully sold
      state.positions.forEach(originalPos => {
        const stillExists = newPositions.find(p => 
          p.entryTime === originalPos.entryTime && 
          p.entryPrice === originalPos.entryPrice
        );
        if (!stillExists) {
          options.strategy.removePosition(originalPos);
        }
      });
    }
    
    if (options.onTrade) {
      options.onTrade(trade);
    }
    
    // Add visual marker on chart
    const marker: ChartMarker = {
      time: timestamp as Time,
      position: 'aboveBar',
      shape: 'arrowDown',
      color: '#ef5350',
      text: 'S'
    };
    
    this.stateManager.addMarker(marker);
    
    // Update position callback
    if (options.onPositionUpdate) {
      const updatedState = this.stateManager.getState();
      options.onPositionUpdate(updatedState.positions, updatedState.balance, updatedState.btcBalance);
    }
    
    // Play coin sound for profitable trades
    if (profit > 0) {
      this.playCoinSound();
    }
  }

  updatePositions(currentPrice: number): void {
    const state = this.stateManager.getState();
    
    // Update position values with current price
    state.positions.forEach(position => {
      const currentValue = position.size * currentPrice;
      const costBasis = position.size * position.entryPrice;
      const unrealizedPnL = currentValue - costBasis;
      const unrealizedPnLPercent = (unrealizedPnL / costBasis) * 100;
      
      // Store updated values in metadata for display
      position.metadata = {
        ...position.metadata,
        currentValue,
        unrealizedPnL,
        unrealizedPnLPercent
      };
    });
  }

  private playCoinSound(): void {
    try {
      const audio = new Audio('/sounds/coins_cave01.wav');
      audio.volume = 0.3;

      // Attempt to play, with error handling for browser audio policies
      const playPromise = audio.play();

      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            // Sound played successfully
          })
          .catch(e => {
            // Autoplay policy or audio device issue
            this.stateManager.log('Sound play failed (likely browser autoplay policy):', e.name);
          });
      }
    } catch (e) {
      this.stateManager.log('Failed to create audio:', e);
    }
  }
}