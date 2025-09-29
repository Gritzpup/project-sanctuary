export class PositionManager {
  constructor() {
    this.positions = [];
  }

  addPosition(position) {
    this.positions.push(position);
    console.log(`PositionManager: Added position #${this.positions.length} at price $${position.entryPrice.toFixed(2)}`);
  }

  removePosition(position) {
    const index = this.positions.findIndex(p => p.id === position.id);
    if (index !== -1) {
      this.positions.splice(index, 1);
      console.log(`PositionManager: Removed position at price $${position.entryPrice.toFixed(2)}`);
    }
  }

  clearAllPositions() {
    const count = this.positions.length;
    this.positions = [];
    console.log(`PositionManager: Cleared all ${count} positions`);
  }

  getPositions() {
    return this.positions;
  }

  getTotalBtc() {
    return this.positions.reduce((total, position) => total + position.size, 0);
  }

  getTotalCostBasis() {
    return this.positions.reduce((total, position) => total + (position.size * position.entryPrice), 0);
  }

  getAverageEntryPrice() {
    if (this.positions.length === 0) return 0;
    
    const totalValue = this.positions.reduce((sum, p) => sum + p.entryPrice * p.size, 0);
    const totalSize = this.positions.reduce((sum, p) => sum + p.size, 0);
    
    return totalValue / totalSize;
  }

  calculateUnrealizedPnL(currentPrice) {
    const totalBtc = this.getTotalBtc();
    const avgEntryPrice = this.getAverageEntryPrice();
    
    if (totalBtc === 0 || avgEntryPrice === 0) return 0;
    
    const currentValue = totalBtc * currentPrice;
    const entryValue = totalBtc * avgEntryPrice;
    
    return currentValue - entryValue;
  }

  calculateUnrealizedPnLPercent(currentPrice) {
    const avgEntryPrice = this.getAverageEntryPrice();
    
    if (avgEntryPrice === 0) return 0;
    
    return ((currentPrice - avgEntryPrice) / avgEntryPrice) * 100;
  }

  getPositionsSummary(currentPrice) {
    return {
      count: this.positions.length,
      totalBtc: this.getTotalBtc(),
      averageEntryPrice: this.getAverageEntryPrice(),
      unrealizedPnL: this.calculateUnrealizedPnL(currentPrice),
      unrealizedPnLPercent: this.calculateUnrealizedPnLPercent(currentPrice)
    };
  }
}