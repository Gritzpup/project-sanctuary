import { SoundPlayer } from '../../utils/SoundPlayer.js';

export class TradeExecutor {
  constructor() {
    this.executionHistory = [];
    this.openPositions = []; // Track open positions for profit calculation
  }

  async executeBuy(amount, price, reason) {
    const position = {
      id: Date.now(),
      entryPrice: price,
      size: amount,
      timestamp: Date.now(),
      type: 'buy',
      reason
    };

    this.executionHistory.push({
      type: 'buy',
      amount,
      price,
      timestamp: Date.now(),
      reason
    });

    // 🔥 MEMORY LEAK FIX: Limit execution history to prevent unbounded growth
    if (this.executionHistory.length > 500) {
      this.executionHistory = this.executionHistory.slice(-500);
    }

    // Track open position for profit calculation on sell
    this.openPositions.push(position);

    return position;
  }

  async executeSell(amount, price, reason) {
    // Calculate profit using FIFO (First In First Out)
    let remainingToSell = amount;
    let totalCost = 0;

    // Remove positions and calculate cost basis
    const newPositions = [];
    for (const pos of this.openPositions) {
      if (remainingToSell <= 0) {
        newPositions.push(pos);
        continue;
      }

      if (pos.size <= remainingToSell) {
        totalCost += pos.entryPrice * pos.size;
        remainingToSell -= pos.size;
      } else {
        totalCost += pos.entryPrice * remainingToSell;
        pos.size -= remainingToSell;
        remainingToSell = 0;
        newPositions.push(pos);
      }
    }

    this.openPositions = newPositions;

    const proceeds = amount * price;
    const profit = proceeds - totalCost;
    const profitPercent = totalCost > 0 ? (profit / totalCost) * 100 : 0;

    const execution = {
      type: 'sell',
      amount,
      price,
      timestamp: Date.now(),
      reason,
      profit,
      profitPercent
    };

    this.executionHistory.push(execution);

    // 🔥 MEMORY LEAK FIX: Limit execution history to prevent unbounded growth
    if (this.executionHistory.length > 500) {
      this.executionHistory = this.executionHistory.slice(-500);
    }

    // Play sound for profitable trades via system audio
    if (profit > 0) {
      try {
        await SoundPlayer.playCoinSound();
      } catch (err) {
      }
    }

    return execution;
  }

  getExecutionHistory() {
    return this.executionHistory;
  }

  clearHistory() {
    this.executionHistory = [];
    this.openPositions = [];
  }
}