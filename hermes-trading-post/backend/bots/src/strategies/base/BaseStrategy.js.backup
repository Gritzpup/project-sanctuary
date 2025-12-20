export class BaseStrategy {
  constructor(config = {}) {
    this.config = config;
    this.positions = [];
    this.recentHigh = 0;
  }

  // Abstract methods that must be implemented by subclasses
  analyze(candles, currentPrice) {
    throw new Error('analyze method must be implemented by strategy subclass');
  }

  calculatePositionSize(totalBalance, signal, currentPrice) {
    throw new Error('calculatePositionSize method must be implemented by strategy subclass');
  }

  // Common position management methods
  addPosition(position) {
    this.positions.push(position);
    console.log(`Strategy: Added position #${this.positions.length} at price $${position.entryPrice.toFixed(2)}`);
  }

  removePosition(position) {
    this.positions = this.positions.filter(p => p !== position);
  }
  
  clearAllPositions() {
    const count = this.positions.length;
    this.positions = [];
    console.log(`Strategy: Cleared all ${count} positions`);
  }
  
  restorePositions(positions) {
    this.positions = positions;
    console.log(`Strategy: Restored ${this.positions.length} positions`);
  }

  getPositions() {
    return this.positions;
  }

  // Common utility methods
  updateRecentHigh(candles, currentPrice) {
    const recentCandles = candles.slice(-20);
    if (recentCandles.length > 0) {
      const prevHigh = this.recentHigh;
      this.recentHigh = Math.max(...recentCandles.map(c => c.high), this.recentHigh);
      if (this.recentHigh > prevHigh && (this.recentHigh - prevHigh) / prevHigh > 0.01) {
        console.log('New recent high:', this.recentHigh);
      }
    } else if (this.recentHigh === 0) {
      this.recentHigh = currentPrice;
      console.log('Initialized recent high with current price:', this.recentHigh);
    }
    
    if (this.recentHigh === 0 || !this.recentHigh) {
      this.recentHigh = currentPrice;
      console.log('Strategy: No recent high found, using current price:', currentPrice);
    }
  }

  calculateAverageEntryPrice() {
    if (this.positions.length === 0) return 0;
    
    return this.positions.reduce((sum, p) => sum + p.entryPrice * p.size, 0) / 
           this.positions.reduce((sum, p) => sum + p.size, 0);
  }

  calculateProfitPercent(currentPrice) {
    const avgEntryPrice = this.calculateAverageEntryPrice();
    if (avgEntryPrice === 0) return 0;
    
    return ((currentPrice - avgEntryPrice) / avgEntryPrice) * 100;
  }
}