/**
 * Performance logging utilities for Paper Trading
 */

export class PerformanceLogger {
  public static logTradingPerformance(backendState: any) {
    const { balance, trades, positions, currentPrice, profitLoss, isRunning } = backendState;
    
    if (!isRunning || !balance) return;
    
    
    // Account balances
    
    if (balance.vault) {
    }
    
    const totalValue = (balance.usd || 0) + ((balance.btc || 0) * currentPrice);
    
    // P&L Information
    const startingBalance = 10000; // Should be configurable
    const totalReturn = profitLoss || 0;
    const returnPercent = (totalReturn / startingBalance) * 100;
    const emoji = totalReturn >= 0 ? '🟢' : '🔴';
    
    
    // Position information
    this.logPositions(positions, currentPrice);
    
    // Trading history
    this.logTradingHistory(trades);
    
  }

  private static logPositions(positions: any[], currentPrice: number) {
    if (!positions || positions.length === 0) {
    } else {
      positions.forEach((pos: any, i: number) => {
        if (!pos || typeof pos.quantity !== 'number' || typeof pos.entryPrice !== 'number') {
          return;
        }
        
        const unrealizedPL = (currentPrice - pos.entryPrice) * pos.quantity;
        const unrealizedPLPercent = ((currentPrice - pos.entryPrice) / pos.entryPrice) * 100;
      });
    }
  }

  private static logTradingHistory(trades: any[]) {
    if (!trades || trades.length === 0) {
      return;
    }
    
    
    const buyTrades = trades.filter((t: any) => t.side === 'buy');
    const sellTrades = trades.filter((t: any) => t.side === 'sell');
    
    
    const totalFees = trades.reduce((sum: number, trade: any) => sum + (trade.fees || 0), 0);
    
    // Show last 10 trades
    this.logRecentTrades(trades);
    
    // Price levels analysis
    this.logPriceLevels(buyTrades, sellTrades);
  }

  private static logRecentTrades(trades: any[]) {
    const recentTrades = trades.slice(-10).reverse();
    recentTrades.forEach((trade: any, i: number) => {
      const time = new Date(trade.timestamp).toLocaleString();
      const side = trade.side.toUpperCase();
      const emoji = trade.side === 'buy' ? '🟢' : '🔴';
      const quantity = trade.quantity || trade.amount || 0;
      const price = trade.price || 0;
      const fees = trade.fees || 0;
    });
  }

  private static logPriceLevels(buyTrades: any[], sellTrades: any[]) {
    const buyPrices = buyTrades.map((t: any) => t.price).sort((a: number, b: number) => b - a);
    const sellPrices = sellTrades.map((t: any) => t.price).sort((a: number, b: number) => a - b);
    
    if (buyPrices.length > 0) {
    }
    
    if (sellPrices.length > 0) {
    }
  }
}