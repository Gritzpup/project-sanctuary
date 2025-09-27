export class TradeExecutor {
  constructor() {
    this.executionHistory = [];
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

    return position;
  }

  async executeSell(amount, price, reason) {
    const execution = {
      type: 'sell',
      amount,
      price,
      timestamp: Date.now(),
      reason
    };

    this.executionHistory.push(execution);

    return execution;
  }

  getExecutionHistory() {
    return this.executionHistory;
  }

  clearHistory() {
    this.executionHistory = [];
  }
}